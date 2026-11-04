from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from bookings.models import Booking, Cleaner
from core.models import Application
from pricing.models import Service

User = get_user_model()


def make_user(email, role, password="pw-12345678"):
    user = User.objects.create_user(username=email, email=email, password=password, first_name=email.split("@")[0])
    user.groups.add(Group.objects.get(name=role))
    return user


class AdminAPITestCase(TestCase):
    def setUp(self):
        cache.clear()
        call_command("seed", verbosity=0)
        self.owner = make_user("owner@kleandeck.test", "Owner")
        self.staff = make_user("staff@kleandeck.test", "Staff")
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user=None)
        self.client.force_login(user)
        return self.client


class AuthTests(AdminAPITestCase):
    def test_login_logout_and_me(self):
        client = APIClient(enforce_csrf_checks=True)
        token = client.get("/api/admin/auth/csrf/").json()["csrfToken"]
        res = client.post(
            "/api/admin/auth/login/", {"email": "OWNER@kleandeck.test", "password": "pw-12345678"},
            format="json", HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["role"], "owner")
        self.assertEqual(client.get("/api/admin/auth/me/").json()["email"], "owner@kleandeck.test")

        token = client.cookies["csrftoken"].value
        self.assertEqual(client.post("/api/admin/auth/logout/", HTTP_X_CSRFTOKEN=token).status_code, 204)
        self.assertEqual(client.get("/api/admin/auth/me/").status_code, 403)

    def test_login_with_username(self):
        User.objects.create_superuser("app", "", "pw-12345678")
        res = self.client.post("/api/admin/auth/login/", {"email": "app", "password": "pw-12345678"}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()["role"], "owner")

    def test_login_requires_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        res = client.post("/api/admin/auth/login/", {"email": "owner@kleandeck.test", "password": "pw-12345678"},
                          format="json")
        self.assertEqual(res.status_code, 403)

    def test_wrong_password_and_non_team_users_rejected(self):
        User.objects.create_user(username="x@y.z", email="x@y.z", password="pw-12345678")
        for email, pw in [("owner@kleandeck.test", "wrong"), ("x@y.z", "pw-12345678"), ("nobody@y.z", "pw")]:
            res = self.client.post("/api/admin/auth/login/", {"email": email, "password": pw}, format="json")
            self.assertEqual(res.status_code, 400, email)

    def test_writes_need_csrf_when_logged_in(self):
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(self.staff)
        res = client.post("/api/admin/cleaners/", {"full_name": "A"}, format="json")
        self.assertEqual(res.status_code, 403)

    def test_anonymous_blocked_everywhere(self):
        for url in ["/api/admin/dashboard/", "/api/admin/bookings/", "/api/admin/services/", "/api/admin/team/"]:
            self.assertEqual(self.client.get(url).status_code, 403, url)

    def test_change_password(self):
        client = self.as_user(self.staff)
        res = client.post("/api/admin/auth/password/", {"current_password": "pw-12345678",
                                                         "new_password": "new-password-1"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.staff.refresh_from_db()
        self.assertTrue(self.staff.check_password("new-password-1"))


class RoleTests(AdminAPITestCase):
    def test_staff_can_read_but_not_change_pricing_or_settings(self):
        client = self.as_user(self.staff)
        self.assertEqual(client.get("/api/admin/services/").status_code, 200)
        self.assertEqual(client.get("/api/admin/settings/").status_code, 200)
        svc = Service.objects.first()
        self.assertEqual(client.patch(f"/api/admin/services/{svc.pk}/", {"base_price": 1}, format="json").status_code, 403)
        self.assertEqual(client.patch("/api/admin/settings/", {"vat_rate": "0"}, format="json").status_code, 403)
        self.assertEqual(client.get("/api/admin/team/").status_code, 403)

    def test_staff_can_manage_bookings_and_cleaners(self):
        client = self.as_user(self.staff)
        self.assertEqual(client.post("/api/admin/cleaners/", {"full_name": "Bisi"}, format="json").status_code, 201)
        self.assertEqual(client.get("/api/admin/dashboard/").status_code, 200)


class BookingTests(AdminAPITestCase):
    def booking_payload(self, **extra):
        data = {
            "service": "facility-support", "contact_name": "Tunde", "phone": "0801", "company_name": "Acme",
            "pricing_mode": "manual", "subtotal": 200000, "status": "awaiting_payment",
        }
        data.update(extra)
        return data

    def test_create_with_agreed_price_adds_vat(self):
        client = self.as_user(self.staff)
        res = client.post("/api/admin/bookings/", self.booking_payload(), format="json")
        self.assertEqual(res.status_code, 201, res.content)
        body = res.json()
        self.assertEqual((body["source"], body["vat_amount"], body["total"]), ("manual", 15000, 215000))
        self.assertEqual(body["created_by_name"], "staff")

    def test_create_from_rate_card(self):
        svc = Service.objects.get(slug="post-construction-cleaning")
        client = self.as_user(self.staff)
        res = client.post("/api/admin/bookings/", self.booking_payload(
            service=svc.slug, pricing_mode="calculated", subtotal=None, inputs={"area_sqm": 100}), format="json")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()["total"], 182750)  # (20,000 + 100 × 1,500) + 7.5%

    def test_rate_card_errors_are_reported(self):
        client = self.as_user(self.staff)
        res = client.post("/api/admin/bookings/", self.booking_payload(pricing_mode="calculated"), format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("inputs", res.json())

    def test_update_reprices_only_when_price_fields_change(self):
        client = self.as_user(self.staff)
        ref = client.post("/api/admin/bookings/", self.booking_payload(), format="json").json()["reference"]
        cleaner = Cleaner.objects.create(full_name="Bisi")
        res = client.patch(f"/api/admin/bookings/{ref}/", {"status": "confirmed", "cleaners": [cleaner.pk]},
                           format="json")
        self.assertEqual(res.json()["total"], 215000)
        self.assertEqual(res.json()["cleaners"][0]["full_name"], "Bisi")
        res = client.patch(f"/api/admin/bookings/{ref}/", {"subtotal": 100000, "vat_exempt": True}, format="json")
        self.assertEqual(res.json()["total"], 100000)

    def test_record_part_then_full_payment(self):
        client = self.as_user(self.staff)
        ref = client.post("/api/admin/bookings/", self.booking_payload(), format="json").json()["reference"]
        res = client.post(f"/api/admin/bookings/{ref}/record-payment/", {"method": "bank_transfer", "amount": 100000},
                          format="json")
        self.assertEqual((res.json()["payment_status"], res.json()["balance_due"]), ("part_paid", 115000))
        res = client.post(f"/api/admin/bookings/{ref}/record-payment/", {"method": "cash"}, format="json")
        body = res.json()
        self.assertEqual((body["payment_status"], body["status"], body["amount_paid"]), ("paid", "confirmed", 215000))
        self.assertEqual(len(body["payments"]), 2)
        res = client.post(f"/api/admin/bookings/{ref}/record-payment/", {"method": "cash"}, format="json")
        self.assertEqual(res.status_code, 400)

    @override_settings(PAYSTACK_SECRET_KEY="sk_test_x")
    def test_payment_link(self):
        client = self.as_user(self.staff)
        ref = client.post("/api/admin/bookings/", self.booking_payload(email="t@acme.ng"), format="json").json()[
            "reference"]
        fake = mock.Mock(ok=True)
        fake.json.return_value = {"status": True, "data": {"authorization_url": "https://checkout.paystack.com/abc"}}
        with mock.patch("bookings.paystack.requests.post", return_value=fake):
            res = client.post(f"/api/admin/bookings/{ref}/payment-link/")
        self.assertEqual(res.json(), {"authorization_url": "https://checkout.paystack.com/abc", "amount": 215000})

    def test_payment_link_needs_email(self):
        client = self.as_user(self.staff)
        ref = client.post("/api/admin/bookings/", self.booking_payload(), format="json").json()["reference"]
        res = client.post(f"/api/admin/bookings/{ref}/payment-link/")
        self.assertEqual(res.status_code, 400)
        self.assertIn("email", res.json()["detail"])

    def test_list_filters_and_dashboard(self):
        client = self.as_user(self.staff)
        tomorrow = (timezone.localdate() + timedelta(days=1)).isoformat()
        client.post("/api/admin/bookings/", self.booking_payload(status="confirmed", scheduled_date=tomorrow),
                    format="json")
        client.post("/api/admin/bookings/", self.booking_payload(company_name="Zeta"), format="json")
        self.assertEqual(client.get("/api/admin/bookings/?status=confirmed").json()["count"], 1)
        self.assertEqual(client.get("/api/admin/bookings/?q=zeta").json()["count"], 1)
        dash = client.get("/api/admin/dashboard/").json()
        self.assertEqual(dash["counts"]["next_7_days"], 1)
        self.assertEqual(dash["counts"]["unassigned"], 1)
        self.assertEqual(len(dash["upcoming"]), 1)


class ApplicationTests(AdminAPITestCase):
    def test_hire_adds_cleaner(self):
        app = Application.objects.create(kind="job", full_name="Ngozi A", phone="0802", role="Cleaner")
        res = self.as_user(self.staff).post(f"/api/admin/applications/{app.pk}/hire/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["application"]["status"], "accepted")
        self.assertTrue(Cleaner.objects.filter(full_name="Ngozi A").exists())


class ServiceEditorTests(AdminAPITestCase):
    def test_owner_edits_units_and_addons(self):
        client = self.as_user(self.owner)
        svc = Service.objects.get(slug="standard-cleaning")
        data = client.get(f"/api/admin/services/{svc.pk}/").json()
        units = data["units"]
        units[0]["price"] = 7000
        units = units[:2] + [{"label": "Floors", "price": 3000, "min_qty": 0, "max_qty": 10, "default_qty": 0}]
        res = client.patch(f"/api/admin/services/{svc.pk}/", {"units": units, "addons": [
            {"label": "Fridge", "price": 5000, "is_active": True}]}, format="json")
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.assertEqual([u["label"] for u in body["units"]], ["Rooms / work areas", "Restrooms", "Floors"])
        self.assertEqual(body["units"][0]["price"], 7000)
        self.assertEqual(len(body["addons"]), 1)

    def test_used_service_cannot_be_deleted(self):
        client = self.as_user(self.owner)
        svc = Service.objects.get(slug="facility-support")
        Booking.objects.create(service=svc, contact_name="A", phone="1")
        res = client.delete(f"/api/admin/services/{svc.pk}/")
        self.assertEqual(res.status_code, 400)


class TeamTests(AdminAPITestCase):
    def test_owner_adds_staff_with_temp_password(self):
        client = self.as_user(self.owner)
        res = client.post("/api/admin/team/", {"name": "Ada", "email": "ADA@kleandeck.test", "role": "staff"},
                          format="json")
        self.assertEqual(res.status_code, 201, res.content)
        body = res.json()
        self.assertEqual(body["role"], "staff")
        self.assertTrue(User.objects.get(email="ada@kleandeck.test").check_password(body["temp_password"]))

    def test_owner_cannot_lock_themselves_out(self):
        client = self.as_user(self.owner)
        res = client.patch(f"/api/admin/team/{self.owner.pk}/", {"is_active": False}, format="json")
        self.assertEqual(res.status_code, 400)
        res = client.patch(f"/api/admin/team/{self.owner.pk}/", {"role": "staff"}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_duplicate_email_rejected(self):
        client = self.as_user(self.owner)
        res = client.post("/api/admin/team/", {"name": "X", "email": "staff@kleandeck.test", "role": "staff"},
                          format="json")
        self.assertEqual(res.status_code, 400)


class SetupChecklistTests(AdminAPITestCase):
    def test_checklist_tracks_progress_and_manual_steps(self):
        client = self.as_user(self.owner)
        data = client.get("/api/admin/setup/").json()
        steps = {s["key"]: s for s in data["steps"]}
        self.assertFalse(steps["whatsapp"]["done"])
        self.assertTrue(steps["terms"]["done"])  # seeded terms include the confirmed refund policy
        self.assertTrue(steps["team"]["done"])  # owner + staff exist in setUp
        before = data["done"]

        client.patch("/api/admin/settings/", {"whatsapp_number": "2348012345678"}, format="json")
        res = client.post("/api/admin/setup/", {"key": "prices", "done": True}, format="json")
        after = {s["key"]: s for s in res.json()["steps"]}
        self.assertTrue(after["whatsapp"]["done"])
        self.assertTrue(after["prices"]["done"])
        self.assertEqual(res.json()["done"], before + 2)

    def test_automatic_steps_cannot_be_ticked_and_staff_cannot_see_it(self):
        client = self.as_user(self.owner)
        self.assertEqual(client.post("/api/admin/setup/", {"key": "whatsapp"}, format="json").status_code, 400)
        client = self.as_user(self.staff)
        self.assertEqual(client.get("/api/admin/setup/").status_code, 403)
