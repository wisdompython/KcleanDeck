import type { BookingSource, BookingStatus, PaymentStatus } from "@/lib/admin/types";

// Chip styles follow DESIGN.md "Badges & Status Chips": emerald = active/clean,
// amber = pending, cyan = enterprise/info.
export const statusMeta: Record<BookingStatus, { label: string; chip: string }> = {
  quote_requested: { label: "Quote requested", chip: "bg-tertiary/12 text-on-tertiary-container" },
  awaiting_payment: { label: "Awaiting payment", chip: "bg-warning/12 text-on-warning-container" },
  confirmed: { label: "Confirmed", chip: "bg-secondary/10 text-on-secondary-container" },
  in_progress: { label: "In progress", chip: "bg-primary-fixed text-primary" },
  completed: { label: "Completed", chip: "bg-surface-container text-on-surface-variant" },
  cancelled: { label: "Cancelled", chip: "bg-error/10 text-error" },
};

export const paymentMeta: Record<PaymentStatus, { label: string; chip: string }> = {
  unpaid: { label: "Unpaid", chip: "bg-warning/12 text-on-warning-container" },
  part_paid: { label: "Part paid", chip: "bg-tertiary/12 text-on-tertiary-container" },
  paid: { label: "Paid", chip: "bg-secondary/10 text-on-secondary-container" },
  refunded: { label: "Refunded", chip: "bg-surface-container text-on-surface-variant" },
};

export const sourceLabel: Record<BookingSource, string> = {
  online: "Online",
  quote: "WhatsApp quote",
  manual: "Entered by staff",
};

export const paymentMethodLabel: Record<string, string> = {
  paystack: "Paystack",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
  card: "Card",
  ussd: "USSD",
};

export const bookingStatuses = Object.keys(statusMeta) as BookingStatus[];

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return "—";
  const date = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", ...opts });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeDay(iso: string | null): string {
  if (!iso) return "No date";
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const date = new Date(`${iso}T12:00:00`);
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return date.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

/** wa.me link to a customer's own number (Nigerian numbers normalised to 234…). */
export function customerWhatsApp(phone: string, text = ""): string | null {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = `234${digits.slice(1)}`;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
