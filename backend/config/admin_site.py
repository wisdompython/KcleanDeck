from datetime import timedelta

from django.contrib import admin
from django.db.models import Count, Q, Sum
from django.utils import timezone


class KleandeckAdminSite(admin.AdminSite):
    site_header = "Kleandeck admin"
    site_title = "Kleandeck admin"
    index_title = "Dashboard"
    index_template = "admin/kleandeck_index.html"

    def has_permission(self, request):
        # Backup tool only: the team uses the Next.js admin.
        return request.user.is_active and request.user.is_superuser

    def index(self, request, extra_context=None):
        from bookings.models import Booking
        from core.models import Application

        today = timezone.localdate()
        month_start = today.replace(day=1)
        active = [Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS]

        counts = Booking.objects.aggregate(
            today=Count("id", filter=Q(scheduled_date=today, status__in=active)),
            next_7_days=Count(
                "id", filter=Q(scheduled_date__gt=today, scheduled_date__lte=today + timedelta(days=7), status__in=active)
            ),
            awaiting_payment=Count("id", filter=Q(status=Booking.Status.AWAITING_PAYMENT)),
            quote_requests=Count("id", filter=Q(status=Booking.Status.QUOTE_REQUESTED)),
            unassigned=Count("id", filter=Q(status__in=active, scheduled_date__gte=today, cleaners__isnull=True)),
        )
        revenue = Booking.objects.filter(paid_at__date__gte=month_start).aggregate(total=Sum("amount_paid"))["total"]

        upcoming = (
            Booking.objects.filter(scheduled_date__gte=today, status__in=active)
            .select_related("service", "area")
            .prefetch_related("cleaners")
            .order_by("scheduled_date", "time_slot")[:10]
        )
        recent_quotes = Booking.objects.filter(status=Booking.Status.QUOTE_REQUESTED).select_related("service")[:5]

        context = {
            "stats": [
                (
                    "Jobs today",
                    counts["today"],
                    f"?scheduled_date__year={today.year}&scheduled_date__month={today.month}&scheduled_date__day={today.day}",
                ),
                ("Next 7 days", counts["next_7_days"], ""),
                ("Not yet assigned", counts["unassigned"], ""),
                ("Awaiting payment", counts["awaiting_payment"], "?status__exact=awaiting_payment"),
                ("Quote requests", counts["quote_requests"], "?status__exact=quote_requested"),
                ("Paid this month", f"₦{revenue or 0:,}", "?payment_status__exact=paid"),
            ],
            "upcoming": upcoming,
            "recent_quotes": recent_quotes,
            "new_applications": Application.objects.filter(status=Application.Status.NEW).count(),
            **(extra_context or {}),
        }
        return super().index(request, context)
