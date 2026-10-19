"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  MessageSquareQuote,
  Plus,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { useMe } from "@/components/admin/auth";
import { JobCard, WhatsAppCustomer } from "@/components/admin/booking-bits";
import { SetupChecklist } from "@/components/admin/setup-checklist";
import { buttonClass, EmptyState, ErrorNote, PageHeader, Panel, Spinner } from "@/components/admin/ui";
import { api } from "@/lib/admin/api";
import { formatDate, formatDateTime } from "@/lib/admin/labels";
import type { Dashboard } from "@/lib/admin/types";
import { naira } from "@/lib/format";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function StatTile({
  label,
  value,
  href,
  icon: Icon,
  tone = "primary",
  note,
}: {
  label: string;
  value: React.ReactNode;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "warning" | "tertiary" | "secondary";
  note?: string;
}) {
  const tones = {
    primary: "bg-primary-fixed text-primary",
    warning: "bg-warning/12 text-on-warning-container",
    tertiary: "bg-tertiary/12 text-on-tertiary-container",
    secondary: "bg-secondary/10 text-on-secondary-container",
  };
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-surface-container bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:border-tertiary hover:shadow-pop"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-[11px] font-bold tracking-[0.04em] text-on-surface-variant uppercase">
          {label}
        </p>
        <span className={`grid size-8 place-items-center rounded-lg ${tones[tone]}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="tabular mt-3 font-display text-[28px] leading-none font-bold text-on-surface">{value}</p>
      {note && <p className="mt-2 text-xs text-outline">{note}</p>}
    </Link>
  );
}

export function DashboardScreen() {
  const me = useMe();
  const { data, error, isPending } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("dashboard/"),
    refetchInterval: 60_000,
  });

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow={data ? formatDate(data.today, { weekday: "long", year: undefined }) : "Dashboard"}
        title={`${greeting()}, ${me.name.split(" ")[0]}`}
        description="Today's jobs, payments to chase and new requests. Click any number to see the bookings behind it."
        actions={
          <Link href="/admin/bookings/new" className={buttonClass("accent")}>
            <Plus className="size-4" /> New booking
          </Link>
        }
      />

      <SetupChecklist />

      {isPending && <Spinner />}
      <ErrorNote error={error} />

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile
              label="Jobs today"
              value={data.counts.today}
              icon={CalendarDays}
              href={`/admin/bookings?date_from=${data.today}&date_to=${data.today}&status=confirmed,in_progress`}
            />
            <StatTile
              label="Next 7 days"
              value={data.counts.next_7_days}
              icon={CalendarClock}
              href="/admin/bookings?status=confirmed,in_progress&ordering=scheduled_date"
            />
            <StatTile
              label="Not assigned"
              value={data.counts.unassigned}
              icon={TriangleAlert}
              tone={data.counts.unassigned ? "warning" : "secondary"}
              href="/admin/bookings?status=confirmed,in_progress&unassigned=1&ordering=scheduled_date"
            />
            <StatTile
              label="Awaiting payment"
              value={data.counts.awaiting_payment}
              icon={Wallet}
              tone="warning"
              href="/admin/bookings?status=awaiting_payment"
            />
            <StatTile
              label="Quote requests"
              value={data.counts.quote_requests}
              icon={MessageSquareQuote}
              tone="tertiary"
              href="/admin/bookings?status=quote_requested"
            />
            <StatTile
              label="Paid this month"
              value={naira(data.counts.paid_this_month)}
              icon={Wallet}
              tone="secondary"
              href="/admin/bookings?payment_status=paid"
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel
              title="Upcoming jobs"
              description="Confirmed jobs for the next 7 days"
              action={
                <Link
                  href="/admin/bookings?status=confirmed,in_progress&ordering=scheduled_date"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
                >
                  All <ArrowRight className="size-4" />
                </Link>
              }
              bodyClassName="p-4 space-y-3"
            >
              {data.upcoming.length ? (
                data.upcoming.map((b) => <JobCard key={b.reference} booking={b} />)
              ) : (
                <EmptyState title="No confirmed jobs this week" body="Paid and confirmed bookings show up here." />
              )}
            </Panel>

            <div className="space-y-6">
              <Panel
                title="Quote requests"
                description="Reply on WhatsApp, then set the agreed price"
                bodyClassName="divide-y divide-surface-container"
              >
                {data.quote_requests.length ? (
                  data.quote_requests.map((b) => (
                    <div key={b.reference} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/admin/bookings/${b.reference}`}
                          className="block truncate text-sm font-semibold text-on-surface hover:text-primary"
                        >
                          {b.customer_name}
                        </Link>
                        <p className="truncate text-xs text-on-surface-variant">
                          {b.service_name} · {formatDateTime(b.created_at)}
                        </p>
                      </div>
                      <WhatsAppCustomer booking={b} />
                    </div>
                  ))
                ) : (
                  <p className="px-5 py-6 text-sm text-on-surface-variant">No open quote requests.</p>
                )}
              </Panel>

              <Panel title="Awaiting payment" bodyClassName="divide-y divide-surface-container">
                {data.awaiting_payment.length ? (
                  data.awaiting_payment.map((b) => (
                    <Link
                      key={b.reference}
                      href={`/admin/bookings/${b.reference}`}
                      className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-surface-container-low"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-on-surface">{b.customer_name}</span>
                        <span className="block truncate text-xs text-on-surface-variant">
                          {b.service_name} · {b.reference}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-sm font-semibold">{naira(b.balance_due)}</span>
                    </Link>
                  ))
                ) : (
                  <p className="px-5 py-6 text-sm text-on-surface-variant">Nothing outstanding.</p>
                )}
              </Panel>

              <Link
                href="/admin/applications?status=new"
                className="flex items-center gap-4 rounded-2xl bg-primary p-5 text-white shadow-card transition hover:-translate-y-0.5"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-white/10 text-tertiary">
                  <ClipboardList className="size-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-display text-base font-semibold">
                    {data.new_applications} new application{data.new_applications === 1 ? "" : "s"}
                  </span>
                  <span className="block text-sm text-white/70">{data.active_cleaners} active cleaners on the roster</span>
                </span>
                <ArrowRight className="size-5 text-white/70" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
