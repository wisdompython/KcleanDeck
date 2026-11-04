from django import forms
from django.contrib import admin, messages
from django.utils import timezone
from django.utils.html import format_html, format_html_join

from bookings import paystack
from bookings.models import Booking, Cleaner, DiscountCode, Payment
from bookings.pricing import quote_for
from pricing.engine import PricingError
from pricing.models import Service


def naira(amount) -> str:
    return f"₦{amount:,}" if amount is not None else "—"


class BookingAdminForm(forms.ModelForm):
    class Meta:
        model = Booking
        fields = "__all__"

    def clean(self):
        data = super().clean()
        service = data.get("service")
        if not service:
            return data

        if data.get("pricing_mode") == Booking.PricingMode.CALCULATED:
            try:
                self.quote = quote_for(service, data.get("frequency"), data.get("area"), data.get("inputs"))
            except PricingError as exc:
                self.add_error("inputs", f"Can't calculate a price: {exc}")
        elif not data.get("subtotal"):
            self.add_error("subtotal", "Enter the agreed price (before VAT).")
        return data


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    can_delete = False
    fields = ["reference", "amount", "status", "channel", "paid_at", "created_at"]
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    form = BookingAdminForm
    list_display = [
        "reference", "customer", "service", "scheduled_date", "time_slot",
        "status_badge", "payment_badge", "total_display", "source",
    ]
    list_filter = ["status", "payment_status", "source", "service", "area", "scheduled_date"]
    list_select_related = ["service", "area"]
    search_fields = ["reference", "company_name", "contact_name", "phone", "email", "address"]
    date_hierarchy = "scheduled_date"
    filter_horizontal = ["cleaners"]
    inlines = [PaymentInline]
    readonly_fields = [
        "reference", "source", "vat_rate", "vat_amount", "total", "breakdown_display", "unit_ids_help",
        "payment_link_display", "terms_accepted_at", "site_requirements_confirmed", "created_by", "created_at",
        "discount_code", "discount_amount", "updated_at",
    ]
    fieldsets = [
        (None, {"fields": [("reference", "source"), "status"]}),
        ("Customer", {"fields": ["company_name", ("contact_name", "phone"), "email", "address", "area"]}),
        (
            "Job",
            {"fields": ["service", "frequency", ("scheduled_date", "time_slot"), "site_notes"]},
        ),
        (
            "Price",
            {
                "description": (
                    "For deals agreed outside the website choose “Agreed price” and enter the amount before VAT. "
                    "To use the rate card, choose “Calculated” and fill in the calculator inputs."
                ),
                "fields": [
                    "pricing_mode", "subtotal", "vat_exempt", ("vat_rate", "vat_amount", "total"),
                    ("discount_code", "discount_amount"), "inputs", "unit_ids_help", "breakdown_display",
                ],
            },
        ),
        (
            "Payment",
            {"fields": [("payment_status", "payment_method"), ("amount_paid", "paid_at"), "payment_link_display"]},
        ),
        ("Team", {"fields": ["cleaners", "internal_notes"]}),
        (
            "Record",
            {
                "classes": ["collapse"],
                "fields": ["terms_accepted_at", "site_requirements_confirmed", "created_by", "created_at", "updated_at"],
            },
        ),
    ]
    actions = ["create_payment_link", "mark_paid_transfer", "mark_completed", "mark_cancelled"]

    def save_model(self, request, obj, form, change):
        if not change:
            obj.source = Booking.Source.MANUAL
            obj.created_by = request.user
        if obj.pricing_mode == Booking.PricingMode.CALCULATED and hasattr(form, "quote"):
            obj.apply_quote(form.quote)
        elif obj.pricing_mode == Booking.PricingMode.MANUAL:
            obj.apply_manual_price()
        super().save_model(request, obj, form, change)

    # --- list columns -------------------------------------------------------

    @admin.display(description="Customer", ordering="company_name")
    def customer(self, obj):
        return obj.customer_name

    @admin.display(description="Total", ordering="total")
    def total_display(self, obj):
        return naira(obj.total) if obj.total else "To quote"

    STATUS_COLOURS = {
        "quote_requested": ("#0284C7", "rgba(0,195,248,.12)"),
        "awaiting_payment": ("#D97706", "rgba(245,158,11,.12)"),
        "confirmed": ("#047857", "rgba(14,159,110,.12)"),
        "in_progress": ("#0A2540", "#DBEAFE"),
        "completed": ("#475569", "#F1F5F9"),
        "cancelled": ("#93000a", "#ffdad6"),
        "paid": ("#047857", "rgba(14,159,110,.12)"),
        "unpaid": ("#D97706", "rgba(245,158,11,.12)"),
        "refunded": ("#475569", "#F1F5F9"),
    }

    def _badge(self, key, label):
        fg, bg = self.STATUS_COLOURS.get(key, ("#475569", "#F1F5F9"))
        return format_html(
            '<span style="color:{};background:{};padding:2px 10px;border-radius:999px;font-weight:600;'
            'font-size:11px;white-space:nowrap">{}</span>',
            fg, bg, label,
        )

    @admin.display(description="Status", ordering="status")
    def status_badge(self, obj):
        return self._badge(obj.status, obj.get_status_display())

    @admin.display(description="Payment", ordering="payment_status")
    def payment_badge(self, obj):
        return self._badge(obj.payment_status, obj.get_payment_status_display())

    # --- read-only helpers --------------------------------------------------

    @admin.display(description="Price breakdown")
    def breakdown_display(self, obj):
        data = obj.price_breakdown or {}
        quote = data.get("estimate") or data
        if not quote.get("lines"):
            return "Agreed price" if data.get("manual") else "—"
        rows = [(line["label"], naira(line["amount"])) for line in quote["lines"]]
        if quote.get("discount_amount"):
            rows.append(("Frequency discount", f"−{naira(quote['discount_amount'])}"))
        if quote.get("minimum_applied"):
            rows.append(("Minimum charge applied", ""))
        if quote.get("area_surcharge"):
            rows.append(("Area surcharge", naira(quote["area_surcharge"])))
        rows.append((f"× {quote.get('visits', 1)} visit(s)", naira(quote.get("subtotal"))))
        title = "Customer's calculator estimate" if "estimate" in data else ""
        return format_html(
            "{}<table>{}</table>",
            format_html("<p><strong>{}</strong></p>", title) if title else "",
            format_html_join("", "<tr><td>{}</td><td style='text-align:right'>{}</td></tr>", rows),
        )

    @admin.display(description="Calculator unit IDs")
    def unit_ids_help(self, obj):
        services = Service.objects.prefetch_related("units", "addons").filter(is_active=True)
        items = []
        for s in services:
            if s.pricing_method == Service.PricingMethod.PER_UNIT:
                detail = ", ".join(f"{u.pk} = {u.label}" for u in s.units.all())
                items.append((s.name, f'"quantities": {{"<id>": <count>}} — {detail}'))
            elif s.pricing_method == Service.PricingMethod.PER_SQM:
                items.append((s.name, '"area_sqm": <square metres>'))
            addons = ", ".join(f"{a.pk} = {a.label}" for a in s.addons.all())
            if addons:
                items.append((s.name, f'"addon_ids": [<id>, …] — {addons}'))
        return format_html("<ul>{}</ul>", format_html_join("", "<li><strong>{}</strong>: {}</li>", items))

    @admin.display(description="Paystack link")
    def payment_link_display(self, obj):
        if not obj.payment_link:
            return "Use the “Create Paystack payment link” action to generate one."
        return format_html('<a href="{0}" target="_blank" rel="noopener">{0}</a>', obj.payment_link)

    # --- actions ------------------------------------------------------------

    @admin.action(description="Create Paystack payment link (send it on WhatsApp)")
    def create_payment_link(self, request, queryset):
        for booking in queryset:
            try:
                payment = paystack.initialize_payment(booking)
            except paystack.PaystackError as exc:
                self.message_user(request, f"{booking.reference}: {exc}", messages.ERROR)
                continue
            if booking.status == Booking.Status.QUOTE_REQUESTED:
                booking.status = Booking.Status.AWAITING_PAYMENT
                booking.save(update_fields=["status", "updated_at"])
            self.message_user(
                request,
                format_html("{}: payment link for {} — <a href='{}' target='_blank'>{}</a>",
                            booking.reference, naira(payment.amount), payment.authorization_url,
                            payment.authorization_url),
                messages.SUCCESS,
            )

    @admin.action(description="Mark as paid by bank transfer")
    def mark_paid_transfer(self, request, queryset):
        for booking in queryset.exclude(payment_status=Booking.PaymentStatus.PAID):
            booking.record_offline_payment(booking.balance_due, Booking.PaymentMethod.BANK_TRANSFER)
            booking.save()
        self.message_user(request, "Marked as paid.")

    @admin.action(description="Mark as completed")
    def mark_completed(self, request, queryset):
        queryset.update(status=Booking.Status.COMPLETED, updated_at=timezone.now())

    @admin.action(description="Cancel booking")
    def mark_cancelled(self, request, queryset):
        queryset.update(status=Booking.Status.CANCELLED, updated_at=timezone.now())


@admin.register(Cleaner)
class CleanerAdmin(admin.ModelAdmin):
    list_display = ["full_name", "role", "phone", "is_active", "upcoming_jobs"]
    list_filter = ["is_active", "role"]
    search_fields = ["full_name", "phone"]

    @admin.display(description="Upcoming jobs")
    def upcoming_jobs(self, obj):
        return obj.bookings.filter(
            scheduled_date__gte=timezone.localdate(),
            status__in=[Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS],
        ).count()


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["reference", "booking", "amount", "status", "channel", "paid_at", "created_at"]
    list_filter = ["status", "channel"]
    search_fields = ["reference", "booking__reference"]
    readonly_fields = [f.name for f in Payment._meta.fields]

    def has_add_permission(self, request):
        return False


@admin.register(DiscountCode)
class DiscountCodeAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "kind", "value", "redemptions", "usage_limit", "expires_at", "is_active"]
    list_filter = ["is_active", "kind"]
    search_fields = ["code", "name"]
    filter_horizontal = ["services"]

    @admin.display(description="Uses")
    def redemptions(self, obj):
        return obj.redemption_count
