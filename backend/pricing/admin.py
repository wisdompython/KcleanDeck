from django.contrib import admin

from pricing.models import AddOn, FrequencyOption, PricingUnit, Service, ServiceArea


class PricingUnitInline(admin.TabularInline):
    model = PricingUnit
    extra = 0
    fields = ["label", "price", "min_qty", "default_qty", "max_qty", "help_text", "sort_order"]


class AddOnInline(admin.TabularInline):
    model = AddOn
    extra = 0
    fields = ["label", "price", "is_active", "sort_order"]


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ["name", "pricing_method", "starting_price_display", "quote_threshold", "is_active", "sort_order"]
    list_editable = ["is_active", "sort_order"]
    prepopulated_fields = {"slug": ["name"]}
    filter_horizontal = ["frequencies"]
    inlines = [PricingUnitInline, AddOnInline]
    fieldsets = [
        ("Card", {"fields": ["name", "slug", "tagline", "description", "includes", "badge", "image"]}),
        (
            "Pricing",
            {
                "description": (
                    "How the price is worked out: base price + (rooms/units below, or area × rate per m²) + add-ons, "
                    "minus the frequency discount, never below the minimum charge, plus the area surcharge. "
                    "VAT is added on top (set in Site settings)."
                ),
                "fields": [
                    "pricing_method",
                    "base_price",
                    ("rate_per_sqm", "min_area_sqm", "max_area_sqm"),
                    "minimum_charge",
                    "quote_threshold",
                    "price_suffix",
                    "frequencies",
                ],
            },
        ),
        ("Visibility", {"fields": ["is_active", "sort_order"]}),
    ]

    @admin.display(description="From (before VAT)")
    def starting_price_display(self, obj):
        price = obj.starting_price()
        return "Quote only" if price is None else f"₦{price:,}"


@admin.register(FrequencyOption)
class FrequencyOptionAdmin(admin.ModelAdmin):
    list_display = ["label", "discount_percent", "visits_per_payment", "is_active", "sort_order"]
    list_editable = ["discount_percent", "visits_per_payment", "is_active", "sort_order"]
    prepopulated_fields = {"slug": ["label"]}


@admin.register(ServiceArea)
class ServiceAreaAdmin(admin.ModelAdmin):
    list_display = ["name", "surcharge", "is_active", "sort_order"]
    list_editable = ["surcharge", "is_active", "sort_order"]
    search_fields = ["name"]
