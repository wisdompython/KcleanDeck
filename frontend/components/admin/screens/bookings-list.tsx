"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Search, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/admin/booking-bits";
import { buttonClass, EmptyState, ErrorNote, inputClass, PageHeader, PaymentChip, Spinner, StatusChip } from "@/components/admin/ui";
import { api } from "@/lib/admin/api";
import { relativeDay, sourceLabel } from "@/lib/admin/labels";
import type { BookingSummary, Paginated } from "@/lib/admin/types";
import { naira } from "@/lib/format";
import type { Service } from "@/lib/types";

const tabs: { label: string; status: string }[] = [
  { label: "All", status: "" },
  { label: "Quote requests", status: "quote_requested" },
  { label: "Awaiting payment", status: "awaiting_payment" },
  { label: "Upcoming", status: "confirmed,in_progress" },
  { label: "Completed", status: "completed" },
  { label: "Cancelled", status: "cancelled" },
];

const FILTER_KEYS = [
  "status",
  "payment_status",
  "source",
  "service",
  "date_from",
  "date_to",
  "unassigned",
  "cleaner",
  "q",
  "ordering",
  "page",
];

export function BookingsListScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ""]));
  const page = Number(filters.page || 1);
  const [search, setSearch] = useState(filters.q);

  function setFilters(next: Record<string, string>, resetPage = true) {
    const qs = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) qs.set(k, v);
      else qs.delete(k);
    }
    if (resetPage && !("page" in next)) qs.delete("page");
    router.replace(`${pathname}${qs.size ? `?${qs}` : ""}`, { scroll: false });
  }

  // Debounce the search box into the URL.
  useEffect(() => {
    if (search === filters.q) return;
    const t = setTimeout(() => setFilters({ q: search }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data, error, isPending, isFetching } = useQuery({
    queryKey: ["bookings", filters],
    queryFn: () => api<Paginated<BookingSummary>>("bookings/", { query: { ...filters, page } }),
    placeholderData: keepPreviousData,
  });
  const { data: services } = useQuery({
    queryKey: ["public-services"],
    queryFn: () => fetch("/api/services/").then((r) => r.json() as Promise<Service[]>),
    staleTime: 300_000,
  });

  const pages = data ? Math.max(1, Math.ceil(data.count / 25)) : 1;

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Bookings"
        title="All bookings"
        description="Online checkouts, WhatsApp quote requests and jobs entered by the team."
        actions={
          <Link href="/admin/bookings/new" className={buttonClass("accent")}>
            <Plus className="size-4" /> New booking
          </Link>
        }
      />

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-surface-container p-1">
        {tabs.map((tab) => {
          const active = filters.status === tab.status;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => setFilters({ status: tab.status })}
              className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                active ? "bg-surface text-on-surface shadow-card" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
        <label className="relative">
          <span className="sr-only">Search bookings</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-outline" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, reference, address…"
            className={`${inputClass} pl-10`}
          />
        </label>
        <select
          aria-label="Service"
          value={filters.service}
          onChange={(e) => setFilters({ service: e.target.value })}
          className={inputClass}
        >
          <option value="">All services</option>
          {services?.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Payment"
          value={filters.payment_status}
          onChange={(e) => setFilters({ payment_status: e.target.value })}
          className={inputClass}
        >
          <option value="">Any payment</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
        </select>
        <input
          type="date"
          aria-label="From date"
          value={filters.date_from}
          onChange={(e) => setFilters({ date_from: e.target.value })}
          className={inputClass}
        />
        <input
          type="date"
          aria-label="To date"
          value={filters.date_to}
          onChange={(e) => setFilters({ date_to: e.target.value })}
          className={inputClass}
        />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <label className="inline-flex cursor-pointer items-center gap-2 text-on-surface-variant">
          <input
            type="checkbox"
            className="size-4 accent-secondary"
            checked={filters.unassigned === "1"}
            onChange={(e) => setFilters({ unassigned: e.target.checked ? "1" : "" })}
          />
          No team assigned
        </label>
        <label className="inline-flex items-center gap-2 text-on-surface-variant">
          Sort
          <select
            value={filters.ordering || "-created_at"}
            onChange={(e) => setFilters({ ordering: e.target.value })}
            className="h-9 rounded-lg border border-outline-variant bg-surface px-2 text-sm"
          >
            <option value="-created_at">Newest first</option>
            <option value="scheduled_date">Job date (soonest)</option>
            <option value="-scheduled_date">Job date (latest)</option>
            <option value="-total">Highest value</option>
          </select>
        </label>
        {FILTER_KEYS.some((k) => k !== "page" && filters[k]) && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              router.replace(pathname);
            }}
            className="font-semibold text-primary"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-on-surface-variant">
          {data ? `${data.count} booking${data.count === 1 ? "" : "s"}` : ""}
        </span>
      </div>

      <ErrorNote error={error} />
      {isPending ? (
        <Spinner />
      ) : data && data.results.length === 0 ? (
        <EmptyState
          title="No bookings match"
          body="Try a different filter, or add a booking agreed outside the website."
          action={
            <Link href="/admin/bookings/new" className={buttonClass("primary", "sm")}>
              New booking
            </Link>
          }
        />
      ) : (
        data && (
          <div className={`transition-opacity ${isFetching ? "opacity-70" : ""}`}>
            {/* Table on wide screens */}
            <div className="hidden overflow-x-auto rounded-2xl border border-surface-container bg-surface shadow-card lg:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-surface-container text-xs text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Service</th>
                    <th className="px-4 py-3 font-semibold">Job date</th>
                    <th className="px-4 py-3 font-semibold">Team</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container">
                  {data.results.map((b) => (
                    <tr
                      key={b.reference}
                      onClick={() => router.push(`/admin/bookings/${b.reference}`)}
                      className="cursor-pointer transition hover:bg-surface-container-low"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={b.customer_name} className="size-9 text-xs" />
                          <div className="min-w-0">
                            <Link
                              href={`/admin/bookings/${b.reference}`}
                              onClick={(e) => e.stopPropagation()}
                              className="block truncate font-semibold text-on-surface hover:text-primary"
                            >
                              {b.customer_name}
                            </Link>
                            <span className="block truncate text-xs text-on-surface-variant">
                              {b.reference} · {sourceLabel[b.source]}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        <span className="block text-on-surface">{b.service_name}</span>
                        <span className="text-xs">{[b.frequency_label, b.area_name].filter(Boolean).join(" · ")}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{relativeDay(b.scheduled_date)}</td>
                      <td className="px-4 py-3">
                        {b.cleaners.length ? (
                          <span className="text-on-surface-variant">{b.cleaners.map((c) => c.full_name).join(", ")}</span>
                        ) : ["confirmed", "in_progress"].includes(b.status) ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-on-warning-container">
                            <TriangleAlert className="size-3.5" /> Unassigned
                          </span>
                        ) : (
                          <span className="text-outline">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <StatusChip status={b.status} />
                          {b.status !== "quote_requested" && <PaymentChip status={b.payment_status} />}
                        </div>
                      </td>
                      <td className="tabular px-4 py-3 text-right font-semibold whitespace-nowrap">
                        {b.total ? naira(b.total) : <span className="text-outline">To quote</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards on small screens */}
            <div className="space-y-3 lg:hidden">
              {data.results.map((b) => (
                <Link
                  key={b.reference}
                  href={`/admin/bookings/${b.reference}`}
                  className="block rounded-2xl border border-surface-container bg-surface p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display font-semibold text-on-surface">{b.customer_name}</p>
                      <p className="truncate text-xs text-on-surface-variant">
                        {b.service_name} · {b.reference}
                      </p>
                    </div>
                    <span className="tabular shrink-0 font-semibold">{b.total ? naira(b.total) : "To quote"}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <StatusChip status={b.status} />
                    {b.status !== "quote_requested" && <PaymentChip status={b.payment_status} />}
                    <span className="ml-auto text-xs text-on-surface-variant">{relativeDay(b.scheduled_date)}</span>
                  </div>
                </Link>
              ))}
            </div>

            {pages > 1 && (
              <div className="mt-4 flex items-center justify-end gap-2 text-sm">
                <span className="text-on-surface-variant">
                  Page {page} of {pages}
                </span>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setFilters({ page: String(page - 1) }, false)}
                  aria-label="Previous page"
                  className="grid size-9 place-items-center rounded-lg border border-surface-container-high bg-surface disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= pages}
                  onClick={() => setFilters({ page: String(page + 1) }, false)}
                  aria-label="Next page"
                  className="grid size-9 place-items-center rounded-lg border border-surface-container-high bg-surface disabled:opacity-40"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
