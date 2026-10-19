"""Price calculation. The single source of truth for every amount the site
shows or charges — the frontend calculator calls the quote API rather than
duplicating these rules."""

from dataclasses import asdict, dataclass, field
from decimal import ROUND_HALF_UP, Decimal

from core.models import SiteSettings
from pricing.models import AddOn, FrequencyOption, Service, ServiceArea


class PricingError(ValueError):
    """Input the calculator can't price (bad quantity, wrong frequency...)."""


@dataclass
class QuoteRequest:
    service: Service
    frequency: FrequencyOption | None = None
    area: ServiceArea | None = None
    quantities: dict[int, int] = field(default_factory=dict)  # PricingUnit id -> qty
    area_sqm: int | None = None
    addon_ids: list[int] = field(default_factory=list)


@dataclass
class QuoteLine:
    label: str
    amount: int


@dataclass
class Quote:
    lines: list[QuoteLine]
    service_amount: int  # one visit, before discount
    discount_amount: int  # one visit
    minimum_applied: bool
    area_surcharge: int  # one visit
    per_visit: int
    visits: int
    subtotal: int
    vat_rate: Decimal
    vat_amount: int
    total: int
    requires_quote: bool
    quote_reason: str = ""

    def as_dict(self) -> dict:
        data = asdict(self)
        data["vat_rate"] = str(self.vat_rate)
        return data


def _round(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def vat_for(amount: int, settings: SiteSettings | None = None) -> tuple[Decimal, int]:
    settings = settings or SiteSettings.load()
    rate = settings.vat_rate if settings.vat_enabled else Decimal("0")
    return rate, _round(Decimal(amount) * rate / Decimal(100))


def calculate(req: QuoteRequest, settings: SiteSettings | None = None) -> Quote:
    service = req.service
    settings = settings or SiteSettings.load()

    frequency = req.frequency or service.available_frequencies().first()
    if frequency is not None and not service.available_frequencies().filter(pk=frequency.pk).exists():
        raise PricingError(f"{frequency.label} is not available for {service.name}.")

    if service.is_quote_only:
        vat_rate, _ = vat_for(0, settings)
        return Quote(
            lines=[], service_amount=0, discount_amount=0, minimum_applied=False, area_surcharge=0,
            per_visit=0, visits=frequency.visits_per_payment if frequency else 1, subtotal=0,
            vat_rate=vat_rate, vat_amount=0, total=0, requires_quote=True,
            quote_reason=f"{service.name} is priced per job. Send us the details on WhatsApp for a quote.",
        )

    lines: list[QuoteLine] = []
    if service.base_price:
        lines.append(QuoteLine("Base rate", service.base_price))

    if service.pricing_method == Service.PricingMethod.PER_UNIT:
        for unit in service.units.all():
            qty = req.quantities.get(unit.pk, unit.default_qty)
            if not unit.min_qty <= qty <= unit.max_qty:
                raise PricingError(f"{unit.label} must be between {unit.min_qty} and {unit.max_qty}.")
            if qty:
                lines.append(QuoteLine(f"{unit.label} × {qty}", unit.price * qty))
    elif service.pricing_method == Service.PricingMethod.PER_SQM:
        sqm = req.area_sqm
        if sqm is None:
            raise PricingError("Enter the floor area in square metres.")
        if not service.min_area_sqm <= sqm <= service.max_area_sqm:
            raise PricingError(f"Floor area must be between {service.min_area_sqm} and {service.max_area_sqm} m².")
        lines.append(QuoteLine(f"{sqm:,} m² × ₦{service.rate_per_sqm:,}", service.rate_per_sqm * sqm))

    addons = AddOn.objects.filter(service=service, is_active=True, pk__in=req.addon_ids) if req.addon_ids else []
    if req.addon_ids and len(addons) != len(set(req.addon_ids)):
        raise PricingError("One of the selected add-ons is not available for this service.")
    for addon in addons:
        lines.append(QuoteLine(addon.label, addon.price))

    service_amount = sum(line.amount for line in lines)

    discount = 0
    if frequency and frequency.discount_percent:
        discount = _round(Decimal(service_amount) * frequency.discount_percent / Decimal(100))

    net = service_amount - discount
    minimum_applied = net < service.minimum_charge
    if minimum_applied:
        net = service.minimum_charge

    surcharge = service.surcharge_for(req.area)
    per_visit = net + surcharge
    visits = frequency.visits_per_payment if frequency else 1
    subtotal = per_visit * visits
    vat_rate, vat_amount = vat_for(subtotal, settings)

    requires_quote = service.quote_threshold is not None and subtotal > service.quote_threshold
    return Quote(
        lines=lines,
        service_amount=service_amount,
        discount_amount=discount,
        minimum_applied=minimum_applied,
        area_surcharge=surcharge,
        per_visit=per_visit,
        visits=visits,
        subtotal=subtotal,
        vat_rate=vat_rate,
        vat_amount=vat_amount,
        total=subtotal + vat_amount,
        requires_quote=requires_quote,
        quote_reason=(
            "This is a large job, so we'll confirm the price with you on WhatsApp before you pay."
            if requires_quote
            else ""
        ),
    )
