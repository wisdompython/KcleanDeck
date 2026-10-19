from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from bookings.models import Booking, Cleaner, Payment
from bookings.pricing import quote_for
from core.models import FAQ, Application, SiteSettings
from pricing.engine import PricingError
from pricing.models import (
    AddOn,
    FrequencyOption,
    PricingUnit,
    Service,
    ServiceArea,
    ServiceAreaPrice,
    ServiceCategory,
    TimeSlot,
)
from staff.permissions import GROUP_NAMES, OWNER, STAFF, role_of

User = get_user_model()


# --- Bookings ---------------------------------------------------------------


class CleanerRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cleaner
        fields = ["id", "full_name", "phone", "role"]


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["id", "reference", "amount", "status", "channel", "paid_at", "created_at", "authorization_url"]


class BookingListSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name")
    area_name = serializers.CharField(source="area.name", default=None)
    frequency_label = serializers.CharField(source="frequency.label", default=None)
    customer_name = serializers.CharField()
    cleaners = CleanerRefSerializer(many=True)
    time_slot_label = serializers.CharField(read_only=True)

    class Meta:
        model = Booking
        fields = [
            "reference", "status", "payment_status", "source", "customer_name", "company_name", "contact_name",
            "phone", "email", "service_name", "frequency_label", "area_name", "scheduled_date", "time_slot",
            "time_slot_label", "total", "amount_paid", "balance_due", "deposit_amount", "cleaners",
            "site_requirements_confirmed", "created_at",
        ]


