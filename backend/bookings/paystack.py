"""Paystack: initialise transactions, verify them, and handle webhooks.

A booking is only marked paid after Paystack itself confirms the charge —
either through the signed webhook or a server-side verify call. The browser
redirect alone never marks anything paid.
"""

import hashlib
import hmac
import logging
import secrets

import requests
from django.conf import settings
from django.db import transaction
from django.utils.dateparse import parse_datetime

from bookings.models import Booking, Payment

logger = logging.getLogger(__name__)


class PaystackError(Exception):
    pass


def _headers() -> dict:
    if not settings.PAYSTACK_SECRET_KEY:
        raise PaystackError("PAYSTACK_SECRET_KEY is not configured.")
    return {"Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}", "Content-Type": "application/json"}


def initialize_payment(booking: Booking, amount: int | None = None) -> Payment:
    """Start a Paystack transaction for `amount` naira (default: the balance due)."""
    if not booking.email:
        raise PaystackError("Paystack needs the customer's email address. Add it to the booking first.")
    amount = booking.balance_due if amount is None else min(amount, booking.balance_due)
    if amount <= 0:
        raise PaystackError("Nothing to pay on this booking.")

    reference = f"{booking.reference}-{secrets.token_hex(3).upper()}"
    payload = {
        "email": booking.email,
        "amount": amount * 100,  # kobo
        "currency": "NGN",
        "reference": reference,
        "callback_url": f"{settings.FRONTEND_URL}/booking/confirmation",
        "metadata": {
            "booking_reference": booking.reference,
            "custom_fields": [
                {"display_name": "Booking", "variable_name": "booking", "value": booking.reference},
                {"display_name": "Service", "variable_name": "service", "value": booking.service.name},
                {"display_name": "Customer", "variable_name": "customer", "value": booking.customer_name},
            ],
        },
    }
    try:
        res = requests.post(
            f"{settings.PAYSTACK_BASE_URL}/transaction/initialize", json=payload, headers=_headers(), timeout=20
        )
        body = res.json()
    except (requests.RequestException, ValueError) as exc:
        raise PaystackError("Could not reach Paystack. Please try again.") from exc
    if not res.ok or not body.get("status"):
        logger.warning("Paystack initialize failed for %s: %s", booking.reference, body)
        raise PaystackError(body.get("message") or "Paystack rejected the payment request.")

    payment = Payment.objects.create(
        booking=booking,
        reference=reference,
        amount=amount,
        authorization_url=body["data"]["authorization_url"],
    )
    booking.payment_link = payment.authorization_url
    booking.save(update_fields=["payment_link", "updated_at"])
    return payment


def fetch_transaction(reference: str) -> dict:
    try:
        res = requests.get(
            f"{settings.PAYSTACK_BASE_URL}/transaction/verify/{reference}", headers=_headers(), timeout=20
        )
        body = res.json()
    except (requests.RequestException, ValueError) as exc:
        raise PaystackError("Could not reach Paystack to verify the payment.") from exc
    if not res.ok or not body.get("status"):
        raise PaystackError(body.get("message") or "Paystack could not verify this payment.")
    return body["data"]


def apply_transaction(data: dict) -> Payment | None:
    """Record a Paystack transaction (from verify or webhook). Idempotent.

    Returns the Payment, or None if the reference isn't one of ours.
    """
    from bookings.notifications import notify_booking_paid

    reference = data.get("reference", "")
    paid_booking = None
    with transaction.atomic():
        payment = Payment.objects.select_for_update().select_related("booking").filter(reference=reference).first()
        if payment is None:
            logger.warning("Paystack transaction for unknown reference %s", reference)
            return None

        payment.gateway_response = data
        payment.channel = data.get("channel") or ""
        status = data.get("status")
        amount_kobo = int(data.get("amount") or 0)

        if status == "success":
            if data.get("currency") != "NGN" or amount_kobo < payment.amount * 100:
                logger.error(
                    "Paystack amount/currency mismatch on %s: got %s %s, expected %s NGN",
                    reference, amount_kobo, data.get("currency"), payment.amount * 100,
                )
                payment.status = Payment.Status.FAILED
            elif payment.status != Payment.Status.SUCCESS:
                payment.status = Payment.Status.SUCCESS
                payment.paid_at = parse_datetime(data.get("paid_at") or "") or None
                booking = Booking.objects.select_for_update().get(pk=payment.booking_id)
                booking.register_payment(amount_kobo // 100, Booking.PaymentMethod.PAYSTACK, payment.paid_at)
                booking.save()
                paid_booking = booking
        elif status in {"failed", "abandoned"} and payment.status == Payment.Status.PENDING:
            payment.status = status
        payment.save()

    if paid_booking is not None:
        notify_booking_paid(paid_booking)
    return payment


def signature_is_valid(raw_body: bytes, signature: str) -> bool:
    if not settings.PAYSTACK_SECRET_KEY or not signature:
        return False
    expected = hmac.new(settings.PAYSTACK_SECRET_KEY.encode(), raw_body, hashlib.sha512).hexdigest()
    return hmac.compare_digest(expected, signature)
