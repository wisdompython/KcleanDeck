"""Reproduce admin edge cases against a fresh, in-memory SQLite database.

Run from the repository root with backend/.venv/Scripts/python.exe
docs/audit-2026-10-19/backend-probes.py. No network calls or existing DB writes.
"""
import json
import logging
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.update({
    "DJANGO_SETTINGS_MODULE": "config.settings",
    "DATABASE_URL": "sqlite:///:memory:",
    "DJANGO_DEBUG": "1",
    "DJANGO_SECRET_KEY": "isolated-audit-only",
    "EMAIL_HOST": "",
    "PAYSTACK_SECRET_KEY": "",
    "DJANGO_DISABLE_THROTTLES": "1",
})
import django
django.setup()

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient
from bookings.discounts import apply_discount_code
from bookings.models import Booking, Cleaner, DiscountCode, Payment
from core.models import Application, SiteSettings
from pricing.engine import QuoteRequest, calculate
from pricing.models import FrequencyOption, PricingUnit, Service, TimeSlot

settings.ALLOWED_HOSTS = ["testserver"]
settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
logging.disable(logging.CRITICAL)
call_command("migrate", verbosity=0)
owner = get_user_model().objects.create_superuser("audit-owner", "audit@example.test", "audit-only-password")
client = APIClient()
client.force_authenticate(owner)
client.raise_request_exception = False
site = SiteSettings.load()
site.vat_enabled = False
site.save()
service = Service.objects.create(name="Audit flat service", slug="audit-flat", tagline="Audit", pricing_method="flat", base_price=10000)
frequency = FrequencyOption.objects.create(label="Once", slug="audit-once")
morning = TimeSlot.objects.create(key="audit-morning", label="Morning")
afternoon = TimeSlot.objects.create(key="audit-afternoon", label="Afternoon")
observations = []

def record(name, **details):
    observations.append({"case": name, **details})

def make_booking(**kwargs):
    values = dict(service=service, contact_name="Audit client", phone="08012345678", subtotal=10000,
                  total=10000, pricing_mode="manual", status="awaiting_payment")
    values.update(kwargs)
    return Booking.objects.create(**values)

# A paid booking becomes more expensive; the paid badge should reflect its balance.
b = make_booking()
client.post(f"/api/admin/bookings/{b.reference}/record-payment/", {"method": "cash"}, format="json")
r = client.patch(f"/api/admin/bookings/{b.reference}/", {"subtotal": 20000}, format="json")
record("raise price after full payment", http=r.status_code,
       actual={k: r.data[k] for k in ["total", "amount_paid", "balance_due", "payment_status"]},
       expected="part_paid with a 10000 balance")

# The edit form submits price fields even when only client details were changed.
code = DiscountCode.objects.create(code="AUDIT10", value=10)
q = calculate(QuoteRequest(service=service, frequency=frequency))
apply_discount_code(q, service, code.code)
b = make_booking(pricing_mode="calculated", frequency=frequency, discount_code=code)
b.apply_quote(q)
b.save()
before = b.total
r = client.patch(f"/api/admin/bookings/{b.reference}/", {
    "contact_name": "Corrected client", "service": service.slug, "frequency": frequency.pk,
    "inputs": {}, "pricing_mode": "calculated", "subtotal": None, "vat_exempt": False,
}, format="json")
record("edit discounted booking contact", http=r.status_code, total_before=before,
       actual={k: r.data[k] for k in ["total", "discount_code", "discount_amount"]},
       expected="unchanged total 9000 and retained 1000 discount")

# Deterministic interleaving of two staff recording payments with stale reads.
b = make_booking()
staff_a = Booking.objects.get(pk=b.pk)
staff_b = Booking.objects.get(pk=b.pk)
staff_a.record_offline_payment(4000, "cash")
staff_a.save()
staff_b.record_offline_payment(6000, "bank_transfer")
staff_b.save()
b.refresh_from_db()
record("concurrent offline payment interleaving", actual={"amount_paid": b.amount_paid,
       "payment_ledger_sum": sum(b.payments.values_list("amount", flat=True)), "balance_due": b.balance_due},
       expected="amount_paid equals ledger sum 10000 and balance_due is 0")

