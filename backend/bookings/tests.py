import hashlib
import hmac
import json
from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from bookings.models import Booking, DiscountCode, Payment
from core.models import SiteSettings
from pricing.models import Service

SECRET = "sk_test_dummy"


def fake_initialize_response(reference_holder):
    def _post(url, json=None, headers=None, timeout=None):
        reference_holder.append(json)
        res = mock.Mock(ok=True)
        res.json.return_value = {
            "status": True,
            "data": {"authorization_url": f"https://checkout.paystack.com/{json['reference']}"},
        }
        return res

    return _post


@override_settings(PAYSTACK_SECRET_KEY=SECRET, FRONTEND_URL="https://kleandeck.test")
class BookingFlowTests(TestCase):
    def setUp(self):
        cache.clear()  # reset API rate limits between tests
        call_command("seed", verbosity=0)
        self.client = APIClient()
        self.service = Service.objects.get(slug="standard-cleaning")
        self.units = list(self.service.units.all())
        self.date = (timezone.localdate() + timedelta(days=3)).isoformat()

    def booking_payload(self, **overrides):
        payload = {
            "service": "standard-cleaning",
            "frequency": self.service.available_frequencies().get(slug="weekly").pk,
            "quantities": {str(self.units[0].pk): 4, str(self.units[1].pk): 2, str(self.units[2].pk): 1},
            "company_name": "Acme Ltd",
            "contact_name": "Ada Obi",
            "email": "ada@example.com",
            "phone": "08012345678",
            "address": "1 Adeola Odeku St, Victoria Island",
            "scheduled_date": self.date,
            "time_slot": "morning",
            "accept_terms": True,
            "confirm_site_requirements": True,
        }
        payload.update(overrides)
        return payload

    def test_quote_endpoint(self):
        res = self.client.post("/api/quote/", self.booking_payload(), format="json")
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.assertEqual(body["vat_rate"], "7.50")
        self.assertEqual(body["total"], body["subtotal"] + body["vat_amount"])

    def test_discount_code_is_applied_before_vat(self):
        DiscountCode.objects.create(code="WELCOME10", name="Welcome", kind="percentage", value=10)
        original = self.client.post("/api/quote/", self.booking_payload(), format="json").json()
        res = self.client.post(
            "/api/quote/", self.booking_payload(discount_code="welcome10"), format="json"
        )
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.assertEqual(body["discount_code"], "WELCOME10")
        self.assertEqual(body["subtotal_before_code"], original["subtotal"])
        self.assertEqual(body["subtotal"], original["subtotal"] - body["code_discount_amount"])
        self.assertEqual(body["total"], body["subtotal"] + body["vat_amount"])

    def test_invalid_discount_code_has_clear_field_error(self):
        res = self.client.post(
            "/api/quote/", self.booking_payload(discount_code="NOTREAL"), format="json"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("discount_code", res.json())

    def test_discount_is_frozen_on_booking_and_used_for_payment(self):
        code = DiscountCode.objects.create(code="CLIENT15", name="Client offer", kind="percentage", value=15)
        sent = []
        with mock.patch("bookings.paystack.requests.post", side_effect=fake_initialize_response(sent)):
            res = self.client.post(
                "/api/bookings/", self.booking_payload(discount_code=code.code), format="json"
            )
        self.assertEqual(res.status_code, 201, res.content)
        booking = Booking.objects.get(reference=res.json()["reference"])
        self.assertEqual(booking.discount_code, code)
        self.assertGreater(booking.discount_amount, 0)
        self.assertEqual(sent[0]["amount"], booking.deposit_amount * 100 if booking.deposit_amount else booking.total * 100)

    def test_limited_code_cannot_be_reused(self):
        code = DiscountCode.objects.create(code="ONCEONLY", name="One use", kind="fixed", value=5000, usage_limit=1)
        sent = []
        with mock.patch("bookings.paystack.requests.post", side_effect=fake_initialize_response(sent)):
            first = self.client.post(
                "/api/bookings/", self.booking_payload(discount_code=code.code), format="json"
            )
        self.assertEqual(first.status_code, 201, first.content)
        second = self.client.post(
            "/api/quote/", self.booking_payload(discount_code=code.code), format="json"
        )
        self.assertEqual(second.status_code, 400)
        self.assertIn("usage limit", str(second.json()["discount_code"]).lower())

    def test_create_booking_starts_paystack_checkout(self):
        sent = []
        with mock.patch("bookings.paystack.requests.post", side_effect=fake_initialize_response(sent)):
            res = self.client.post("/api/bookings/", self.booking_payload(), format="json")
        self.assertEqual(res.status_code, 201, res.content)
        booking = Booking.objects.get(reference=res.json()["reference"])
        self.assertEqual(booking.source, Booking.Source.ONLINE)
        self.assertEqual(booking.status, Booking.Status.AWAITING_PAYMENT)
        self.assertIsNotNone(booking.terms_accepted_at)
        self.assertEqual(sent[0]["amount"], booking.total * 100)
        self.assertEqual(sent[0]["callback_url"], "https://kleandeck.test/booking/confirmation")
        self.assertTrue(res.json()["authorization_url"].startswith("https://checkout.paystack.com/"))

    def test_terms_and_site_requirements_required(self):
        res = self.client.post(
            "/api/bookings/", self.booking_payload(accept_terms=False, confirm_site_requirements=False), format="json"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("accept_terms", res.json())
        self.assertIn("confirm_site_requirements", res.json())
        self.assertFalse(Booking.objects.exists())

    def test_date_must_respect_lead_time(self):
        res = self.client.post(
            "/api/bookings/", self.booking_payload(scheduled_date=timezone.localdate().isoformat()), format="json"
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("scheduled_date", res.json())

    def test_quote_only_service_cannot_checkout(self):
        res = self.client.post(
            "/api/bookings/", self.booking_payload(service="facility-support", frequency=None, quantities={}),
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertTrue(res.json()["requires_quote"])

    def test_paystack_failure_rolls_back_booking(self):
        res_mock = mock.Mock(ok=False)
        res_mock.json.return_value = {"status": False, "message": "Invalid key"}
        with mock.patch("bookings.paystack.requests.post", return_value=res_mock):
            res = self.client.post("/api/bookings/", self.booking_payload(), format="json")
        self.assertEqual(res.status_code, 502)
        self.assertFalse(Booking.objects.exists())

    def test_quote_request_returns_whatsapp_link(self):
        settings = SiteSettings.load()
        settings.whatsapp_number = "2348000000000"
        settings.save()
        res = self.client.post(
            "/api/quote-requests/",
            {"service": "facility-support", "contact_name": "Ada", "phone": "0801", "message": "2 assistants",
             "accept_terms": True},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.content)
        self.assertTrue(res.json()["whatsapp_url"].startswith("https://wa.me/2348000000000?text="))
        self.assertEqual(Booking.objects.get().status, Booking.Status.QUOTE_REQUESTED)

    def test_quote_request_requires_terms(self):
        res = self.client.post(
            "/api/quote-requests/", {"service": "facility-support", "contact_name": "Ada", "phone": "0801"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    # --- payment confirmation ----------------------------------------------

    def make_payment(self):
        sent = []
        with mock.patch("bookings.paystack.requests.post", side_effect=fake_initialize_response(sent)):
            ref = self.client.post("/api/bookings/", self.booking_payload(), format="json").json()["reference"]
        booking = Booking.objects.get(reference=ref)
        return booking, booking.payments.get()

    def webhook(self, data, secret=SECRET):
        body = json.dumps({"event": "charge.success", "data": data}).encode()
        sig = hmac.new(secret.encode(), body, hashlib.sha512).hexdigest()
        return self.client.generic(
            "POST", "/api/paystack/webhook/", body, content_type="application/json", HTTP_X_PAYSTACK_SIGNATURE=sig
        )

    def test_webhook_marks_booking_paid_once(self):
        booking, payment = self.make_payment()
        data = {"reference": payment.reference, "status": "success", "amount": booking.total * 100,
                "currency": "NGN", "channel": "card", "paid_at": "2026-10-08T10:00:00Z"}
        self.assertEqual(self.webhook(data).status_code, 200)
        self.assertEqual(self.webhook(data).status_code, 200)  # duplicate delivery
        booking.refresh_from_db()
        self.assertEqual(booking.payment_status, Booking.PaymentStatus.PAID)
        self.assertEqual(booking.status, Booking.Status.CONFIRMED)
        self.assertEqual(booking.amount_paid, booking.total)

    def test_webhook_rejects_bad_signature(self):
        booking, payment = self.make_payment()
        res = self.webhook({"reference": payment.reference, "status": "success"}, secret="wrong")
        self.assertEqual(res.status_code, 400)
        booking.refresh_from_db()
        self.assertEqual(booking.payment_status, Booking.PaymentStatus.UNPAID)

    def test_underpayment_not_accepted(self):
        booking, payment = self.make_payment()
        self.webhook({"reference": payment.reference, "status": "success", "amount": 100, "currency": "NGN"})
        booking.refresh_from_db()
        payment.refresh_from_db()
        self.assertEqual(booking.payment_status, Booking.PaymentStatus.UNPAID)
        self.assertEqual(payment.status, Payment.Status.FAILED)

    def test_verify_endpoint(self):
        booking, payment = self.make_payment()
        verify = mock.Mock(ok=True)
        verify.json.return_value = {
            "status": True,
            "data": {"reference": payment.reference, "status": "success", "amount": booking.total * 100,
                     "currency": "NGN", "channel": "bank_transfer"},
        }
        with mock.patch("bookings.paystack.requests.get", return_value=verify):
            res = self.client.get(f"/api/payments/verify/?reference={payment.reference}")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["payment_status"], "success")
        self.assertEqual(res.json()["booking"]["payment_status"], "paid")


class ManualPriceTests(TestCase):
    def test_manual_price_adds_vat(self):
        call_command("seed", verbosity=0)
        booking = Booking(service=Service.objects.get(slug="facility-support"), contact_name="A", phone="1",
                          subtotal=200000)
        booking.apply_manual_price()
        self.assertEqual(booking.vat_amount, 15000)
        self.assertEqual(booking.total, 215000)
        booking.vat_exempt = True
        booking.apply_manual_price()
        self.assertEqual(booking.total, 200000)


class AdminSmokeTests(TestCase):
    """Every admin page staff use renders, and a manual booking saves with VAT."""

    def setUp(self):
        call_command("seed", verbosity=0)
        self.admin = get_user_model().objects.create_superuser("ops", "ops@example.com", "pw")
        self.client.force_login(self.admin)

    def test_pages_render(self):
        for url in [
            "/backstage/", "/backstage/bookings/booking/", "/backstage/bookings/booking/add/", "/backstage/pricing/service/",
            f"/backstage/pricing/service/{Service.objects.first().pk}/change/", "/backstage/core/application/",
            "/backstage/bookings/cleaner/", "/backstage/pricing/frequencyoption/", "/backstage/pricing/servicearea/",
        ]:
            self.assertEqual(self.client.get(url).status_code, 200, url)
        self.assertEqual(self.client.get("/backstage/core/sitesettings/").status_code, 302)

    def post_booking(self, **fields):
        data = {
            "status": "awaiting_payment", "contact_name": "Tunde", "phone": "0801", "email": "", "company_name": "",
            "address": "", "area": "", "service": Service.objects.get(slug="facility-support").pk, "frequency": "",
            "scheduled_date": "", "time_slot": "", "site_notes": "", "pricing_mode": "manual", "subtotal": "100000",
            "inputs": "{}", "payment_status": "unpaid", "payment_method": "", "amount_paid": "0", "paid_at_0": "",
            "paid_at_1": "", "internal_notes": "",
            "payments-TOTAL_FORMS": "0", "payments-INITIAL_FORMS": "0", "payments-MIN_NUM_FORMS": "0",
            "payments-MAX_NUM_FORMS": "1000",
        }
        data.update(fields)
        return self.client.post("/backstage/bookings/booking/add/", data)

    def test_manual_booking_with_agreed_price(self):
        res = self.post_booking()
        self.assertEqual(res.status_code, 302, res.content.decode()[:3000])
        booking = Booking.objects.get()
        self.assertEqual((booking.source, booking.vat_amount, booking.total), ("manual", 7500, 107500))
        self.assertEqual(booking.created_by, self.admin)

    def test_manual_booking_calculated_from_rates(self):
        svc = Service.objects.get(slug="post-construction-cleaning")
        res = self.post_booking(service=svc.pk, pricing_mode="calculated", subtotal="0", inputs='{"area_sqm": 100}')
        self.assertEqual(res.status_code, 302, res.content.decode()[:3000])
        # 20,000 + 100 m² × 1,500 = 170,000 + 7.5% VAT
        self.assertEqual(Booking.objects.get().total, 182750)

    def test_owner_can_generate_discount_code(self):
        payload = {
            "code": "KLEAN-TEST24",
            "name": "Launch campaign",
            "kind": "percentage",
            "value": 10,
            "minimum_subtotal": 25000,
            "maximum_discount": 15000,
            "usage_limit": 25,
            "services": [Service.objects.get(slug="standard-cleaning").pk],
            "is_active": True,
        }
        res = self.client.post(
            "/api/admin/discount-codes/", json.dumps(payload), content_type="application/json"
        )
        self.assertEqual(res.status_code, 201, res.content)
        saved = DiscountCode.objects.get()
        self.assertEqual(saved.code, "KLEAN-TEST24")
        self.assertEqual(saved.services.count(), 1)
