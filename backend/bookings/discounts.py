from decimal import ROUND_HALF_UP, Decimal

from bookings.models import DiscountCode


class DiscountCodeError(ValueError):
    pass


def apply_discount_code(quote, service, raw_code: str, *, lock: bool = False):
    """Validate a code and apply it to a calculated quote before VAT.

    ``lock=True`` serialises checkout redemptions so limited-use codes cannot
    be oversubscribed by simultaneous bookings.
    """

    code = raw_code.strip().upper()
    if not code:
        return None

    codes = DiscountCode.objects
    if lock:
        codes = codes.select_for_update()
    discount = codes.filter(code=code).first()
    if discount is None:
        raise DiscountCodeError("We couldn't find that discount code.")

    error = discount.usability_error(service, quote.subtotal)
    if error:
        raise DiscountCodeError(error)

    amount = discount.discount_for(quote.subtotal)
    if amount <= 0:
        raise DiscountCodeError("This discount code does not reduce this booking.")
    if amount >= quote.subtotal:
        raise DiscountCodeError("This code cannot cover the full booking. Please contact us for help.")

    quote.subtotal_before_code = quote.subtotal
    quote.code_discount_amount = amount
    quote.discount_code = discount.code
    quote.subtotal -= amount
    quote.vat_amount = int(
        (Decimal(quote.subtotal) * quote.vat_rate / Decimal(100)).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
    )
    quote.total = quote.subtotal + quote.vat_amount
    return discount
