"""The "Getting started" checklist on the admin dashboard.

Most steps are checked automatically from the data. A few can't be (we can't
tell whether the placeholder prices have been replaced with real ones), so the
owner ticks those off by hand; they're stored in SiteSettings.setup_done.
"""

from django.conf import settings as django_settings
from django.contrib.auth import get_user_model
from django.db.models import Q

from bookings.models import Cleaner
from core.models import SiteSettings
from pricing.models import Service

DRAFT_TERMS_MARKER = "Draft — replace"
MANUAL_STEPS = {"prices", "dismissed"}


def checklist() -> dict:
    s = SiteSettings.load()
    manual = set(s.setup_done or [])
    live_services = Service.objects.filter(is_active=True)
    team = get_user_model().objects.filter(
        Q(is_superuser=True) | Q(groups__name__in=["Owner", "Staff"]), is_active=True
    ).distinct()

    steps = [
        {
            "key": "whatsapp",
            "title": "Add your WhatsApp number",
            "description": "Every \"Chat on WhatsApp\" button and quote request uses it.",
            "href": "/admin/settings?tab=business",
            "done": bool(s.whatsapp_number),
        },
        {
            "key": "contact",
            "title": "Add your phone and email",
            "description": "Shown in the website footer so customers can reach you.",
            "href": "/admin/settings?tab=business",
            "done": bool(s.phone_number and s.email),
        },
        {
            "key": "notifications",
            "title": "Choose who gets booking emails",
            "description": "These addresses get an email for every paid booking, quote request and job application.",
            "href": "/admin/settings?tab=business",
            "done": bool(s.notification_list),
        },
        {
            "key": "prices",
            "title": "Set your real prices",
            "description": "The starting prices are examples. Open each service, check the Pricing tab, then mark this done.",
            "href": "/admin/services",
            "done": "prices" in manual,
            "manual": True,
        },
        {
            "key": "photos",
            "title": "Upload your own photos",
            "description": "The current photos are placeholders. Add a real photo to each service.",
            "href": "/admin/services",
            "done": live_services.exists() and not live_services.filter(photo="").exists(),
        },
        {
            "key": "terms",
            "title": "Finish your terms and conditions",
            "description": "Replace the draft with your final terms (cancellations, damages, site requirements).",
            "href": "/admin/settings?tab=terms",
            "done": bool(s.terms_content) and DRAFT_TERMS_MARKER not in s.terms_content,
        },
        {
            "key": "cleaners",
            "title": "Add your cleaners",
            "description": "So you can assign them to bookings and send them job details.",
            "href": "/admin/cleaners",
            "done": Cleaner.objects.filter(is_active=True).exists(),
        },
        {
            "key": "team",
            "title": "Invite your team",
            "description": "Give staff their own sign-in instead of sharing yours.",
            "href": "/admin/team",
            "done": team.count() > 1,
        },
        {
            "key": "paystack",
            "title": "Connect Paystack",
            "description": "Needed to take online payments. Your developer adds the Paystack key to the server.",
            "href": None,
            "done": bool(django_settings.PAYSTACK_SECRET_KEY),
        },
    ]
    return {
        "steps": steps,
        "done": sum(step["done"] for step in steps),
        "total": len(steps),
        "dismissed": "dismissed" in manual,
    }


def mark(key: str, done: bool) -> None:
    if key not in MANUAL_STEPS:
        raise ValueError("That step is checked automatically.")
    s = SiteSettings.load()
    manual = set(s.setup_done or [])
    manual.add(key) if done else manual.discard(key)
    s.setup_done = sorted(manual)
    s.save(update_fields=["setup_done"])
