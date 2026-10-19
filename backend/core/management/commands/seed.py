"""Load starter content: services, placeholder rates, Lagos areas, FAQs and
draft terms. Safe to re-run — it only fills in what's missing, so it never
overwrites rates staff have already set in the admin.

    python manage.py seed
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import FAQ, SiteSettings
from pricing.models import AddOn, FrequencyOption, PricingUnit, Service, ServiceArea, ServiceCategory, TimeSlot

FREQUENCIES = [
    # slug, label, description, discount %, visits per payment
    ("one-off", "One-off", "A single visit", "0", 1),
    ("weekly", "Weekly", "Billed monthly for 4 visits", "10", 4),
    ("every-two-weeks", "Every two weeks", "Billed monthly for 2 visits", "5", 2),
    ("monthly", "Monthly", "One visit a month", "0", 1),
]

AREAS = [
    "Victoria Island", "Ikoyi", "Oniru", "Lekki Phase 1", "Lekki (Chevron – Ajah)", "Ajah", "Ikeja",
    "Ikeja GRA", "Maryland", "Yaba", "Surulere", "Gbagada", "Magodo", "Ogudu", "Apapa", "Festac",
]

TIME_SLOTS = [
    # key, label, hint
    ("morning", "Morning", "8am – 12pm"),
    ("afternoon", "Afternoon", "12pm – 4pm"),
    ("after_hours", "After hours", "From 6pm"),
]

CATEGORIES = [
    {
        "slug": "corporate-offices",
        "name": "Corporate offices",
        "buyer": "Office and facility managers",
        "description": "Recurring standard cleaning to keep workspaces presentable, plus office assistants when you "
        "need extra hands.",
        "cta_label": "Price an office clean",
        "image": "/images/use-cases/offices.jpg",
        "services": ["standard-cleaning", "deep-cleaning", "facility-support"],
    },
    {
        "slug": "shortlets-hospitality",
        "name": "Shortlets & hospitality",
        "buyer": "Shortlet operators, hosts and hotels",
        "description": "Turnover and deep cleaning between guests, so every check-in starts with a spotless space.",
        "cta_label": "Price a turnover clean",
        "image": "/images/use-cases/shortlets.jpg",
        "services": ["deep-cleaning", "standard-cleaning"],
    },
    {
        "slug": "real-estate",
        "name": "Real estate",
        "buyer": "Agents, developers and property managers",
        "description": "Move-in, move-out and pre-handover cleaning that gets units ready for viewings or a new tenant.",
        "cta_label": "Price a handover clean",
        "image": "/images/use-cases/real-estate.jpg",
        "services": ["move-in-move-out", "deep-cleaning"],
    },
    {
        "slug": "interior-decor",
        "name": "Interior decor",
        "buyer": "Interior decorators and fit-out contractors",
        "description": "Post-construction cleaning that clears dust and residue before you reveal the space to your "
        "client.",
        "cta_label": "Price a post-build clean",
        "image": "/images/use-cases/interior-decor.jpg",
        "services": ["post-construction-cleaning", "deep-cleaning"],
    },
]

# PLACEHOLDER RATES — replace in the admin with Kleandeck's real rate card.
SERVICES = [
    {
        "slug": "standard-cleaning",
        "name": "Standard cleaning",
        "tagline": "Routine cleaning for offices and commercial spaces, one-off or on a schedule.",
        "description": "Keeps your workspace clean and presentable week to week.",
        "includes": "Dusting and wiping of desks and surfaces\nFloor sweeping, mopping and vacuuming\n"
        "Restroom cleaning\nKitchen / pantry wipe-down\nTrash removal",
        "image": "/images/services/standard.jpg",
        "pricing_method": Service.PricingMethod.PER_UNIT,
        "base_price": 15000,
        "minimum_charge": 25000,
        "units": [
            ("Rooms / work areas", 5000, 1, 3, 40),
            ("Restrooms", 4000, 0, 1, 20),
            ("Kitchens / pantries", 4000, 0, 1, 10),
        ],
        "frequencies": ["one-off", "weekly", "every-two-weeks", "monthly"],
        "addons": [],
    },
    {
        "slug": "deep-cleaning",
        "name": "Deep cleaning",
        "tagline": "A detailed top-to-bottom clean, including fixtures, appliances and hard-to-reach areas.",
        "description": "For spaces that need more than routine cleaning — before an event, an audit or a new season.",
        "includes": "Everything in standard cleaning\nFixtures, skirting and light switches\n"
        "Inside cabinets and appliances\nHigh dusting and hard-to-reach areas\nDetailed restroom and kitchen descaling",
        "image": "/images/services/deep.jpg",
        "badge": "Most booked",
        "pricing_method": Service.PricingMethod.PER_UNIT,
        "base_price": 30000,
        "minimum_charge": 60000,
        "units": [
            ("Rooms / work areas", 12000, 1, 3, 40),
            ("Restrooms", 8000, 0, 1, 20),
            ("Kitchens / pantries", 10000, 0, 1, 10),
        ],
        "frequencies": ["one-off", "monthly"],
        "addons": [("Upholstery / sofa cleaning", 15000), ("Interior windows", 10000), ("Inside fridge & oven", 8000)],
    },
    {
        "slug": "move-in-move-out",
        "name": "Move-in / move-out cleaning",
        "tagline": "A full clean before a tenant moves in or after they leave.",
        "description": "For agents, landlords, property managers and shortlet operators handing over a space.",
        "includes": "Full clean of every room\nInside wardrobes, cabinets and drawers\nKitchen and appliance cleaning\n"
        "Bathroom descaling\nFloors, doors and windows",
        "image": "/images/services/move.jpg",
        "pricing_method": Service.PricingMethod.PER_UNIT,
        "base_price": 25000,
        "minimum_charge": 50000,
        "units": [("Rooms / bedrooms", 10000, 1, 2, 30), ("Bathrooms", 7000, 0, 1, 20), ("Kitchens", 8000, 0, 1, 5)],
        "frequencies": ["one-off"],
        "addons": [("Interior windows", 10000)],
    },
    {
        "slug": "post-construction-cleaning",
        "name": "Post-construction cleaning",
        "tagline": "Dust and debris removal after builds, renovations and fit-outs.",
        "description": "Gets a space ready for handover or the client reveal. Large sites are quoted on WhatsApp.",
        "includes": "Construction dust removal from all surfaces\nPaint, cement and sticker residue removal\n"
        "Window and glass cleaning\nFloor scrubbing\nDebris bagging (removal off-site by arrangement)",
        "image": "/images/services/post-construction.jpg",
        "pricing_method": Service.PricingMethod.PER_SQM,
        "base_price": 20000,
        "rate_per_sqm": 1500,
        "min_area_sqm": 20,
        "max_area_sqm": 5000,
        "minimum_charge": 80000,
        "quote_threshold": 750000,
        "price_suffix": "per job",
        "units": [],
        "frequencies": ["one-off"],
        "addons": [],
    },
    {
        "slug": "facility-support",
        "name": "Facility support",
        "tagline": "Office assistants and event assistants, staffed to your schedule.",
        "description": "Day-to-day office support or extra hands for events. Priced per headcount and schedule.",
        "includes": "Office assistants\nEvent assistants\nCover for leave and absences",
        "image": "/images/services/facility.jpg",
        "pricing_method": Service.PricingMethod.QUOTE,
        "price_suffix": "custom quote",
        "units": [],
        "frequencies": [],
        "addons": [],
    },
]

FAQS = [
    (
        "Which areas do you cover?",
        "We work across Lagos. Choose your area when you book. If it isn't listed, message us on WhatsApp "
        "and we'll confirm.",
        True,
    ),
    (
        "What do I need to provide on site?",
        "Running water and electricity (mains or generator) for the whole job, and access to the space at the "
        "booked time. We can't start a job without water and power.",
        True,
    ),
    (
        "How is the price worked out?",
        "It depends on the service, the size of the space (rooms or floor area) and how often you want us. "
        "The calculator shows the full price, including VAT, before you pay.",
        True,
    ),
    (
        "Is VAT included?",
        "Prices on service cards are before VAT. 7.5% VAT is added and shown separately before you pay.",
        False,
    ),
    (
        "How do I pay?",
        "Standard jobs are paid online through Paystack by card, bank transfer or USSD. For custom jobs we agree "
        "the price on WhatsApp and send you a Paystack payment link.",
        True,
    ),
    (
        "What happens after I pay?",
        "You'll get a confirmation email, and our team will message you on WhatsApp to confirm who is coming "
        "and when.",
        False,
    ),
    (
        "Can you clean outside office hours?",
        "Yes. Choose the after-hours slot when you book, or tell us your preferred time on WhatsApp.",
        False,
    ),
    (
        "Do you bring cleaning supplies and equipment?",
        "Yes, our team brings the supplies and equipment needed for the service you book. If your space needs "
        "anything specialist, we'll confirm it with you first.",
        False,
    ),
    (
        "Can I reschedule or cancel?",
        "Yes — see our terms for notice periods. Message us on WhatsApp with your booking reference.",
        False,
    ),
]

TERMS = """**Draft — replace with Kleandeck's final terms before launch.**

