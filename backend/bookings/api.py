import json
import logging
from datetime import timedelta
from urllib.parse import quote as urlquote

from django.db import transaction
from django.http import HttpResponse, HttpResponseBadRequest
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from bookings import paystack
from bookings.models import Booking, Payment
from bookings.notifications import notify_quote_requested
from core.models import SiteSettings
from pricing.api import QuoteInputSerializer

logger = logging.getLogger(__name__)


def must_be_true(message: str):
    def check(value):
        if value is not True:
            raise serializers.ValidationError(message)
        return value

    return check


class BookingCreateSerializer(QuoteInputSerializer):
    company_name = serializers.CharField(max_length=160, required=False, allow_blank=True, default="")
    contact_name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=30)
    address = serializers.CharField(max_length=255)
    site_notes = serializers.CharField(required=False, allow_blank=True, default="")
    scheduled_date = serializers.DateField()
    time_slot = serializers.SlugField(max_length=30)
    accept_terms = serializers.BooleanField(validators=[must_be_true("You need to accept the terms to book.")])
    confirm_site_requirements = serializers.BooleanField(
        validators=[must_be_true("Please confirm running water and electricity will be available.")]
    )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        service = attrs["service"]

        lead = service.min_lead_days
        if lead is None:
            lead = SiteSettings.load().min_booking_lead_days
        earliest = timezone.localdate() + timedelta(days=lead)
        errors = {}
        if attrs["scheduled_date"] < earliest:
            errors["scheduled_date"] = f"The earliest date we can book {service.name.lower()} is {earliest:%d %b %Y}."
        if not service.available_time_slots().filter(key=attrs["time_slot"]).exists():
            errors["time_slot"] = f"That time isn't available for {service.name}."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class BookingCreate(APIView):
    """Create an online booking at the calculated price and start Paystack checkout."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_write"

    def post(self, request):
        ser = BookingCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        preview_quote = ser.calculate()
        if preview_quote.requires_quote:
            return Response(
                {"detail": preview_quote.quote_reason, "requires_quote": True}, status=status.HTTP_400_BAD_REQUEST
            )

        d = ser.validated_data
        try:
            with transaction.atomic():
                # Recalculate while locking a limited-use code so two simultaneous
                # checkouts cannot both claim the final redemption.
                quote = ser.calculate(lock_discount=True)
                booking = Booking(
                    source=Booking.Source.ONLINE,
                    status=Booking.Status.AWAITING_PAYMENT,
                    service=d["service"],
                    frequency=d.get("frequency") or d["service"].available_frequencies().first(),
                    area=d.get("area"),
                    inputs=ser.inputs_json(),
                    discount_code=ser.applied_discount,
                    company_name=d["company_name"],
                    contact_name=d["contact_name"],
                    email=d["email"],
                    phone=d["phone"],
                    address=d["address"],
                    site_notes=d["site_notes"],
                    scheduled_date=d["scheduled_date"],
                    time_slot=d["time_slot"],
                    terms_accepted_at=timezone.now(),
                    site_requirements_confirmed=True,
                )
                booking.apply_quote(quote)
                due_now = d["service"].deposit_for(booking.total)
                if due_now < booking.total:
                    booking.deposit_amount = due_now
                booking.save()
                payment = paystack.initialize_payment(booking, due_now)
        except paystack.PaystackError as exc:
            logger.warning("Checkout failed: %s", exc)
            return Response(
                {"detail": "We couldn't start the payment just now. Please try again or message us on WhatsApp."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(
            {
                "reference": booking.reference,
                "authorization_url": payment.authorization_url,
                "total": booking.total,
                "due_now": due_now,
            },
            status=status.HTTP_201_CREATED,
        )


class QuoteRequestSerializer(QuoteInputSerializer):
    company_name = serializers.CharField(max_length=160, required=False, allow_blank=True, default="")
    contact_name = serializers.CharField(max_length=120)
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    phone = serializers.CharField(max_length=30)
    address = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    scheduled_date = serializers.DateField(required=False, allow_null=True)
    message = serializers.CharField(required=False, allow_blank=True, default="")
    accept_terms = serializers.BooleanField(validators=[must_be_true("You need to accept the terms to continue.")])


def whatsapp_url(text: str) -> str | None:
    number = SiteSettings.load().whatsapp_number
    if not number:
        return None
    return f"https://wa.me/{number}?text={urlquote(text)}"


class QuoteRequestCreate(APIView):
    """Record a custom-quote request, then hand the customer to WhatsApp."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_write"

    def post(self, request):
        ser = QuoteRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        service = d["service"]

        estimate = None
        if not service.is_quote_only:
            try:
                estimate = ser.calculate()
            except serializers.ValidationError:
                estimate = None  # incomplete calculator input is fine for a quote request

        booking = Booking.objects.create(
            source=Booking.Source.QUOTE,
            status=Booking.Status.QUOTE_REQUESTED,
            service=service,
            frequency=d.get("frequency"),
            area=d.get("area"),
            inputs=ser.inputs_json(),
            price_breakdown={"estimate": estimate.as_dict()} if estimate else {},
            company_name=d["company_name"],
            contact_name=d["contact_name"],
            email=d["email"],
            phone=d["phone"],
            address=d["address"],
            scheduled_date=d.get("scheduled_date"),
            site_notes=d["message"],
            terms_accepted_at=timezone.now(),
        )
        notify_quote_requested(booking)

        parts = [
            f"Hello Kleandeck, I'd like a quote for {service.name}.",
            f"Ref: {booking.reference}",
            f"Name: {booking.contact_name}" + (f" ({booking.company_name})" if booking.company_name else ""),
        ]
        if booking.area:
            parts.append(f"Area: {booking.area.name}")
        if booking.frequency:
            parts.append(f"Frequency: {booking.frequency.label}")
        if estimate and estimate.subtotal:
            parts.append(f"Calculator estimate: ₦{estimate.subtotal:,} + VAT")
        if d["message"]:
            parts.append(f"Details: {d['message']}")

        return Response(
            {"reference": booking.reference, "whatsapp_url": whatsapp_url("\n".join(parts))},
            status=status.HTTP_201_CREATED,
        )


