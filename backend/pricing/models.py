"""Admin-configurable pricing.

All money is stored as whole naira (integers). Paystack amounts are converted
to kobo only at the payment boundary.

How a price is built (see pricing/engine.py):

    service amount = method-specific base (flat / per unit / per m²) + add-ons
    per visit      = max(minimum charge, service amount − frequency discount) + area surcharge
                     (the service's own surcharge for that area if set, else the area's default)
    subtotal       = per visit × visits covered by one payment
    total          = subtotal + VAT
"""

from decimal import ROUND_HALF_UP, Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core.images import card_url


class PhotoMixin(models.Model):
    """An uploaded photo (resized on upload, see core/images.py) with a
    fallback image path for the starter photos shipped with the website."""

    image = models.CharField(
        max_length=255, blank=True, help_text="Fallback image path on the website, e.g. /images/services/deep.jpg"
    )
    photo = models.ImageField(upload_to="uploads/", blank=True)
    photo_width = models.PositiveIntegerField(default=0, editable=False)

    class Meta:
        abstract = True

    @property
    def image_url(self) -> str:
        return self.photo.url if self.photo else self.image

    @property
    def image_card_url(self) -> str:
        return card_url(self.photo.url) if self.photo else self.image


class TimeSlot(models.Model):
    """An arrival window customers can pick, e.g. Morning (8am – 12pm)."""

    key = models.SlugField(max_length=30, unique=True, help_text="Short code stored on bookings, e.g. morning")
    label = models.CharField(max_length=40)
    hint = models.CharField(max_length=40, blank=True, help_text="e.g. 8am – 12pm")
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return f"{self.label} ({self.hint})" if self.hint else self.label

    @classmethod
    def label_for(cls, key: str) -> str:
        if not key:
            return ""
        slot = cls.objects.filter(key=key).first()
        return str(slot) if slot else key.replace("_", " ").capitalize()


class FrequencyOption(models.Model):
    label = models.CharField(max_length=60, help_text="e.g. One-off, Weekly, Every two weeks, Monthly")
    slug = models.SlugField(unique=True)
    description = models.CharField(max_length=160, blank=True)
    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
        help_text="Discount on each visit, in percent.",
    )
    visits_per_payment = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text="How many visits one payment covers. e.g. weekly billed monthly = 4.",
    )
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return self.label


class ServiceArea(models.Model):
    name = models.CharField(max_length=80, unique=True)
    surcharge = models.PositiveIntegerField(
        default=0, help_text="Naira added per visit for this area (e.g. transport). 0 for none."
    )
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name


