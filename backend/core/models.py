from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class SiteSettings(models.Model):
    """Single row of business-wide settings, edited in the admin."""

    business_name = models.CharField(max_length=120, default="Kleandeck")
    whatsapp_number = models.CharField(
        max_length=20,
        blank=True,
        help_text="International format without '+' or spaces, e.g. 2348012345678. Used for wa.me links.",
    )
    phone_number = models.CharField(max_length=30, blank=True, help_text="Shown on the site, e.g. +234 801 234 5678")
    email = models.EmailField(blank=True, help_text="Public contact email.")
    notification_emails = models.CharField(
        max_length=500,
        blank=True,
        help_text="Comma-separated addresses that get an email for every paid booking, quote request and application.",
    )
    address = models.CharField(max_length=255, blank=True)
    coverage_text = models.CharField(max_length=255, default="Serving businesses across Lagos")

    vat_enabled = models.BooleanField(default=True)
    vat_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("7.50"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
        help_text="Percent. Nigerian standard VAT is 7.5%.",
    )
    min_booking_lead_days = models.PositiveSmallIntegerField(
        default=1, help_text="Earliest bookable date, in days from today."
    )

    terms_content = models.TextField(
        blank=True,
        help_text="Terms and conditions shown on /terms. Markdown: '## Heading', blank line between paragraphs, '- ' for bullets.",
    )
    terms_updated_on = models.DateField(null=True, blank=True)
    setup_done = models.JSONField(
        default=list, blank=True, help_text="Getting-started steps an owner has ticked off by hand (admin dashboard)."
    )

    class Meta:
        verbose_name = "Site settings"
        verbose_name_plural = "Site settings"

    def __str__(self) -> str:
        return "Site settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "SiteSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    @property
    def notification_list(self) -> list[str]:
        return [e.strip() for e in self.notification_emails.split(",") if e.strip()]


class FAQ(models.Model):
    question = models.CharField(max_length=255)
    answer = models.TextField()
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    show_on_homepage = models.BooleanField(default=False)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "FAQ"
        verbose_name_plural = "FAQs"

    def __str__(self) -> str:
        return self.question


class Application(models.Model):
    """Job applications (careers page) and training-academy enquiries."""

    class Kind(models.TextChoices):
        JOB = "job", "Job application"
        ACADEMY = "academy", "Academy enquiry"

    class Status(models.TextChoices):
        NEW = "new", "New"
        CONTACTED = "contacted", "Contacted"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"

    kind = models.CharField(max_length=10, choices=Kind.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.NEW)
    full_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=30)
    email = models.EmailField(blank=True)
    role = models.CharField(max_length=80, blank=True, help_text="Role applied for (job applications).")
    location = models.CharField(max_length=120, blank=True, help_text="Where in Lagos they live.")
    experience = models.CharField(max_length=80, blank=True)
    message = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.full_name} ({self.get_kind_display()})"
