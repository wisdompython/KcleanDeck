from django.db.models import Prefetch
from rest_framework import generics, serializers
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from pricing.engine import PricingError, QuoteRequest, calculate
from pricing.models import AddOn, FrequencyOption, PricingUnit, Service, ServiceArea, ServiceCategory, TimeSlot


class FrequencySerializer(serializers.ModelSerializer):
    class Meta:
        model = FrequencyOption
        fields = ["id", "label", "slug", "description", "discount_percent", "visits_per_payment"]


class AreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceArea
        fields = ["id", "name", "surcharge"]


class TimeSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeSlot
        fields = ["key", "label", "hint"]


class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = PricingUnit
        fields = ["id", "label", "help_text", "price", "min_qty", "max_qty", "default_qty"]


class AddOnSerializer(serializers.ModelSerializer):
    class Meta:
        model = AddOn
        fields = ["id", "label", "price"]


class ServiceSerializer(serializers.ModelSerializer):
    units = UnitSerializer(many=True)
    addons = AddOnSerializer(many=True)
    frequencies = serializers.SerializerMethodField()
    includes = serializers.SerializerMethodField()
    starting_price = serializers.SerializerMethodField()
    image = serializers.CharField(source="image_url")
    image_card = serializers.CharField(source="image_card_url")
    time_slots = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = [
            "id", "name", "slug", "tagline", "description", "includes", "badge", "image", "image_card",
            "deposit_percent", "min_lead_days", "time_slots",
            "pricing_method", "base_price", "rate_per_sqm", "min_area_sqm", "max_area_sqm",
            "minimum_charge", "quote_threshold", "price_suffix", "starting_price",
            "units", "addons", "frequencies",
        ]

    def get_frequencies(self, obj):
        return FrequencySerializer(obj.available_frequencies(), many=True).data

    def get_time_slots(self, obj):
        return TimeSlotSerializer(obj.available_time_slots(), many=True).data

    def get_includes(self, obj):
        return obj.include_list()

    def get_starting_price(self, obj):
        return obj.starting_price()


def active_services():
    return Service.objects.filter(is_active=True).prefetch_related(
        "units",
        "frequencies",
        "time_slots",
        Prefetch("addons", queryset=AddOn.objects.filter(is_active=True)),
    )


class ServiceList(generics.ListAPIView):
    serializer_class = ServiceSerializer
    pagination_class = None

    def get_queryset(self):
        return active_services()


class ServiceDetail(generics.RetrieveAPIView):
    serializer_class = ServiceSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return active_services()


class CategorySerializer(serializers.ModelSerializer):
    image = serializers.CharField(source="image_url")
    image_card = serializers.CharField(source="image_card_url")
    service = serializers.SerializerMethodField()
    services = serializers.SerializerMethodField()

    class Meta:
        model = ServiceCategory
        fields = ["id", "name", "slug", "buyer", "description", "cta_label", "image", "image_card", "service", "services"]

    def get_service(self, obj):
        service = obj.button_service()
        return service.slug if service else None

    def get_services(self, obj):
        return [s.slug for s in obj.services.all() if s.is_active]


class CategoryList(generics.ListAPIView):
    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        return ServiceCategory.objects.filter(is_active=True).prefetch_related("services")


class QuoteInputSerializer(serializers.Serializer):
    """Calculator inputs. Shared by the quote, booking and quote-request APIs."""

    service = serializers.SlugRelatedField(slug_field="slug", queryset=Service.objects.filter(is_active=True))
    frequency = serializers.PrimaryKeyRelatedField(
        queryset=FrequencyOption.objects.filter(is_active=True), required=False, allow_null=True
    )
    area = serializers.PrimaryKeyRelatedField(
        queryset=ServiceArea.objects.filter(is_active=True), required=False, allow_null=True
    )
    quantities = serializers.DictField(child=serializers.IntegerField(min_value=0), required=False, default=dict)
    area_sqm = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    addon_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)

    def validate_quantities(self, value):
        try:
            return {int(k): v for k, v in value.items()}
        except ValueError as exc:
            raise serializers.ValidationError("Quantities must be keyed by unit id.") from exc

    def to_quote_request(self) -> QuoteRequest:
        d = self.validated_data
        return QuoteRequest(
            service=d["service"],
            frequency=d.get("frequency"),
            area=d.get("area"),
            quantities=d.get("quantities", {}),
            area_sqm=d.get("area_sqm"),
            addon_ids=d.get("addon_ids", []),
        )

    def calculate(self):
        try:
            return calculate(self.to_quote_request())
        except PricingError as exc:
            raise serializers.ValidationError({"detail": str(exc)}) from exc

    def inputs_json(self) -> dict:
        d = self.validated_data
        return {
            "quantities": {str(k): v for k, v in d.get("quantities", {}).items()},
            "area_sqm": d.get("area_sqm"),
            "addon_ids": d.get("addon_ids", []),
        }


class QuoteView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "quote"

    def post(self, request):
        ser = QuoteInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return Response(ser.calculate().as_dict())