# Hiring can be repeated through the UI by resetting status away from accepted.
app = Application.objects.create(kind="job", full_name="Audit applicant", phone="08012345678")
first = client.post(f"/api/admin/applications/{app.pk}/hire/")
client.patch(f"/api/admin/applications/{app.pk}/", {"status": "contacted"}, format="json")
second = client.post(f"/api/admin/applications/{app.pk}/hire/")
record("hire applicant twice", http=[first.status_code, second.status_code],
       duplicate_cleaners=Cleaner.objects.filter(full_name=app.full_name).count(), expected="one linked cleaner")

# UI requests 100 applications and provides no next-page control.
Application.objects.bulk_create([Application(kind="job", full_name=f"Audit candidate {i}", phone="08012345678") for i in range(105)])
r = client.get("/api/admin/applications/?page_size=100")
record("applications page limit", http=r.status_code, count=r.data["count"], returned=len(r.data["results"]),
       has_next=bool(r.data["next"]), expected="UI exposes next page / load more")

# Explicit service restrictions should survive deactivation of their only member.
service.time_slots.set([morning])
morning.is_active = False
morning.save()
record("deactivate only allowed arrival slot", actual=list(service.available_time_slots().values_list("key", flat=True)),
       expected="no slots or configuration warning; unrelated afternoon should not be enabled")
other_frequency = FrequencyOption.objects.create(label="Weekly", slug="audit-weekly", visits_per_payment=4)
service.frequencies.set([frequency])
frequency.is_active = False
frequency.save()
record("deactivate only allowed frequency", actual=list(service.available_frequencies().values_list("slug", flat=True)),
       expected="no frequency or configuration warning; unrelated weekly must not be enabled")

# Existing booking keys are stored as text, so deleting settings can strand them.
old_slot = TimeSlot.objects.create(key="audit-retired", label="Retired")
b = make_booking(time_slot=old_slot.key)
deleted = client.delete(f"/api/admin/time-slots/{old_slot.pk}/")
r = client.patch(f"/api/admin/bookings/{b.reference}/", {"contact_name": "Updated", "time_slot": "audit-retired"}, format="json")
record("delete slot used by booking then edit", http=[deleted.status_code, r.status_code], actual=r.data,
       expected="preserve historical slot or prevent unsafe deletion")

# Partial nested unit updates hit a KeyError instead of returning validation.
unit_service = Service.objects.create(name="Unit audit", slug="audit-unit", tagline="Audit")
unit = PricingUnit.objects.create(service=unit_service, label="Rooms", price=1000)
r = client.patch(f"/api/admin/services/{unit_service.pk}/", {"units": [{"id": unit.pk, "label": "Bedrooms"}]}, format="json")
record("partial nested unit update", http=r.status_code, expected="200 update or useful 400, never 500")

# Positive validation control: malformed calculator input should return HTTP 400.
r = client.post("/api/admin/bookings/", {"contact_name": "Audit malformed input", "phone": "08012345678", "service": service.slug, "pricing_mode": "calculated", "inputs": [1]}, format="json")
record("malformed calculator inputs", http=r.status_code, expected="400 field validation, never 500")

# Aggregate joins must not count the same scheduled booking once per cleaner.
b = make_booking(status="confirmed", scheduled_date=timezone.localdate())
crew = list(Cleaner.objects.all()[:2])
b.cleaners.set(crew)
r = client.get("/api/admin/dashboard/")
record("dashboard counts with two assigned cleaners", http=r.status_code,
       actual={"today_count": r.data["counts"]["today"], "today_bookings": Booking.objects.filter(scheduled_date=timezone.localdate(), status="confirmed").count(), "cleaners_on_job": len(crew)},
       expected="today_count equals 1 distinct booking")

output = Path(__file__).with_name("backend-probe-results.json")
output.write_text(json.dumps(observations, indent=2, default=str), encoding="utf-8")
print(json.dumps(observations, indent=2, default=str))