## 1. Bookings
A booking is confirmed once payment is received, or once we confirm a custom quote in writing on WhatsApp or email.

## 2. Prices and VAT
Prices are worked out from the details you give us. VAT is charged at 7.5% and shown before you pay. If the space is materially different from what was booked, we'll agree any price change with you before we continue.

## 3. Site requirements
You must provide running water and electricity (mains or generator) for the whole job, and access to the space at the booked time. If we can't start because water, power or access isn't available, the visit may be charged.

## 4. Rescheduling and cancellations
[To be confirmed by Kleandeck: notice period, refunds and fees.]

## 5. Damages and claims
[To be confirmed by Kleandeck: how to report an issue, time limits and liability.]

## 6. Contact
Message us on WhatsApp with your booking reference for any question about a booking.
"""


class Command(BaseCommand):
    help = "Load starter services, placeholder rates, areas, FAQs and draft terms (only fills in what's missing)."

    @transaction.atomic
    def handle(self, *args, **options):
        settings = SiteSettings.load()
        if not settings.terms_content:
            settings.terms_content = TERMS
            settings.save()

        freq = {}
        for i, (slug, label, desc, pct, visits) in enumerate(FREQUENCIES):
            freq[slug], _ = FrequencyOption.objects.get_or_create(
                slug=slug,
                defaults={
                    "label": label,
                    "description": desc,
                    "discount_percent": Decimal(pct),
                    "visits_per_payment": visits,
                    "sort_order": i,
                },
            )

        for i, name in enumerate(AREAS):
            ServiceArea.objects.get_or_create(name=name, defaults={"sort_order": i})

        for i, spec in enumerate(SERVICES):
            spec = dict(spec)
            units, addons, freqs = spec.pop("units"), spec.pop("addons"), spec.pop("frequencies")
            service, created = Service.objects.get_or_create(slug=spec.pop("slug"), defaults={**spec, "sort_order": i})
            if not created:
                continue
            for j, (label, price, min_qty, default_qty, max_qty) in enumerate(units):
                PricingUnit.objects.create(
                    service=service, label=label, price=price, min_qty=min_qty,
                    default_qty=default_qty, max_qty=max_qty, sort_order=j,
                )
            for j, (label, price) in enumerate(addons):
                AddOn.objects.create(service=service, label=label, price=price, sort_order=j)
            service.frequencies.set([freq[s] for s in freqs])

        for i, (key, label, hint) in enumerate(TIME_SLOTS):
            TimeSlot.objects.get_or_create(key=key, defaults={"label": label, "hint": hint, "sort_order": i})

        if not ServiceCategory.objects.exists():
            for i, spec in enumerate(CATEGORIES):
                spec = dict(spec)
                slugs = spec.pop("services")
                services = {s.slug: s for s in Service.objects.filter(slug__in=slugs)}
                category = ServiceCategory.objects.create(
                    **spec, sort_order=i, primary_service=services.get(slugs[0])
                )
                category.services.set(services.values())

        if not FAQ.objects.exists():
            for i, (q, a, home) in enumerate(FAQS):
                FAQ.objects.create(question=q, answer=a, show_on_homepage=home, sort_order=i)

        self.stdout.write(self.style.SUCCESS("Seed data loaded. Rates are placeholders — set real ones in the admin."))
