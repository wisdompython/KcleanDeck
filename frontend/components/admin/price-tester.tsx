"use client";

import { useQuery } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { inputClass } from "@/components/admin/ui";
import { api } from "@/lib/admin/api";
import type { AdminArea, AdminFrequency, AdminQuote, AdminService } from "@/lib/admin/types";
import { naira } from "@/lib/format";

function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** Try the saved rates exactly as a customer would, including VAT and deposit. */
export function PriceTester({
  service,
  frequencies,
  areas,
  dirty,
}: {
  service: AdminService;
  frequencies: AdminFrequency[];
  areas: AdminArea[];
  dirty: boolean;
}) {
  const offered = service.frequencies.length
    ? frequencies.filter((f) => service.frequencies.includes(f.id))
    : frequencies.filter((f) => f.is_active);
  const [frequency, setFrequency] = useState<number | null>(offered[0]?.id ?? null);
  const [area, setArea] = useState<number | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(service.units.filter((u) => u.id).map((u) => [String(u.id), u.default_qty])),
  );
  const [sqm, setSqm] = useState(String(service.min_area_sqm * 5));
  const [addons, setAddons] = useState<number[]>([]);

  const inputs = useDebounced({
    frequency,
    area,
    quantities: service.pricing_method === "per_unit" ? quantities : {},
    area_sqm: service.pricing_method === "per_sqm" ? Number(sqm) || null : null,
    addon_ids: addons,
  });

  const { data, error, isFetching } = useQuery({
    queryKey: ["price-test", service.id, service.starting_price, inputs],
    queryFn: () => api<AdminQuote>(`services/${service.id}/quote/`, { method: "POST", body: inputs }),
    retry: false,
  });

  if (service.pricing_method === "quote") {
    return <p className="text-sm text-on-surface-variant">Custom-quote services have no online price to test.</p>;
  }

  return (
    <div className="space-y-4">
      {dirty && (
        <p className="rounded-lg bg-warning/12 px-3 py-2 text-xs text-on-warning-container">
          Testing the saved rates. Save to test your latest changes.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Test frequency" value={frequency ?? ""} onChange={(e) => setFrequency(e.target.value ? Number(e.target.value) : null)} className={inputClass}>
          {offered.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <select aria-label="Test area" value={area ?? ""} onChange={(e) => setArea(e.target.value ? Number(e.target.value) : null)} className={inputClass}>
          <option value="">No area</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {service.pricing_method === "per_unit" &&
        service.units
          .filter((u) => u.id)
          .map((u) => {
            const value = quantities[String(u.id)] ?? u.default_qty;
            const set = (v: number) => setQuantities((q) => ({ ...q, [String(u.id)]: Math.min(u.max_qty, Math.max(u.min_qty, v)) }));
            return (
              <div key={u.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{u.label}</span>
                <span className="flex items-center gap-1.5">
                  <button type="button" aria-label={`Test fewer ${u.label}`} onClick={() => set(value - 1)} className="grid size-7 place-items-center rounded-lg bg-surface-container">
                    <Minus className="size-3" />
                  </button>
                  <span className="tabular w-6 text-center font-semibold">{value}</span>
                  <button type="button" aria-label={`Test more ${u.label}`} onClick={() => set(value + 1)} className="grid size-7 place-items-center rounded-lg bg-surface-container">
                    <Plus className="size-3" />
                  </button>
                </span>
              </div>
            );
          })}
      {service.pricing_method === "per_sqm" && (
        <label className="flex items-center justify-between gap-2 text-sm">
          Floor area (m²)
          <input type="number" aria-label="Test floor area" value={sqm} onChange={(e) => setSqm(e.target.value)} className={`${inputClass} tabular h-9 w-28`} />
        </label>
      )}
      {service.addons.filter((a) => a.id && a.is_active).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {service.addons
            .filter((a) => a.id && a.is_active)
            .map((a) => {
              const on = addons.includes(a.id!);
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setAddons(on ? addons.filter((x) => x !== a.id) : [...addons, a.id!])}
                  className={`rounded-full border px-3 py-1 text-xs transition ${on ? "border-secondary bg-secondary-container text-on-secondary-container" : "border-surface-container-high"}`}
                >
                  {a.label}
                </button>
              );
            })}
        </div>
      )}

      <div className={`rounded-xl bg-surface-container-low p-4 text-sm transition-opacity ${isFetching ? "opacity-60" : ""}`} data-testid="price-test-result">
        {error ? (
          <p className="text-error">{error.message}</p>
        ) : data ? (
          <div className="space-y-1.5">
            {data.lines.map((l) => (
              <div key={l.label} className="flex justify-between gap-3 text-on-surface-variant">
                <span>{l.label}</span>
                <span className="tabular">{naira(l.amount)}</span>
              </div>
            ))}
            {data.discount_amount > 0 && (
              <div className="flex justify-between text-on-surface-variant">
                <span>Frequency discount</span>
                <span className="tabular">−{naira(data.discount_amount)}</span>
              </div>
            )}
            {data.minimum_applied && <p className="text-xs text-outline">Minimum charge applied</p>}
            {data.area_surcharge > 0 && (
              <div className="flex justify-between text-on-surface-variant">
                <span>Area surcharge</span>
                <span className="tabular">{naira(data.area_surcharge)}</span>
              </div>
            )}
            {data.visits > 1 && (
              <div className="flex justify-between text-on-surface-variant">
                <span>× {data.visits} visits</span>
                <span className="tabular">{naira(data.subtotal)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-surface-container-high pt-1.5 text-on-surface-variant">
              <span>VAT ({Number(data.vat_rate)}%)</span>
              <span className="tabular">{naira(data.vat_amount)}</span>
            </div>
            <div className="flex justify-between pt-1 font-display text-base font-bold">
              <span>Customer pays</span>
              <span className="tabular">{naira(data.total)}</span>
            </div>
            {data.due_later > 0 && (
              <p className="text-xs text-on-surface-variant">
                {naira(data.due_now)} deposit online, {naira(data.due_later)} on completion
              </p>
            )}
            {data.requires_quote && (
              <p className="text-xs text-on-tertiary-container">Above the online limit: customers would be sent to WhatsApp.</p>
            )}
          </div>
        ) : (
          <p className="text-outline">Calculating…</p>
        )}
      </div>
    </div>
  );
}
