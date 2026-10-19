"""Pricing a booking from its stored calculator inputs (staff-entered bookings)."""

from pricing.engine import PricingError, Quote, QuoteRequest, calculate


def parse_inputs(inputs: dict | None) -> dict:
    """Normalise the booking.inputs JSON into calculator arguments."""
    inputs = inputs or {}
    try:
        return {
            "quantities": {int(k): int(v) for k, v in (inputs.get("quantities") or {}).items()},
            "area_sqm": int(inputs["area_sqm"]) if inputs.get("area_sqm") not in (None, "") else None,
            "addon_ids": [int(i) for i in inputs.get("addon_ids") or []],
        }
    except (TypeError, ValueError, AttributeError) as exc:
        raise PricingError("Calculator inputs are not in the expected format.") from exc


def quote_for(service, frequency, area, inputs: dict | None) -> Quote:
    """Raises PricingError if the inputs can't be priced."""
    if service.is_quote_only:
        raise PricingError(f"{service.name} is quote-only. Use an agreed price.")
    return calculate(QuoteRequest(service=service, frequency=frequency, area=area, **parse_inputs(inputs)))
