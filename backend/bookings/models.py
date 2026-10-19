import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone

from pricing.models import FrequencyOption, Service, ServiceArea

REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I


def generate_reference() -> str:
    return "KD-" + "".join(secrets.choice(REFERENCE_ALPHABET) for _ in range(7))


class Cleaner(models.Model):
    full_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=30, blank=True)
    role = models.CharField(max_length=60, default="Cleaner", help_text="e.g. Cleaner, Supervisor, Office assistant")
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    joined_on = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self) -> str:
        return self.full_name


class Booking(models.Model):
    class Source(models.TextChoices):
        ONLINE = "online", "Online checkout"
        QUOTE = "quote", "WhatsApp quote request"
        MANUAL = "manual", "Entered by staff"

    class Status(models.TextChoices):
        QUOTE_REQUESTED = "quote_requested", "Quote requested"
        AWAITING_PAYMENT = "awaiting_payment", "Awaiting payment"
        CONFIRMED = "confirmed", "Confirmed"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    class PaymentStatus(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        PART_PAID = "part_paid", "Part paid"
        PAID = "paid", "Paid"
        REFUNDED = "refunded", "Refunded"

    class PaymentMethod(models.TextChoices):
        PAYSTACK = "paystack", "Paystack"
        BANK_TRANSFER = "bank_transfer", "Bank transfer"
        CASH = "cash", "Cash"
        OTHER = "other", "Other"

    class PricingMode(models.TextChoices):
        CALCULATED = "calculated", "Calculated from rates"
        MANUAL = "manual", "Agreed price (entered manually)"

    reference = models.CharField(max_length=12, unique=True, default=generate_reference, editable=False)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.MANUAL)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AWAITING_PAYMENT)

    service = models.ForeignKey(Service, on_delete=models.PROTECT, related_name="bookings")
    frequency = models.ForeignKey(FrequencyOption, on_delete=models.SET_NULL, null=True, blank=True)
    area = models.ForeignKey(ServiceArea, on_delete=models.SET_NULL, null=True, blank=True)
    inputs = models.JSONField(
        default=dict,
        blank=True,
        help_text='Calculator inputs, e.g. {"quantities": {"3": 4}, "area_sqm": 120, "addon_ids": [2]}.',
    )

    pricing_mode = models.CharField(max_length=10, choices=PricingMode.choices, default=PricingMode.MANUAL)
    price_breakdown = models.JSONField(default=dict, blank=True, editable=False)
    subtotal = models.PositiveIntegerField(
        default=0, help_text="Naira, before VAT. For an agreed price, enter it here; VAT is added on save."
    )
    vat_exempt = models.BooleanField(default=False)
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0, editable=False)
    vat_amount = models.PositiveIntegerField(default=0, editable=False)
    total = models.PositiveIntegerField(default=0, editable=False)

    company_name = models.CharField(max_length=160, blank=True)
    contact_name = models.CharField(max_length=120)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30)
    address = models.CharField(max_length=255, blank=True)
    site_notes = models.TextField(blank=True, help_text="Access, gate pass, floor, parking...")

    scheduled_date = models.DateField(null=True, blank=True)
    time_slot = models.CharField(max_length=30, blank=True, help_text="Key of a pricing.TimeSlot, e.g. morning")

    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    site_requirements_confirmed = models.BooleanField(
        default=False, help_text="Customer confirmed running water and electricity will be available."
    )

    payment_status = models.CharField(max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID)
    payment_method = models.CharField(max_length=15, choices=PaymentMethod.choices, blank=True)
    amount_paid = models.PositiveIntegerField(default=0)
    deposit_amount = models.PositiveIntegerField(
        default=0, help_text="Amount that confirms the booking when a deposit applies. 0 means the full total."
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_link = models.URLField(blank=True, editable=False)

    cleaners = models.ManyToManyField(Cleaner, blank=True, related_name="bookings")
    internal_notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, editable=False
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status"]), models.Index(fields=["scheduled_date"])]

    def __str__(self) -> str:
        return f"{self.reference} · {self.company_name or self.contact_name}"

    @property
    def customer_name(self) -> str:
        return self.company_name or self.contact_name

    @property
    def balance_due(self) -> int:
        return max(self.total - self.amount_paid, 0)

    @property
    def time_slot_label(self) -> str:
        from pricing.models import TimeSlot

        return TimeSlot.label_for(self.time_slot)

    def apply_quote(self, quote) -> None:
        """Copy a pricing.engine.Quote onto the booking."""
        self.pricing_mode = self.PricingMode.CALCULATED
        self.price_breakdown = quote.as_dict()
        self.subtotal = quote.subtotal
        if self.vat_exempt:
            self.vat_rate, self.vat_amount = 0, 0
        else:
            self.vat_rate, self.vat_amount = quote.vat_rate, quote.vat_amount
        self.total = self.subtotal + self.vat_amount

    def apply_manual_price(self) -> None:
        """Recompute VAT and total from a manually entered subtotal."""
        from pricing.engine import vat_for

        if self.vat_exempt:
            self.vat_rate, self.vat_amount = 0, 0
        else:
            self.vat_rate, self.vat_amount = vat_for(self.subtotal)
        self.total = self.subtotal + self.vat_amount
        self.price_breakdown = {"manual": True, "subtotal": self.subtotal}

    def record_offline_payment(self, amount: int, method: str, when=None) -> "Payment":
        """Record money received outside Paystack (transfer, cash). Caller saves the booking."""
        when = when or timezone.now()
        payment = Payment.objects.create(
            booking=self,
            reference=f"{self.reference}-M{secrets.token_hex(3).upper()}",
            amount=amount,
            status=Payment.Status.SUCCESS,
            channel=method,
            paid_at=when,
        )
        self.register_payment(amount, method, when)
        return payment

    def register_payment(self, amount: int, method: str, when=None) -> None:
        """Add a received amount. Fully covered → paid; otherwise part paid. The
        booking is confirmed once the deposit (or, without one, the total) is covered."""
        self.amount_paid += amount
        self.payment_method = method
        self.paid_at = when or timezone.now()
        self.payment_status = self.PaymentStatus.PAID if self.amount_paid >= self.total else self.PaymentStatus.PART_PAID
        required = self.deposit_amount or self.total
        if self.amount_paid >= required and self.status in {self.Status.AWAITING_PAYMENT, self.Status.QUOTE_REQUESTED}:
            self.status = self.Status.CONFIRMED


class Payment(models.Model):
    """One Paystack transaction attempt for a booking."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"
        ABANDONED = "abandoned", "Abandoned"

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="payments")
    reference = models.CharField(max_length=40, unique=True)
    amount = models.PositiveIntegerField(help_text="Naira")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    authorization_url = models.URLField(blank=True)
    channel = models.CharField(max_length=30, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    gateway_response = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.reference} ({self.get_status_display()})"
