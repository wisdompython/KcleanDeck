from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from django.views.static import serve

from bookings import api as bookings_api
from core import api as core_api
from pricing import api as pricing_api

api = [
    path("site/", core_api.SiteView.as_view()),
    path("terms/", core_api.TermsView.as_view()),
    path("applications/", core_api.ApplicationCreate.as_view()),
    path("services/", pricing_api.ServiceList.as_view()),
    path("services/<slug:slug>/", pricing_api.ServiceDetail.as_view()),
    path("categories/", pricing_api.CategoryList.as_view()),
    path("quote/", pricing_api.QuoteView.as_view()),
    path("bookings/", bookings_api.BookingCreate.as_view()),
    path("quote-requests/", bookings_api.QuoteRequestCreate.as_view()),
    path("payments/verify/", bookings_api.VerifyPayment.as_view()),
    path("paystack/webhook/", bookings_api.paystack_webhook),
]

urlpatterns = [
    path(settings.DJANGO_ADMIN_PATH, admin.site.urls),
    path("healthz", lambda request: JsonResponse({"ok": True})),
    path("api/admin/", include("staff.urls")),
    path("api/", include(api)),
]

if settings.SERVE_MEDIA:
    urlpatterns.append(re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}))
