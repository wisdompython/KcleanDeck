"""Emails to the team and the customer. Failures are logged, never raised —
a broken mailbox must not break a booking or a Paystack webhook."""

import logging

from django.core.mail import send_mail

from core.models import SiteSettings

logger = logging.getLogger(__name__)


def _naira(amount: int) -> str:
    return f"₦{amount:,}"


def _send(subject: str, body: str, to: list[str]) -> None:
    if not to:
        return
    try:
        send_mail(subject, body, None, to)
    except Exception:  # noqa: BLE001 — any mail failure is non-fatal
        logger.exception("Failed to send email %r to %s", subject, to)


def _booking_summary(booking) -> str:
    lines = [
        f"Reference: {booking.reference}",
        f"Service: {booking.service.name}" + (f" ({booking.frequency.label})" if booking.frequency else ""),
        f"Customer: {booking.customer_name} — {booking.contact_name}, {booking.phone}, {booking.email or 'no email'}",
        f"Address: {booking.address or '-'}" + (f" ({booking.area.name})" if booking.area else ""),
        f"Date: {booking.scheduled_date or 'to be agreed'} {booking.time_slot_label}".rstrip(),
    ]
    if booking.total:
        lines.append(f"Total: {_naira(booking.total)} (incl. VAT {_naira(booking.vat_amount)})")
    if booking.site_notes:
        lines.append(f"Site notes: {booking.site_notes}")
    return "\n".join(lines)


def notify_booking_paid(booking) -> None:
    settings = SiteSettings.load()
    _send(
        f"Paid booking {booking.reference} — {booking.service.name}",
        "A booking has been paid online. Allocate a team on WhatsApp.\n\n" + _booking_summary(booking),
        settings.notification_list,
    )
    if booking.email:
        _send(
            f"Your Kleandeck booking {booking.reference} is confirmed",
            f"Hi {booking.contact_name},\n\n"
            f"Thank you — we've received your payment of {_naira(booking.amount_paid)}. "
            "Our team will contact you on WhatsApp to confirm your cleaning team and arrival time.\n\n"
            + _booking_summary(booking)
            + "\n\nPlease make sure running water and electricity are available at the site on the day.\n\n"
            f"Kleandeck{' · ' + settings.phone_number if settings.phone_number else ''}",
            [booking.email],
        )


def notify_quote_requested(booking) -> None:
    _send(
        f"Quote request {booking.reference} — {booking.service.name}",
        "A customer asked for a quote and was sent to WhatsApp.\n\n" + _booking_summary(booking),
        SiteSettings.load().notification_list,
    )


def notify_application(application) -> None:
    _send(
        f"New {application.get_kind_display().lower()}: {application.full_name}",
        f"Name: {application.full_name}\nPhone: {application.phone}\nEmail: {application.email or '-'}\n"
        f"Role: {application.role or '-'}\nLocation: {application.location or '-'}\n"
        f"Experience: {application.experience or '-'}\n\n{application.message}",
        SiteSettings.load().notification_list,
    )
