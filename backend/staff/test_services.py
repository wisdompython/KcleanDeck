"""Admin API: categories, photo uploads, price tester, duplication and the
per-service options (time slots, lead time, area surcharges, deposits)."""

import shutil
import tempfile
from datetime import timedelta
from io import BytesIO
from pathlib import Path
from unittest import mock

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from bookings.models import Booking
from pricing.models import ServiceArea, ServiceCategory, Service, TimeSlot
from staff.tests import make_user

MEDIA = tempfile.mkdtemp(prefix="kleandeck-test-media-")


def jpeg(width=2400, height=1600, name="photo.jpg"):
    buf = BytesIO()
    Image.new("RGB", (width, height), (10, 37, 64)).save(buf, "JPEG", quality=90)
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/jpeg")


@override_settings(MEDIA_ROOT=MEDIA)
class ServiceAdminTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        cache.clear()
        call_command("seed", verbosity=0)
        self.owner = make_user("owner@kleandeck.test", "Owner")
        self.staff = make_user("staff@kleandeck.test", "Staff")
        self.client = APIClient()
        self.client.force_login(self.owner)
        self.standard = Service.objects.get(slug="standard-cleaning")

    # --- Photos -------------------------------------------------------------

    def test_photo_upload_makes_two_webp_sizes_and_replaces_old(self):
        res = self.client.post(f"/api/admin/services/{self.standard.pk}/photo/", {"photo": jpeg()}, format="multipart")
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.assertTrue(body["has_photo"])
        self.assertEqual(body["photo_width"], 2400)
        self.assertTrue(body["photo_url"].startswith("/media/uploads/services/"))
        self.assertTrue(body["photo_card_url"].endswith("-card.webp"))

        large = Path(MEDIA) / body["photo_url"].removeprefix("/media/")
        card = Path(MEDIA) / body["photo_card_url"].removeprefix("/media/")
        self.assertEqual(Image.open(large).size, (2000, 1333))
        self.assertEqual(Image.open(card).size[0], 960)

        # The public API now serves the uploaded photo.
        public = APIClient().get("/api/services/standard-cleaning/").json()
        self.assertEqual(public["image"], body["photo_url"])

        # Replacing deletes the old files; removing falls back to the starter image.
        self.client.post(f"/api/admin/services/{self.standard.pk}/photo/", {"photo": jpeg(1800, 1200)}, format="multipart")
        self.assertFalse(large.exists())
        self.assertFalse(card.exists())
        res = self.client.delete(f"/api/admin/services/{self.standard.pk}/photo/")
        self.assertEqual(res.json()["photo_url"], "/images/services/standard.jpg")

    def test_photo_rejects_non_images_and_tiny_images(self):
        url = f"/api/admin/services/{self.standard.pk}/photo/"
        res = self.client.post(url, {"photo": SimpleUploadedFile("x.jpg", b"not an image")}, format="multipart")
        self.assertEqual(res.status_code, 400)
        self.assertIn("isn't a photo", res.json()["detail"])
        res = self.client.post(url, {"photo": jpeg(200, 150)}, format="multipart")
        self.assertEqual(res.status_code, 400)
        self.assertIn("too small", res.json()["detail"])

    def test_staff_cannot_upload_photos(self):
        self.client.force_login(self.staff)
        res = self.client.post(f"/api/admin/services/{self.standard.pk}/photo/", {"photo": jpeg()}, format="multipart")
        self.assertEqual(res.status_code, 403)

    # --- Categories ---------------------------------------------------------

    def test_seeded_categories_link_to_their_main_service(self):
        cats = APIClient().get("/api/categories/").json()
        self.assertEqual([c["slug"] for c in cats][:2], ["corporate-offices", "shortlets-hospitality"])
        self.assertEqual(cats[1]["service"], "deep-cleaning")
        self.assertEqual(cats[1]["image"], "/images/use-cases/shortlets.jpg")

    def test_create_category_and_hide_it(self):
        deep = Service.objects.get(slug="deep-cleaning")
        res = self.client.post(
            "/api/admin/categories/",
            {"name": "Schools", "slug": "schools", "buyer": "School bursars", "cta_label": "Price a school clean",
             "services": [deep.pk, self.standard.pk], "primary_service": deep.pk},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        public = {c["slug"]: c for c in APIClient().get("/api/categories/").json()}
        self.assertEqual(public["schools"]["service"], "deep-cleaning")

        self.client.patch(f"/api/admin/categories/{res.json()['id']}/", {"is_active": False}, format="json")
        self.assertNotIn("schools", {c["slug"] for c in APIClient().get("/api/categories/").json()})

    def test_category_button_must_open_one_of_its_services(self):
        post = Service.objects.get(slug="post-construction-cleaning")
        res = self.client.post(
            "/api/admin/categories/",
            {"name": "X", "slug": "x", "services": [self.standard.pk], "primary_service": post.pk},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("primary_service", res.json())

    def test_hidden_main_service_falls_back_to_next_live_one(self):
        cat = ServiceCategory.objects.get(slug="shortlets-hospitality")
        Service.objects.filter(slug="deep-cleaning").update(is_active=False)
        self.assertEqual(cat.button_service().slug, "standard-cleaning")

    # --- Price tester and duplicate -----------------------------------------

    def test_price_tester_includes_deposit_and_hidden_services(self):
        self.client.patch(
            f"/api/admin/services/{self.standard.pk}/", {"deposit_percent": 30, "is_active": False}, format="json"
        )
        units = list(self.standard.units.all())
        res = self.client.post(
            f"/api/admin/services/{self.standard.pk}/quote/",
            {"quantities": {str(units[0].pk): 4, str(units[1].pk): 0, str(units[2].pk): 0}},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        # 15,000 + 4 × 5,000 = 35,000 + 7.5% VAT = 37,625; 30% deposit
        self.assertEqual(body["total"], 37625)
        self.assertEqual(body["due_now"], 11288)
        self.assertEqual(body["due_later"], 37625 - 11288)

    def test_price_tester_reports_bad_input(self):
        unit = self.standard.units.first()
        res = self.client.post(
            f"/api/admin/services/{self.standard.pk}/quote/", {"quantities": {str(unit.pk): 999}}, format="json"
        )
        self.assertEqual(res.status_code, 400)

    def test_duplicate_copies_everything_as_hidden_draft(self):
        area = ServiceArea.objects.first()
        self.client.patch(
            f"/api/admin/services/{self.standard.pk}/",
            {"area_prices": [{"area": area.pk, "surcharge": 4000}], "deposit_percent": 50},
            format="json",
        )
        self.client.post(f"/api/admin/services/{self.standard.pk}/photo/", {"photo": jpeg()}, format="multipart")
        res = self.client.post(f"/api/admin/services/{self.standard.pk}/duplicate/")
        self.assertEqual(res.status_code, 201, res.content)
        copy = res.json()
        self.assertEqual(copy["name"], "Standard cleaning (copy)")
        self.assertEqual(copy["slug"], "standard-cleaning-copy")
        self.assertFalse(copy["is_active"])
        self.assertEqual(len(copy["units"]), 3)
        self.assertEqual(copy["area_prices"], [{"area": area.pk, "surcharge": 4000}])
        self.assertEqual(copy["deposit_percent"], 50)
        self.assertTrue(copy["has_photo"])
        self.assertNotEqual(copy["photo_url"], Service.objects.get(pk=self.standard.pk).photo.url)
        # A second copy gets a unique slug.
        again = self.client.post(f"/api/admin/services/{self.standard.pk}/duplicate/").json()
        self.assertEqual(again["slug"], "standard-cleaning-copy-2")

    # --- Per-service booking options ----------------------------------------

    def test_area_surcharge_override_is_used_for_that_service_only(self):
        area = ServiceArea.objects.get(name="Ajah")
        area.surcharge = 2000
        area.save()
        self.client.patch(
            f"/api/admin/services/{self.standard.pk}/", {"area_prices": [{"area": area.pk, "surcharge": 9000}]},
            format="json",
        )
        public = APIClient()
        standard = public.post("/api/quote/", {"service": "standard-cleaning", "area": area.pk}, format="json").json()
        deep = public.post("/api/quote/", {"service": "deep-cleaning", "area": area.pk}, format="json").json()
        self.assertEqual(standard["area_surcharge"], 9000)
        self.assertEqual(deep["area_surcharge"], 2000)

    def test_time_slots_and_lead_days_per_service(self):
        evening = TimeSlot.objects.get(key="after_hours")
        morning = TimeSlot.objects.get(key="morning")
        self.client.patch(
            f"/api/admin/services/{self.standard.pk}/",
            {"time_slots": [morning.pk], "min_lead_days": 3},
            format="json",
        )
        public = APIClient().get("/api/services/standard-cleaning/").json()
        self.assertEqual([t["key"] for t in public["time_slots"]], ["morning"])
        self.assertEqual(public["min_lead_days"], 3)

        payload = {
            "service": "standard-cleaning", "contact_name": "A", "email": "a@b.co", "phone": "1", "address": "VI",
            "accept_terms": True, "confirm_site_requirements": True, "time_slot": evening.key,
            "scheduled_date": (timezone.localdate() + timedelta(days=1)).isoformat(),
        }
        res = APIClient().post("/api/bookings/", payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("scheduled_date", res.json())
        self.assertIn("time_slot", res.json())

    @override_settings(PAYSTACK_SECRET_KEY="sk_test_x")
    def test_deposit_checkout_charges_part_then_confirms(self):
        from bookings import paystack

        self.client.patch(f"/api/admin/services/{self.standard.pk}/", {"deposit_percent": 30}, format="json")
        sent = []

        def fake_post(url, json=None, headers=None, timeout=None):
            sent.append(json)
            res = mock.Mock(ok=True)
            res.json.return_value = {"status": True, "data": {"authorization_url": "https://pay.test/x"}}
            return res

        with mock.patch("bookings.paystack.requests.post", side_effect=fake_post):
            res = APIClient().post("/api/bookings/", {
                "service": "standard-cleaning", "contact_name": "Ada", "email": "a@b.co", "phone": "1",
                "address": "VI", "accept_terms": True, "confirm_site_requirements": True, "time_slot": "morning",
                "scheduled_date": (timezone.localdate() + timedelta(days=2)).isoformat(),
            }, format="json")
        self.assertEqual(res.status_code, 201, res.content)
        body = res.json()
        self.assertEqual(body["due_now"], int(body["total"] * 0.3 + 0.5))
        self.assertEqual(sent[0]["amount"], body["due_now"] * 100)

        booking = Booking.objects.get(reference=body["reference"])
        self.assertEqual(booking.deposit_amount, body["due_now"])
        payment = booking.payments.get()
        paystack.apply_transaction({"reference": payment.reference, "status": "success",
                                    "amount": payment.amount * 100, "currency": "NGN"})
        booking.refresh_from_db()
        self.assertEqual(booking.status, Booking.Status.CONFIRMED)
        self.assertEqual(booking.payment_status, Booking.PaymentStatus.PART_PAID)
        self.assertEqual(booking.balance_due, body["total"] - body["due_now"])

    def test_admin_booking_time_slot_must_exist(self):
        res = self.client.post("/api/admin/bookings/", {
            "service": "facility-support", "contact_name": "A", "phone": "1", "pricing_mode": "manual",
            "subtotal": 1000, "time_slot": "midnight",
        }, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("time_slot", res.json())

    def test_time_slot_labels_come_from_settings(self):
        TimeSlot.objects.filter(key="morning").update(label="Early", hint="7am – 11am")
        res = self.client.post("/api/admin/bookings/", {
            "service": "facility-support", "contact_name": "A", "phone": "1", "pricing_mode": "manual",
            "subtotal": 1000, "time_slot": "morning",
        }, format="json")
        self.assertEqual(res.json()["time_slot_label"], "Early (7am – 11am)")