class Service(PhotoMixin):
    class PricingMethod(models.TextChoices):
        FLAT = "flat", "Flat price per visit"
        PER_UNIT = "per_unit", "Base + price per room/unit"
        PER_SQM = "per_sqm", "Base + price per square metre"
        QUOTE = "quote", "Custom quote only (WhatsApp)"

    name = models.CharField(max_length=80)
    slug = models.SlugField(unique=True)
    tagline = models.CharField(max_length=160, help_text="One line shown on cards.")
    description = models.TextField(blank=True)
    includes = models.TextField(blank=True, help_text="What's included — one item per line.")
    badge = models.CharField(max_length=30, blank=True, help_text="Optional label, e.g. 'Most popular'.")

    pricing_method = models.CharField(max_length=10, choices=PricingMethod.choices, default=PricingMethod.PER_UNIT)
    base_price = models.PositiveIntegerField(default=0, help_text="Naira. Starting amount before rooms/area.")
    rate_per_sqm = models.PositiveIntegerField(default=0, help_text="Naira per m² (per m² pricing only).")
    min_area_sqm = models.PositiveIntegerField(default=10, help_text="Smallest area accepted (per m² pricing only).")
    max_area_sqm = models.PositiveIntegerField(default=5000, help_text="Largest area accepted (per m² pricing only).")
    minimum_charge = models.PositiveIntegerField(default=0, help_text="Naira. A visit never costs less than this.")
    quote_threshold = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="If the price before VAT goes above this, the customer is sent to WhatsApp for a quote "
        "instead of paying online. Leave blank for no limit.",
    )
    price_suffix = models.CharField(max_length=30, default="per visit")
    frequencies = models.ManyToManyField(
        FrequencyOption, blank=True, help_text="Frequencies offered for this service. Leave empty to offer all."
    )
    time_slots = models.ManyToManyField(
        TimeSlot, blank=True, help_text="Arrival windows offered for this service. Leave empty to offer all."
    )
    min_lead_days = models.PositiveSmallIntegerField(
        null=True, blank=True, help_text="Earliest booking, in days from today. Blank uses the site default."
    )
    deposit_percent = models.PositiveSmallIntegerField(
        default=0,
        validators=[MaxValueValidator(100)],
        help_text="Share of the total paid online to confirm (e.g. 30). 0 means the full amount is paid upfront.",
    )

    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return self.name

    @property
    def is_quote_only(self) -> bool:
        return self.pricing_method == self.PricingMethod.QUOTE

    def available_frequencies(self):
        qs = self.frequencies.filter(is_active=True)
        if not qs.exists():
            qs = FrequencyOption.objects.filter(is_active=True)
        return qs.order_by("sort_order", "id")

    def available_time_slots(self):
        qs = self.time_slots.filter(is_active=True)
        if not qs.exists():
            qs = TimeSlot.objects.filter(is_active=True)
        return qs.order_by("sort_order", "id")

    def surcharge_for(self, area: "ServiceArea | None") -> int:
        if area is None:
            return 0
        override = self.area_prices.filter(area=area).first()
        return override.surcharge if override else area.surcharge

    def deposit_for(self, total: int) -> int:
        """Amount to pay online for a booking of this total (the full total when no deposit is set)."""
        if not self.deposit_percent or self.deposit_percent >= 100:
            return total
        # Half-up, matching the amount the website shows (Python's round() is half-even).
        return int((Decimal(total) * self.deposit_percent / 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

    def starting_price(self) -> int | None:
        """Lowest one-visit price before VAT, for 'From ₦…' labels."""
        if self.is_quote_only:
            return None
        amount = self.base_price
        if self.pricing_method == self.PricingMethod.PER_UNIT:
            amount += sum(u.price * u.min_qty for u in self.units.all())
        elif self.pricing_method == self.PricingMethod.PER_SQM:
            amount += self.rate_per_sqm * self.min_area_sqm
        return max(amount, self.minimum_charge)

    def include_list(self) -> list[str]:
        return [line.strip("-• ").strip() for line in self.includes.splitlines() if line.strip()]


class PricingUnit(models.Model):
    """A countable thing the customer enters, e.g. rooms, restrooms, floors."""

    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="units")
    label = models.CharField(max_length=60, help_text="e.g. Rooms / work bays")
    help_text = models.CharField(max_length=120, blank=True)
    price = models.PositiveIntegerField(help_text="Naira per unit, per visit.")
    min_qty = models.PositiveSmallIntegerField(default=0)
    max_qty = models.PositiveSmallIntegerField(default=50)
    default_qty = models.PositiveSmallIntegerField(default=1)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return f"{self.service.name}: {self.label}"


class AddOn(models.Model):
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="addons")
    label = models.CharField(max_length=80)
    price = models.PositiveIntegerField(help_text="Naira, per visit.")
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "add-on"

    def __str__(self) -> str:
        return f"{self.label} (+₦{self.price:,})"


class ServiceAreaPrice(models.Model):
    """A service-specific surcharge for an area, overriding the area's default."""

    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="area_prices")
    area = models.ForeignKey(ServiceArea, on_delete=models.CASCADE, related_name="service_prices")
    surcharge = models.PositiveIntegerField(help_text="Naira per visit for this service in this area.")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["service", "area"], name="unique_service_area_price")]

    def __str__(self) -> str:
        return f"{self.service} · {self.area}: ₦{self.surcharge:,}"


class ServiceCategory(PhotoMixin):
    """A homepage use case, e.g. Corporate offices, grouping the services it needs."""

    name = models.CharField(max_length=80)
    slug = models.SlugField(unique=True)
    buyer = models.CharField(max_length=120, blank=True, help_text="Who buys it, e.g. Office and facility managers")
    description = models.TextField(blank=True)
    cta_label = models.CharField(max_length=40, blank=True, help_text="Button text, e.g. Price an office clean")
    services = models.ManyToManyField(Service, blank=True, related_name="categories")
    primary_service = models.ForeignKey(
        Service,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        help_text="The service the category's button opens. Defaults to its first live service.",
    )
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name_plural = "service categories"

    def __str__(self) -> str:
        return self.name

    def button_service(self):
        """The service the category's button opens."""
        if self.primary_service and self.primary_service.is_active:
            return self.primary_service
        return self.services.filter(is_active=True).order_by("sort_order", "id").first()
