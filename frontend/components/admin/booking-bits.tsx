"use client";

import { CalendarDays, Clock, MapPin, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";

import { WhatsAppIcon } from "@/components/icons";
import { PaymentChip, StatusChip } from "@/components/admin/ui";
import { customerWhatsApp, relativeDay } from "@/lib/admin/labels";
import type { BookingSummary } from "@/lib/admin/types";
import { naira } from "@/lib/format";

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function Avatar({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span
      className={`grid size-10 shrink-0 place-items-center rounded-xl bg-primary-fixed font-display text-sm font-bold text-primary ${className}`}
    >
      {initials(name)}
    </span>
  );
}

export function WhatsAppCustomer({ booking, text }: { booking: BookingSummary; text?: string }) {
  const href = customerWhatsApp(
    booking.phone,
    text ?? `Hello ${booking.contact_name.split(" ")[0]}, this is Kleandeck about your booking ${booking.reference}.`,
  );
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-whatsapp/12 px-3 text-[13px] font-semibold text-on-secondary-container transition hover:bg-whatsapp/20"
    >
      <WhatsAppIcon className="size-4" /> WhatsApp
    </a>
  );
}

/** Job card used on the dashboard (Stitch "Active deployments" style). */
export function JobCard({ booking }: { booking: BookingSummary }) {
  const unassigned = booking.cleaners.length === 0;
  const accent =
    booking.status === "in_progress" ? "border-l-tertiary" : unassigned ? "border-l-warning" : "border-l-secondary";

  return (
    <article
      className={`rounded-2xl border border-l-4 border-surface-container ${accent} bg-surface p-4 shadow-card transition hover:shadow-pop`}
    >
      <div className="flex items-start gap-3">
        <Avatar name={booking.customer_name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/bookings/${booking.reference}`}
              className="truncate font-display text-base font-semibold text-on-surface hover:text-primary"
            >
              {booking.customer_name}
            </Link>
            <StatusChip status={booking.status} />
          </div>
          <p className="mt-0.5 text-[13px] text-on-surface-variant">
            {booking.service_name}
            {booking.frequency_label ? ` · ${booking.frequency_label}` : ""} · {booking.reference}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-sm font-semibold text-on-surface">{relativeDay(booking.scheduled_date)}</p>
          <p className="text-xs text-on-surface-variant">
            {booking.time_slot_label ? booking.time_slot_label.split(" (")[0] : "Time TBC"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-on-surface-variant">
        {booking.area_name && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5" /> {booking.area_name}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-3.5" />
          {unassigned ? (
            <span className="inline-flex items-center gap-1 font-semibold text-on-warning-container">
              <TriangleAlert className="size-3.5" /> No team assigned
            </span>
          ) : (
            booking.cleaners.map((c) => c.full_name).join(", ")
          )}
        </span>
        {!booking.site_requirements_confirmed && (
          <span className="inline-flex items-center gap-1 text-on-warning-container">
            <TriangleAlert className="size-3.5" /> Water/power not confirmed
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-surface-container pt-3">
        <div className="flex items-center gap-2">
          <PaymentChip status={booking.payment_status} />
          <span className="tabular text-sm font-semibold text-on-surface">{naira(booking.total)}</span>
        </div>
        <div className="flex gap-2">
          <WhatsAppCustomer booking={booking} />
          <Link
            href={`/admin/bookings/${booking.reference}`}
            className="inline-flex h-9 items-center rounded-xl bg-surface-container px-3 text-[13px] font-semibold text-on-surface transition hover:bg-surface-container-high"
          >
            {unassigned ? "Assign team" : "Open"}
          </Link>
        </div>
      </div>
    </article>
  );
}

export function WhenLine({ booking }: { booking: Pick<BookingSummary, "scheduled_date" | "time_slot_label"> }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="inline-flex items-center gap-1.5">
        <CalendarDays className="size-3.5" /> {relativeDay(booking.scheduled_date)}
      </span>
      {booking.time_slot_label && (
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5" /> {booking.time_slot_label}
        </span>
      )}
    </span>
  );
}