class BookingDetailSerializer(BookingListSerializer):
    service = serializers.SlugRelatedField(slug_field="slug", read_only=True)
    service_pricing_method = serializers.CharField(source="service.pricing_method")
    payments = PaymentSerializer(many=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta(BookingListSerializer.Meta):
        fields = BookingListSerializer.Meta.fields + [
            "service", "service_pricing_method", "frequency", "area", "inputs", "pricing_mode", "price_breakdown",
            "subtotal", "vat_exempt", "vat_rate", "vat_amount", "address", "site_notes", "terms_accepted_at",
            "payment_method", "paid_at", "payment_link", "internal_notes", "payments", "created_by_name",
            "updated_at",
        ]

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        return obj.created_by.get_full_name() or obj.created_by.email or obj.created_by.username


class BookingWriteSerializer(serializers.ModelSerializer):
    """Create/update a booking from the admin. Price is always recomputed
    server-side: from the rate card (calculated) or from an agreed subtotal."""

    service = serializers.SlugRelatedField(slug_field="slug", queryset=Service.objects.all())
    cleaners = serializers.PrimaryKeyRelatedField(queryset=Cleaner.objects.all(), many=True, required=False)
    subtotal = serializers.IntegerField(min_value=0, required=False, allow_null=True)

    PRICE_FIELDS = {"service", "frequency", "area", "inputs", "pricing_mode", "subtotal", "vat_exempt"}

    class Meta:
        model = Booking
        fields = [
            "status", "service", "frequency", "area", "inputs", "pricing_mode", "subtotal", "vat_exempt",
            "company_name", "contact_name", "email", "phone", "address", "site_notes", "scheduled_date",
            "time_slot", "site_requirements_confirmed", "cleaners", "internal_notes",
        ]

    def validate_time_slot(self, value):
        if value and not TimeSlot.objects.filter(key=value).exists():
            raise serializers.ValidationError("Choose one of the time slots in Settings.")
        return value

    def validate(self, attrs):
        if attrs.get("subtotal", 0) is None:
            attrs.pop("subtotal")  # rate-card bookings send no agreed price
        instance = self.instance
        if instance is not None and not (self.PRICE_FIELDS & attrs.keys()):
            return attrs  # nothing price-related changed

        def pick(name):
            return attrs[name] if name in attrs else getattr(instance, name, None)

        service = pick("service")
        mode = pick("pricing_mode") or Booking.PricingMode.MANUAL
        if mode == Booking.PricingMode.CALCULATED:
            try:
                self._quote = quote_for(service, pick("frequency"), pick("area"), pick("inputs"))
            except PricingError as exc:
                raise serializers.ValidationError({"inputs": str(exc)}) from exc
        else:
            subtotal = pick("subtotal")
            if not subtotal:
                raise serializers.ValidationError({"subtotal": "Enter the agreed price (before VAT)."})
        return attrs

    def _apply_price(self, booking):
        if booking.pricing_mode == Booking.PricingMode.CALCULATED and hasattr(self, "_quote"):
            booking.apply_quote(self._quote)
        elif booking.pricing_mode == Booking.PricingMode.MANUAL:
            booking.apply_manual_price()

    @transaction.atomic
    def create(self, validated_data):
        cleaners = validated_data.pop("cleaners", [])
        booking = Booking(**validated_data)
        booking.source = Booking.Source.MANUAL
        booking.created_by = self.context["request"].user
        self._apply_price(booking)
        booking.save()
        booking.cleaners.set(cleaners)
        return booking

    @transaction.atomic
    def update(self, booking, validated_data):
        cleaners = validated_data.pop("cleaners", None)
        price_changed = bool(self.PRICE_FIELDS & validated_data.keys())
        for key, value in validated_data.items():
            setattr(booking, key, value)
        if price_changed:
            self._apply_price(booking)
        booking.save()
        if cleaners is not None:
            booking.cleaners.set(cleaners)
        return booking


class RecordPaymentSerializer(serializers.Serializer):
    method = serializers.ChoiceField(
        choices=[c for c in Booking.PaymentMethod.choices if c[0] != Booking.PaymentMethod.PAYSTACK]
    )
    amount = serializers.IntegerField(min_value=1, required=False, help_text="Defaults to the balance due.")


# --- Cleaners & applications -----------------------------------------------


class CleanerSerializer(serializers.ModelSerializer):
    upcoming_jobs = serializers.IntegerField(read_only=True, default=0)
    completed_jobs = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Cleaner
        fields = ["id", "full_name", "phone", "role", "is_active", "notes", "joined_on", "upcoming_jobs", "completed_jobs"]


class ApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = [
            "id", "kind", "status", "full_name", "phone", "email", "role", "location", "experience", "message",
            "internal_notes", "created_at",
        ]
        read_only_fields = ["kind", "full_name", "phone", "email", "role", "location", "experience", "message",
                            "created_at"]


# --- Pricing configuration --------------------------------------------------


class UnitWriteSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = PricingUnit
        fields = ["id", "label", "help_text", "price", "min_qty", "max_qty", "default_qty", "sort_order"]

    def validate(self, attrs):
        if not attrs["min_qty"] <= attrs["default_qty"] <= attrs["max_qty"]:
            raise serializers.ValidationError(f"{attrs['label']}: default must be between min and max.")
        return attrs


class AddOnWriteSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = AddOn
        fields = ["id", "label", "price", "is_active", "sort_order"]


class AreaPriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceAreaPrice
        fields = ["area", "surcharge"]


class ServiceAdminSerializer(serializers.ModelSerializer):
    units = UnitWriteSerializer(many=True, required=False)
    addons = AddOnWriteSerializer(many=True, required=False)
    frequencies = serializers.PrimaryKeyRelatedField(queryset=FrequencyOption.objects.all(), many=True, required=False)
    starting_price = serializers.SerializerMethodField()
    booking_count = serializers.IntegerField(read_only=True, default=0)
    time_slots = serializers.PrimaryKeyRelatedField(queryset=TimeSlot.objects.all(), many=True, required=False)
    categories = serializers.PrimaryKeyRelatedField(
        queryset=ServiceCategory.objects.all(), many=True, required=False
    )
    area_prices = AreaPriceSerializer(many=True, required=False)
    photo_url = serializers.CharField(source="image_url", read_only=True)
    photo_card_url = serializers.CharField(source="image_card_url", read_only=True)
    has_photo = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = [
            "id", "name", "slug", "tagline", "description", "includes", "badge", "image", "pricing_method",
            "base_price", "rate_per_sqm", "min_area_sqm", "max_area_sqm", "minimum_charge", "quote_threshold",
            "price_suffix", "frequencies", "sort_order", "is_active", "units", "addons", "starting_price",
            "booking_count", "time_slots", "min_lead_days", "deposit_percent", "categories", "area_prices",
            "photo_url", "photo_card_url", "photo_width", "has_photo",
        ]
        read_only_fields = ["photo_width"]

    def get_has_photo(self, obj):
        return bool(obj.photo)

    def get_starting_price(self, obj):
        return obj.starting_price()

    def validate_area_prices(self, rows):
        areas = [row["area"].pk for row in rows]
        if len(areas) != len(set(areas)):
            raise serializers.ValidationError("Each area can only have one surcharge.")
        return rows

    def validate(self, attrs):
        lo = attrs.get("min_area_sqm", getattr(self.instance, "min_area_sqm", 0))
        hi = attrs.get("max_area_sqm", getattr(self.instance, "max_area_sqm", 0))
        if lo > hi:
            raise serializers.ValidationError({"max_area_sqm": "Must be at least the minimum area."})
        return attrs

    @staticmethod
    def _sync(model, service, rows):
        """Upsert child rows by id; delete rows no longer present."""
        keep = []
        for i, row in enumerate(rows):
            row = {**row, "sort_order": row.get("sort_order", i)}
            row_id = row.pop("id", None)
            obj = model.objects.filter(service=service, pk=row_id).first() if row_id else None
            if obj is None:
                obj = model(service=service)
            for key, value in row.items():
                setattr(obj, key, value)
            obj.save()
            keep.append(obj.pk)
        model.objects.filter(service=service).exclude(pk__in=keep).delete()

    RELATED = ("units", "addons", "frequencies", "time_slots", "categories", "area_prices")

    @staticmethod
    def _set_relations(service, related):
        for name in ("frequencies", "time_slots", "categories"):
            if related[name] is not None:
                getattr(service, name).set(related[name])
        if related["area_prices"] is not None:
            service.area_prices.all().delete()
            ServiceAreaPrice.objects.bulk_create(
                ServiceAreaPrice(service=service, area=row["area"], surcharge=row["surcharge"])
                for row in related["area_prices"]
            )

    @transaction.atomic
    def create(self, validated_data):
        related = {k: validated_data.pop(k, None) for k in self.RELATED}
        service = Service.objects.create(**validated_data)
        self._sync(PricingUnit, service, related["units"] or [])
        self._sync(AddOn, service, related["addons"] or [])
        self._set_relations(service, related)
        return service

    @transaction.atomic
    def update(self, service, validated_data):
        related = {k: validated_data.pop(k, None) for k in self.RELATED}
        for key, value in validated_data.items():
            setattr(service, key, value)
        service.save()
        if related["units"] is not None:
            self._sync(PricingUnit, service, related["units"])
        if related["addons"] is not None:
            self._sync(AddOn, service, related["addons"])
        self._set_relations(service, related)
        return service

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["units"] = UnitWriteSerializer(instance.units.all(), many=True).data
        data["addons"] = AddOnWriteSerializer(instance.addons.all(), many=True).data
        data["area_prices"] = AreaPriceSerializer(instance.area_prices.all(), many=True).data
        return data


class CategoryAdminSerializer(serializers.ModelSerializer):
    services = serializers.PrimaryKeyRelatedField(queryset=Service.objects.all(), many=True, required=False)
    photo_url = serializers.CharField(source="image_url", read_only=True)
    photo_card_url = serializers.CharField(source="image_card_url", read_only=True)
    has_photo = serializers.SerializerMethodField()

    class Meta:
        model = ServiceCategory
        fields = [
            "id", "name", "slug", "buyer", "description", "cta_label", "services", "primary_service", "image",
            "sort_order", "is_active", "photo_url", "photo_card_url", "photo_width", "has_photo",
        ]
        read_only_fields = ["photo_width"]

    def get_has_photo(self, obj):
        return bool(obj.photo)

    def validate(self, attrs):
        primary = attrs.get("primary_service", getattr(self.instance, "primary_service", None))
        services = attrs.get("services")
        if services is None and self.instance:
            services = list(self.instance.services.all())
        if primary and services is not None and primary not in services:
            raise serializers.ValidationError(
                {"primary_service": "The button must open one of the category's own services."}
            )
        return attrs


class TimeSlotAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeSlot
        fields = ["id", "key", "label", "hint", "sort_order", "is_active"]


class FrequencyAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = FrequencyOption
        fields = ["id", "label", "slug", "description", "discount_percent", "visits_per_payment", "sort_order",
                  "is_active"]


class AreaAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceArea
        fields = ["id", "name", "surcharge", "sort_order", "is_active"]


class FAQAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = ["id", "question", "answer", "sort_order", "is_active", "show_on_homepage"]


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = [
            "business_name", "whatsapp_number", "phone_number", "email", "notification_emails", "address",
            "coverage_text", "vat_enabled", "vat_rate", "min_booking_lead_days", "terms_content", "terms_updated_on",
        ]

    def validate_whatsapp_number(self, value):
        digits = "".join(ch for ch in value if ch.isdigit())
        if value and len(digits) < 10:
            raise serializers.ValidationError("Use international format, e.g. 2348012345678.")
        return digits


# --- Team -------------------------------------------------------------------


class TeamMemberSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name", max_length=150)
    role = serializers.ChoiceField(choices=[OWNER, STAFF], write_only=True)
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = ["id", "name", "email", "role", "is_active", "last_login", "password"]
        read_only_fields = ["last_login"]
        extra_kwargs = {"email": {"required": True}}

    def validate_email(self, value):
        value = value.strip().lower()
        qs = User.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Someone on the team already uses this email.")
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["role"] = role_of(instance) or STAFF
        return data

    @staticmethod
    def _set_role(user, role):
        from django.contrib.auth.models import Group

        user.groups.remove(*Group.objects.filter(name__in=GROUP_NAMES.values()))
        user.groups.add(Group.objects.get_or_create(name=GROUP_NAMES[role])[0])

    @transaction.atomic
    def create(self, validated_data):
        role = validated_data.pop("role")
        password = validated_data.pop("password")
        user = User(username=validated_data["email"], **validated_data)
        user.set_password(password)
        user.save()
        self._set_role(user, role)
        return user

    @transaction.atomic
    def update(self, user, validated_data):
        role = validated_data.pop("role", None)
        validated_data.pop("password", None)  # use the reset-password action
        for key, value in validated_data.items():
            setattr(user, key, value)
        if "email" in validated_data:
            user.username = validated_data["email"]
        user.save()
        if role and not user.is_superuser:
            self._set_role(user, role)
        return user
