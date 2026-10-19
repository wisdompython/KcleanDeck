from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from core.models import FAQ, Application, SiteSettings
from pricing.api import AreaSerializer, TimeSlotSerializer
from pricing.models import ServiceArea, TimeSlot


class SiteView(APIView):
    """Everything the site layout needs in one call: contact details, VAT,
    service areas and FAQs."""

    def get(self, request):
        s = SiteSettings.load()
        return Response(
            {
                "business_name": s.business_name,
                "whatsapp_number": s.whatsapp_number,
                "phone_number": s.phone_number,
                "email": s.email,
                "address": s.address,
                "coverage_text": s.coverage_text,
                "vat_enabled": s.vat_enabled,
                "vat_rate": str(s.vat_rate),
                "min_booking_lead_days": s.min_booking_lead_days,
                "today": timezone.localdate(),
                "time_slots": TimeSlotSerializer(TimeSlot.objects.filter(is_active=True), many=True).data,
                "areas": AreaSerializer(ServiceArea.objects.filter(is_active=True), many=True).data,
                "faqs": [
                    {"id": f.id, "question": f.question, "answer": f.answer, "homepage": f.show_on_homepage}
                    for f in FAQ.objects.filter(is_active=True)
                ],
            }
        )


class TermsView(APIView):
    def get(self, request):
        s = SiteSettings.load()
        return Response({"content": s.terms_content, "updated_on": s.terms_updated_on})


class ApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = ["kind", "full_name", "phone", "email", "role", "location", "experience", "message"]


class ApplicationCreate(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_write"

    def post(self, request):
        from bookings.notifications import notify_application

        ser = ApplicationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        application = ser.save()
        notify_application(application)
        return Response({"ok": True}, status=status.HTTP_201_CREATED)
