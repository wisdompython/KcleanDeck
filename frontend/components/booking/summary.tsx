import { Droplets, LoaderCircle, Zap } from "lucide-react";

import { dueNow, naira, vatLabel } from "@/lib/format";
import type { Area, Frequency, Quote, Service } from "@/lib/types";

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 text-sm ${muted ? "text-white/60" : "text-white/85"}`}>
      <span>{label}</span>
      <span className="tabular shrink-0">{value}</span>
    </div>
  );
}

export function Summary({
  service,
  frequency,
  area,
  quote,
  loading,
  error,
  footer,
}: {
  footer?: React.ReactNode;
  service: Service;
  frequency: Frequency | undefined;
  area: Area | undefined;
  quote: Quote | null;
  loading: boolean;
  error: string;
}) {
  const quoteOnly = service.pricing_method === "quote";

  return (
    <aside className="rounded-3xl bg-primary p-6 text-white shadow-pop md:p-7 lg:sticky lg:top-24">
      <p className="font-display text-[11px] font-bold tracking-[0.08em] text-tertiary uppercase">Your booking</p>
      <h2 className="mt-2 text-xl font-semibold text-white">{service.name}</h2>
      <p className="mt-1 text-sm text-white/60">
        {[frequency?.label, area?.name].filter(Boolean).join(" · ") || "Lagos"}
      </p>

      <div className="my-5 h-px bg-white/10" />

      {quoteOnly ? (
        <p className="text-sm leading-6 text-white/75">
          This service is priced per job. Send us the details and we&apos;ll reply on WhatsApp with a quote and a
          secure payment link.
        </p>
      ) : error ? (
        <p role="alert" className="rounded-xl bg-white/10 px-4 py-3 text-sm text-warning">
          {error}
        </p>
      ) : !quote ? (
        <div className="flex items-center gap-2 text-sm text-white/60">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Working out your price…
        </div>
      ) : (
        <div className={`space-y-2.5 transition-opacity ${loading ? "opacity-60" : ""}`} aria-live="polite">
          {quote.lines.map((line) => (
            <Row key={line.label} label={line.label} value={naira(line.amount)} />
          ))}
          {quote.discount_amount > 0 && (
            <Row label={`${frequency?.label ?? "Frequency"} discount`} value={`−${naira(quote.discount_amount)}`} />
          )}
          {quote.minimum_applied && <Row label="Minimum charge applies" value="" muted />}
          {quote.area_surcharge > 0 && <Row label={`Travel (${area?.name})`} value={naira(quote.area_surcharge)} />}
          {quote.visits > 1 && (
            <Row label={`${naira(quote.per_visit)} per visit × ${quote.visits} visits`} value={naira(quote.subtotal)} />
          )}
          <div className="my-3 h-px bg-white/10" />
          <Row label="Subtotal" value={naira(quote.subtotal)} />
          <Row label={`VAT (${vatLabel(quote.vat_rate)})`} value={naira(quote.vat_amount)} />
          <div className="pt-3">
            <p className="font-display text-[11px] font-bold tracking-[0.08em] text-white/60 uppercase">
              {quote.requires_quote ? "Estimated total" : "Total to pay"}
            </p>
            <p data-testid="summary-total" className="tabular mt-1 font-display text-4xl font-extrabold tracking-[-0.02em] text-white">
              {naira(quote.total)}
            </p>
            {quote.visits > 1 && (
              <p className="mt-1 text-xs text-white/60">Covers {quote.visits} visits. We bill again after that.</p>
            )}
          </div>
          {!quote.requires_quote && dueNow(service, quote.total) < quote.total && (
            <div className="mt-3 space-y-1.5 rounded-xl bg-white/10 p-3" data-testid="deposit-split">
              <Row label={`Pay now (${service.deposit_percent}% deposit)`} value={naira(dueNow(service, quote.total))} />
              <Row
                label="Balance on completion"
                value={naira(quote.total - dueNow(service, quote.total))}
                muted
              />
            </div>
          )}
          {quote.requires_quote && (
            <p className="mt-3 rounded-xl bg-tertiary/15 px-4 py-3 text-sm text-white">{quote.quote_reason}</p>
          )}
        </div>
      )}

      <div className="mt-6 rounded-2xl bg-white/[0.06] p-4 text-sm text-white/75">
        <p className="font-display font-semibold text-white">On the day, please provide</p>
        <p className="mt-2 flex items-center gap-2">
          <Droplets className="size-4 text-tertiary" aria-hidden="true" /> Running water
        </p>
        <p className="mt-1 flex items-center gap-2">
          <Zap className="size-4 text-warning" aria-hidden="true" /> Electricity (mains or generator)
        </p>
      </div>
      {footer}
    </aside>
  );
}
