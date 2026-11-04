export function naira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString("en-NG")}`;
}

// Temporary WhatsApp handoff while the real business number is being confirmed.
// Any number saved in Admin → Settings takes precedence over this demo value.
export const DEMO_WHATSAPP_NUMBER = "2348012345678";

/** wa.me click-to-chat link, using the temporary demo number when admin contact details are blank. */
export function whatsappLink(number: string | undefined, text: string): string {
  const digits = (number || DEMO_WHATSAPP_NUMBER).replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
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
