from django.contrib import admin
from django.shortcuts import redirect
from django.urls import reverse

from core.models import FAQ, Application, SiteSettings


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    fieldsets = [
        ("Business", {"fields": ["business_name", "coverage_text", "address"]}),
        ("Contact", {"fields": ["whatsapp_number", "phone_number", "email", "notification_emails"]}),
        ("Tax & booking", {"fields": ["vat_enabled", "vat_rate", "min_booking_lead_days"]}),
        ("Terms and conditions", {"fields": ["terms_content", "terms_updated_on"]}),
    ]

    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        return redirect(reverse("admin:core_sitesettings_change", args=[SiteSettings.load().pk]))


@admin.register(FAQ)
class FAQAdmin(admin.ModelAdmin):
    list_display = ["question", "show_on_homepage", "is_active", "sort_order"]
    list_editable = ["show_on_homepage", "is_active", "sort_order"]


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ["full_name", "kind", "role", "phone", "location", "status", "created_at"]
    list_filter = ["kind", "status"]
    list_editable = ["status"]
    search_fields = ["full_name", "phone", "email"]
    readonly_fields = ["created_at"]