def public_booking(booking: Booking) -> dict:
    return {
        "reference": booking.reference,
        "service": booking.service.name,
        "frequency": booking.frequency.label if booking.frequency else None,
        "scheduled_date": booking.scheduled_date,
        "time_slot": booking.time_slot_label,
        "contact_first_name": booking.contact_name.split(" ")[0],
        "total": booking.total,
        "amount_paid": booking.amount_paid,
        "balance_due": booking.balance_due,
        "deposit_amount": booking.deposit_amount,
        "payment_status": booking.payment_status,
        "status": booking.status,
    }


class VerifyPayment(APIView):
    """Called by the confirmation page after Paystack redirects back."""

    # Each call can hit Paystack's API, so keep it rate-limited.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "verify"

    def get(self, request):
        reference = request.query_params.get("reference", "")
        payment = Payment.objects.select_related("booking").filter(reference=reference).first()
        if payment is None:
            return Response({"detail": "Payment not found."}, status=status.HTTP_404_NOT_FOUND)

        if payment.status == Payment.Status.PENDING:
            try:
                payment = paystack.apply_transaction(paystack.fetch_transaction(reference)) or payment
            except paystack.PaystackError as exc:
                logger.warning("Verify failed for %s: %s", reference, exc)

        booking = Booking.objects.select_related("service", "frequency").get(pk=payment.booking_id)
        return Response({"payment_status": payment.status, "booking": public_booking(booking)})


@csrf_exempt
@require_POST
def paystack_webhook(request):
    if not paystack.signature_is_valid(request.body, request.headers.get("x-paystack-signature", "")):
        return HttpResponseBadRequest("invalid signature")
    try:
        event = json.loads(request.body)
    except ValueError:
        return HttpResponseBadRequest("invalid json")

    if event.get("event") == "charge.success":
        paystack.apply_transaction(event.get("data") or {})
    return HttpResponse("ok")

