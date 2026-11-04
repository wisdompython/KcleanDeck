import secrets
from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model, login, logout, update_session_auth_hash
from django.db import transaction
from django.db.models import Count, ProtectedError, Q, Sum
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import generics, mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from bookings import paystack
from bookings.models import Booking, Cleaner, DiscountCode, Payment
from core.images import ImageError, clear_photo, copy_photo, replace_photo
from core.models import FAQ, Application, SiteSettings
from pricing.engine import PricingError, QuoteRequest, calculate
from pricing.models import (
    FrequencyOption,
    Service,
    ServiceArea,
    ServiceAreaPrice,
    ServiceCategory,
    TimeSlot,
)
from staff import serializers as s
from staff import setup
from staff.permissions import OWNER, IsOwner, OwnerCanEdit, TeamAPIMixin, role_of

User = get_user_model()

ACTIVE_STATUSES = [Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS]


class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


def me_payload(user) -> dict:
    return {
        "id": user.pk,
        "name": user.get_full_name() or user.first_name or user.username,
        "email": user.email,
        "role": role_of(user),
    }


# --- Auth -------------------------------------------------------------------


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        password = str(request.data.get("password", ""))
        # Email normally; a username also works for accounts made with createsuperuser.
        match = (
            User.objects.filter(email__iexact=email, is_active=True).first()
            or User.objects.filter(username__iexact=email, is_active=True).first()
        )
        user = authenticate(request, username=match.get_username(), password=password) if match else None
        if user is None or role_of(user) is None:
            return Response({"detail": "Email or password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        login(request, user)
        return Response(me_payload(user))


class LogoutView(TeamAPIMixin, APIView):
    permission_classes = []

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(TeamAPIMixin, APIView):
    def get(self, request):
        return Response(me_payload(request.user))


class ChangePasswordView(TeamAPIMixin, APIView):
    def post(self, request):
        current = request.data.get("current_password", "")
        new = request.data.get("new_password", "")
        if not request.user.check_password(current):
            return Response({"current_password": ["That isn't your current password."]}, status=400)
        if len(new) < 8:
            return Response({"new_password": ["Use at least 8 characters."]}, status=400)
        request.user.set_password(new)
        request.user.save()
        update_session_auth_hash(request, request.user)
        return Response({"ok": True})


# --- Dashboard --------------------------------------------------------------


class DashboardView(TeamAPIMixin, APIView):
    def get(self, request):
        today = timezone.localdate()
        week_end = today + timedelta(days=7)
        bookings = Booking.objects.all()

        counts = bookings.aggregate(
            today=Count("id", filter=Q(scheduled_date=today, status__in=ACTIVE_STATUSES)),
            next_7_days=Count(
                "id", filter=Q(scheduled_date__gt=today, scheduled_date__lte=week_end, status__in=ACTIVE_STATUSES)
            ),
            unassigned=Count(
                "id",
                filter=Q(status__in=ACTIVE_STATUSES, scheduled_date__gte=today, cleaners__isnull=True),
                distinct=True,
            ),
            awaiting_payment=Count("id", filter=Q(status=Booking.Status.AWAITING_PAYMENT)),
            quote_requests=Count("id", filter=Q(status=Booking.Status.QUOTE_REQUESTED)),
        )
        month_start = today.replace(day=1)
        paid_this_month = (
            Payment.objects.filter(status=Payment.Status.SUCCESS, paid_at__date__gte=month_start)
            .aggregate(total=Sum("amount"))["total"]
            or 0
        )

        upcoming = (
            bookings.filter(scheduled_date__gte=today, scheduled_date__lte=week_end, status__in=ACTIVE_STATUSES)
            .select_related("service", "area", "frequency")
            .prefetch_related("cleaners")
            .order_by("scheduled_date", "time_slot")[:20]
        )
        quotes = bookings.filter(status=Booking.Status.QUOTE_REQUESTED).select_related("service", "area")[:8]
        awaiting = bookings.filter(status=Booking.Status.AWAITING_PAYMENT).select_related("service", "area")[:8]

        return Response(
            {
                "today": today,
                "counts": {**counts, "paid_this_month": paid_this_month},
                "upcoming": s.BookingListSerializer(upcoming, many=True).data,
                "quote_requests": s.BookingListSerializer(quotes, many=True).data,
                "awaiting_payment": s.BookingListSerializer(awaiting, many=True).data,
                "new_applications": Application.objects.filter(status=Application.Status.NEW).count(),
                "active_cleaners": Cleaner.objects.filter(is_active=True).count(),
            }
        )


class SetupChecklistView(TeamAPIMixin, APIView):
    """GET the getting-started checklist; owners POST {key, done} to tick manual steps."""

    permission_classes = [IsOwner]

    def get(self, request):
        return Response(setup.checklist())

    def post(self, request):
        try:
            setup.mark(str(request.data.get("key", "")), bool(request.data.get("done", True)))
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(setup.checklist())


# --- Bookings ---------------------------------------------------------------


class BookingViewSet(TeamAPIMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                     mixins.UpdateModelMixin, viewsets.GenericViewSet):
    lookup_field = "reference"
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = Booking.objects.select_related("service", "area", "frequency", "created_by").prefetch_related(
            "cleaners", "payments"
        )
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status__in=p["status"].split(","))
        if p.get("payment_status"):
            qs = qs.filter(payment_status=p["payment_status"])
        if p.get("source"):
            qs = qs.filter(source=p["source"])
        if p.get("service"):
            qs = qs.filter(service__slug=p["service"])
        if p.get("date_from"):
            qs = qs.filter(scheduled_date__gte=p["date_from"])
        if p.get("date_to"):
            qs = qs.filter(scheduled_date__lte=p["date_to"])
        if p.get("unassigned") == "1":
            qs = qs.filter(cleaners__isnull=True)
        if p.get("cleaner"):
            qs = qs.filter(cleaners__id=p["cleaner"])
        if q := p.get("q", "").strip():
            qs = qs.filter(
                Q(reference__icontains=q) | Q(company_name__icontains=q) | Q(contact_name__icontains=q)
                | Q(phone__icontains=q) | Q(email__icontains=q) | Q(address__icontains=q)
            )
        ordering = p.get("ordering", "-created_at")
        if ordering.lstrip("-") in {"created_at", "scheduled_date", "total", "status"}:
            qs = qs.order_by(ordering, "-id")
        return qs.distinct()

    def get_serializer_class(self):
        if self.action == "list":
            return s.BookingListSerializer
        if self.action in {"create", "update", "partial_update"}:
            return s.BookingWriteSerializer
        return s.BookingDetailSerializer

    def _detail(self, booking, code=status.HTTP_200_OK):
        booking = self.get_queryset().get(pk=booking.pk)
        return Response(s.BookingDetailSerializer(booking).data, status=code)

    def create(self, request, *args, **kwargs):
        ser = s.BookingWriteSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        return self._detail(ser.save(), status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        ser = s.BookingWriteSerializer(self.get_object(), data=request.data, partial=partial,
                                       context={"request": request})
        ser.is_valid(raise_exception=True)
        return self._detail(ser.save())

    @action(detail=True, methods=["post"], url_path="payment-link")
    def payment_link(self, request, reference=None):
        booking = self.get_object()
        try:
            payment = paystack.initialize_payment(booking)
        except paystack.PaystackError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if booking.status == Booking.Status.QUOTE_REQUESTED:
            booking.status = Booking.Status.AWAITING_PAYMENT
            booking.save(update_fields=["status", "updated_at"])
        return Response({"authorization_url": payment.authorization_url, "amount": payment.amount})

    @action(detail=True, methods=["post"], url_path="record-payment")
    def record_payment(self, request, reference=None):
        booking = self.get_object()
        ser = s.RecordPaymentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        amount = ser.validated_data.get("amount") or booking.balance_due
        if amount <= 0:
            return Response({"detail": "This booking is already fully paid."}, status=status.HTTP_400_BAD_REQUEST)
        booking.record_offline_payment(amount, ser.validated_data["method"])
        booking.save()
        return self._detail(booking)


# --- Cleaners & applications -----------------------------------------------


class CleanerViewSet(TeamAPIMixin, viewsets.ModelViewSet):
    serializer_class = s.CleanerSerializer
    pagination_class = None

    def get_queryset(self):
        today = timezone.localdate()
        qs = Cleaner.objects.annotate(
            upcoming_jobs=Count(
                "bookings",
                filter=Q(bookings__scheduled_date__gte=today, bookings__status__in=ACTIVE_STATUSES),
                distinct=True,
            ),
            completed_jobs=Count("bookings", filter=Q(bookings__status=Booking.Status.COMPLETED), distinct=True),
        ).order_by("-is_active", "full_name")
        if self.request.query_params.get("active") == "1":
            qs = qs.filter(is_active=True)
        return qs

    def destroy(self, request, *args, **kwargs):
        cleaner = self.get_object()
        if cleaner.bookings.exists():
            return Response(
                {"detail": "This cleaner has bookings on record. Mark them inactive instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class ApplicationViewSet(TeamAPIMixin, mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    serializer_class = s.ApplicationSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        qs = Application.objects.all()
        p = self.request.query_params
        if p.get("kind"):
            qs = qs.filter(kind=p["kind"])
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if q := p.get("q", "").strip():
            qs = qs.filter(Q(full_name__icontains=q) | Q(phone__icontains=q) | Q(email__icontains=q))
        return qs

    @action(detail=True, methods=["post"])
    def hire(self, request, pk=None):
        """Accept an applicant and add them to the cleaner roster."""
        application = self.get_object()
        cleaner = Cleaner.objects.create(
            full_name=application.full_name,
            phone=application.phone,
            role=application.role or "Cleaner",
            joined_on=timezone.localdate(),
            notes=f"Added from application on {application.created_at:%d %b %Y}.",
        )
        application.status = Application.Status.ACCEPTED
        application.save(update_fields=["status"])
        return Response(
            {"application": s.ApplicationSerializer(application).data, "cleaner": s.CleanerSerializer(cleaner).data}
        )


# --- Pricing & content (owners change, staff read) ----------------------------


class OwnerEditableViewSet(TeamAPIMixin, viewsets.ModelViewSet):
    permission_classes = [OwnerCanEdit]
    pagination_class = None

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "This is used by existing bookings. Turn it off instead of deleting it."},
                status=status.HTTP_400_BAD_REQUEST,
            )


class DiscountCodeViewSet(OwnerEditableViewSet):
    permission_classes = [IsOwner]
    serializer_class = s.DiscountCodeSerializer

    def get_queryset(self):
        return DiscountCode.objects.prefetch_related("services")


class PhotoActionsMixin:
    """POST a file as `photo` to upload (resized server-side); DELETE to remove."""

    photo_folder = "photos"

    @action(detail=True, methods=["post", "delete"])
    def photo(self, request, pk=None):
        obj = self.get_object()
        if request.method == "DELETE":
            clear_photo(obj)
        else:
            upload = request.FILES.get("photo")
            if not upload:
                return Response({"detail": "Choose a photo to upload."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                replace_photo(obj, upload, self.photo_folder)
            except ImageError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(self.get_queryset().get(pk=obj.pk)).data)


class AdminQuoteSerializer(serializers.Serializer):
    """Price-tester inputs. Unlike the public calculator it accepts hidden services
    and inactive options, so owners can test before publishing."""

    frequency = serializers.PrimaryKeyRelatedField(queryset=FrequencyOption.objects.all(), required=False, allow_null=True)
    area = serializers.PrimaryKeyRelatedField(queryset=ServiceArea.objects.all(), required=False, allow_null=True)
    quantities = serializers.DictField(child=serializers.IntegerField(min_value=0), required=False, default=dict)
    area_sqm = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    addon_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)


class ServiceViewSet(PhotoActionsMixin, OwnerEditableViewSet):
    serializer_class = s.ServiceAdminSerializer
    photo_folder = "services"

    def get_queryset(self):
        return Service.objects.prefetch_related(
            "units", "addons", "frequencies", "time_slots", "categories", "area_prices"
        ).annotate(booking_count=Count("bookings"))

    @action(detail=True, methods=["post"])
    def quote(self, request, pk=None):
        """Try the saved rates: the exact price a customer would see."""
        service = self.get_object()
        ser = AdminQuoteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        if service.is_quote_only:
            return Response({"detail": f"{service.name} is quote-only, so it has no online price."}, status=400)
        try:
            quote = calculate(
                QuoteRequest(
                    service=service,
                    frequency=d.get("frequency"),
                    area=d.get("area"),
                    quantities={int(k): v for k, v in d["quantities"].items()},
                    area_sqm=d.get("area_sqm"),
                    addon_ids=d["addon_ids"],
                )
            )
        except (PricingError, ValueError) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        due_now = service.deposit_for(quote.total)
        return Response({**quote.as_dict(), "due_now": due_now, "due_later": quote.total - due_now})

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def duplicate(self, request, pk=None):
        """Copy a service (rates, rooms, add-ons and options) as a hidden draft."""
        original = self.get_object()
        copy = Service.objects.get(pk=original.pk)
        copy.pk = None
        copy.name = f"{original.name} (copy)"
        base_slug, n = f"{original.slug}-copy", 1
        copy.slug = base_slug
        while Service.objects.filter(slug=copy.slug).exists():
            n += 1
            copy.slug = f"{base_slug}-{n}"
        copy.is_active = False
        copy.sort_order = original.sort_order + 1
        copy.photo.name = copy_photo(original.photo.name, self.photo_folder)
        copy.save()
        for unit in original.units.all():
            unit.pk, unit.service = None, copy
            unit.save()
        for addon in original.addons.all():
            addon.pk, addon.service = None, copy
            addon.save()
        ServiceAreaPrice.objects.bulk_create(
            ServiceAreaPrice(service=copy, area_id=p.area_id, surcharge=p.surcharge) for p in original.area_prices.all()
        )
        copy.frequencies.set(original.frequencies.all())
        copy.time_slots.set(original.time_slots.all())
        copy.categories.set(original.categories.all())
        return Response(self.get_serializer(self.get_queryset().get(pk=copy.pk)).data, status=status.HTTP_201_CREATED)


class CategoryViewSet(PhotoActionsMixin, OwnerEditableViewSet):
    serializer_class = s.CategoryAdminSerializer
    photo_folder = "categories"

    def get_queryset(self):
        return ServiceCategory.objects.prefetch_related("services")


class TimeSlotViewSet(OwnerEditableViewSet):
    serializer_class = s.TimeSlotAdminSerializer
    queryset = TimeSlot.objects.all()


class FrequencyViewSet(OwnerEditableViewSet):
    serializer_class = s.FrequencyAdminSerializer
    queryset = FrequencyOption.objects.all()


class AreaViewSet(OwnerEditableViewSet):
    serializer_class = s.AreaAdminSerializer
    queryset = ServiceArea.objects.all()


class FAQViewSet(OwnerEditableViewSet):
    serializer_class = s.FAQAdminSerializer
    queryset = FAQ.objects.all()


class SiteSettingsView(TeamAPIMixin, generics.RetrieveUpdateAPIView):
    permission_classes = [OwnerCanEdit]
    serializer_class = s.SiteSettingsSerializer

    def get_object(self):
        return SiteSettings.load()


# --- Team accounts (owners only) --------------------------------------------


class TeamViewSet(TeamAPIMixin, mixins.ListModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin,
                  viewsets.GenericViewSet):
    permission_classes = [IsOwner]
    serializer_class = s.TeamMemberSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            User.objects.filter(Q(is_superuser=True) | Q(groups__name__in=["Owner", "Staff"]))
            .distinct()
            .order_by("-is_active", "first_name", "email")
        )

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        temp_password = None
        if not data.get("password"):
            temp_password = secrets.token_urlsafe(9)
            data["password"] = temp_password
        ser = self.get_serializer(data=data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        return Response({**self.get_serializer(user).data, "temp_password": temp_password}, status=201)

    def perform_update(self, serializer):
        user = serializer.instance
        if user == self.request.user:
            if serializer.validated_data.get("is_active") is False:
                raise serializers.ValidationError({"is_active": "You can't deactivate your own account."})
            if serializer.validated_data.get("role", OWNER) != OWNER:
                raise serializers.ValidationError({"role": "You can't remove your own owner access."})
        serializer.save()

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        temp_password = secrets.token_urlsafe(9)
        user.set_password(temp_password)
        user.save()
        return Response({"temp_password": temp_password})
