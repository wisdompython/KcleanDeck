export function naira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString("en-NG")}`;
}

/** wa.me click-to-chat link. Falls back to the FAQ page until a number is set in the admin. */
export function whatsappLink(number: string | undefined, text: string): string {
  if (!number) return "/faq#contact";
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** What a customer pays online now: the deposit, or the full total (half-up, like the server). */
export function dueNow(service: { deposit_percent: number }, total: number): number {
  return service.deposit_percent > 0 && service.deposit_percent < 100
    ? Math.round((total * service.deposit_percent) / 100)
    : total;
}

export function vatLabel(rate: string): string {
  return `${Number(rate).toString()}%`;
}
