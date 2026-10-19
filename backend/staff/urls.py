from django.urls import include, path
from rest_framework.routers import DefaultRouter

from staff import views

router = DefaultRouter(trailing_slash=True)
router.include_root_view = False
router.register("bookings", views.BookingViewSet, basename="admin-bookings")
router.register("cleaners", views.CleanerViewSet, basename="admin-cleaners")
router.register("applications", views.ApplicationViewSet, basename="admin-applications")
router.register("services", views.ServiceViewSet, basename="admin-services")
router.register("frequencies", views.FrequencyViewSet, basename="admin-frequencies")
router.register("categories", views.CategoryViewSet, basename="admin-categories")
router.register("time-slots", views.TimeSlotViewSet, basename="admin-time-slots")
router.register("areas", views.AreaViewSet, basename="admin-areas")
router.register("faqs", views.FAQViewSet, basename="admin-faqs")
router.register("team", views.TeamViewSet, basename="admin-team")

urlpatterns = [
    path("auth/csrf/", views.CsrfView.as_view()),
    path("auth/login/", views.LoginView.as_view()),
    path("auth/logout/", views.LogoutView.as_view()),
    path("auth/me/", views.MeView.as_view()),
    path("auth/password/", views.ChangePasswordView.as_view()),
    path("dashboard/", views.DashboardView.as_view()),
    path("setup/", views.SetupChecklistView.as_view()),
    path("settings/", views.SiteSettingsView.as_view()),
    path("", include(router.urls)),
]
