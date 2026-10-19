from decimal import Decimal

from django.test import TestCase

from core.models import SiteSettings
from pricing.engine import PricingError, QuoteRequest, calculate
from pricing.models import AddOn, FrequencyOption, PricingUnit, Service, ServiceArea


class EngineTests(TestCase):
    def setUp(self):
        self.settings = SiteSettings.load()  # VAT 7.5% by default
        self.one_off = FrequencyOption.objects.create(label="One-off", slug="one-off", sort_order=0)
        self.weekly = FrequencyOption.objects.create(
            label="Weekly", slug="weekly", discount_percent=Decimal("10"), visits_per_payment=4, sort_order=1
        )
        self.service = Service.objects.create(
            name="Standard", slug="standard", tagline="t", pricing_method=Service.PricingMethod.PER_UNIT,
            base_price=10000, minimum_charge=0,
        )
        self.rooms = PricingUnit.objects.create(service=self.service, label="Rooms", price=5000, min_qty=1, max_qty=10)
        self.toilets = PricingUnit.objects.create(service=self.service, label="Toilets", price=3000, min_qty=0, max_qty=5)

    def quote(self, **kw):
        return calculate(QuoteRequest(service=self.service, **kw), self.settings)

    def test_per_unit_with_vat(self):
        q = self.quote(frequency=self.one_off, quantities={self.rooms.pk: 4, self.toilets.pk: 2})
        # 10,000 + 4×5,000 + 2×3,000 = 36,000; VAT 7.5% = 2,700
        self.assertEqual(q.subtotal, 36000)
        self.assertEqual(q.vat_amount, 2700)
        self.assertEqual(q.total, 38700)
        self.assertFalse(q.requires_quote)

    def test_frequency_discount_and_visits(self):
        q = self.quote(frequency=self.weekly, quantities={self.rooms.pk: 2, self.toilets.pk: 0})
        # 20,000 per visit − 10% = 18,000 × 4 visits = 72,000
        self.assertEqual(q.discount_amount, 2000)
        self.assertEqual(q.per_visit, 18000)
        self.assertEqual(q.subtotal, 72000)
        self.assertEqual(q.total, 77400)

    def test_minimum_charge_applies_after_discount(self):
        self.service.minimum_charge = 25000
        self.service.save()
        q = self.quote(frequency=self.one_off, quantities={self.rooms.pk: 1, self.toilets.pk: 0})
        self.assertTrue(q.minimum_applied)
        self.assertEqual(q.subtotal, 25000)

    def test_area_surcharge_is_per_visit(self):
        area = ServiceArea.objects.create(name="Ajah", surcharge=3000)
        q = self.quote(frequency=self.weekly, area=area, quantities={self.rooms.pk: 1, self.toilets.pk: 0})
        # (15,000 − 1,500) + 3,000 = 16,500 × 4
        self.assertEqual(q.subtotal, 66000)

    def test_addons(self):
        addon = AddOn.objects.create(service=self.service, label="Windows", price=7000)
        q = self.quote(frequency=self.one_off, quantities={self.rooms.pk: 1, self.toilets.pk: 0}, addon_ids=[addon.pk])
        self.assertEqual(q.subtotal, 22000)

    def test_addon_from_another_service_rejected(self):
        other = Service.objects.create(name="Other", slug="other", tagline="t")
        addon = AddOn.objects.create(service=other, label="X", price=1)
        with self.assertRaises(PricingError):
            self.quote(addon_ids=[addon.pk])

    def test_quantity_out_of_range(self):
        with self.assertRaises(PricingError):
            self.quote(quantities={self.rooms.pk: 0})

    def test_frequency_not_offered(self):
        self.service.frequencies.set([self.one_off])
        with self.assertRaises(PricingError):
            self.quote(frequency=self.weekly)

    def test_vat_disabled(self):
        self.settings.vat_enabled = False
        q = self.quote(frequency=self.one_off, quantities={self.rooms.pk: 1, self.toilets.pk: 0})
        self.assertEqual(q.vat_amount, 0)
        self.assertEqual(q.total, q.subtotal)

    def test_per_sqm_and_quote_threshold(self):
        svc = Service.objects.create(
            name="Post", slug="post", tagline="t", pricing_method=Service.PricingMethod.PER_SQM,
            base_price=20000, rate_per_sqm=1000, min_area_sqm=10, max_area_sqm=1000, quote_threshold=200000,
        )
        small = calculate(QuoteRequest(service=svc, area_sqm=100), self.settings)
        self.assertEqual(small.subtotal, 120000)
        self.assertFalse(small.requires_quote)
        big = calculate(QuoteRequest(service=svc, area_sqm=500), self.settings)
        self.assertTrue(big.requires_quote)
        with self.assertRaises(PricingError):
            calculate(QuoteRequest(service=svc), self.settings)

    def test_quote_only(self):
        svc = Service.objects.create(name="Staff", slug="staff", tagline="t", pricing_method=Service.PricingMethod.QUOTE)
        q = calculate(QuoteRequest(service=svc), self.settings)
        self.assertTrue(q.requires_quote)
        self.assertEqual(q.total, 0)
        self.assertIsNone(svc.starting_price())

    def test_starting_price(self):
        self.service.minimum_charge = 0
        self.assertEqual(self.service.starting_price(), 15000)  # base + 1 room minimum
