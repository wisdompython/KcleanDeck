"use client";

import { ArrowLeft, ArrowRight, Check, CircleCheck, Link2, LoaderCircle, Lock, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { type Choices, choicesFromParams, choicesToQuery, defaultChoices, shareMessage } from "@/components/booking/shared-quote";
import { Summary } from "@/components/booking/summary";
import { type QuoteInputs, useQuote } from "@/components/booking/use-quote";
import { WhatsAppIcon } from "@/components/icons";
import { btn } from "@/components/ui";
import { dueNow, naira, whatsappLink } from "@/lib/format";
import type { Quote, Service, Site } from "@/lib/types";

type Step = "price" | "details" | "quote";

/** YYYY-MM-DD plus a number of days (dates only, no time zones involved). */
function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function errorMessage(body: unknown): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.detail === "string") return b.detail;
    const first = Object.values(b).flat()[0];
    if (typeof first === "string") return first;
  }
  return "Something went wrong. Please try again.";
}

function Panel({ title, step, children }: { title: string; step?: number; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-surface-container bg-white p-5 shadow-card md:p-7">
      <h2 className="flex items-center gap-3 font-display text-lg font-semibold">
        {step !== undefined && (
          <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-white">
            {step}
          </span>
        )}
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-on-surface">
      {children}
    </label>
  );
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  price,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  price: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-surface-container-high p-4">
      <div>
        <p className="font-medium text-on-surface">{label}</p>
        <p className="text-xs text-outline">{hint || `${naira(price)} each`}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Fewer ${label}`}
          className="grid size-9 place-items-center rounded-full bg-surface-container text-on-surface transition hover:bg-surface-container-high disabled:opacity-40"
        >
          <Minus className="size-4" />
        </button>
        <span className="tabular w-8 text-center font-display text-lg font-bold" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`More ${label}`}
          className="grid size-9 place-items-center rounded-full bg-surface-container text-on-surface transition hover:bg-surface-container-high disabled:opacity-40"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

function Checkbox({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer gap-3 text-sm leading-6 text-on-surface-variant">
      <input
        type="checkbox"
        name={name}
        required
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-md border-control-border accent-secondary"
      />
      <span>{children}</span>
    </label>
  );
}

/** "Copy link" and "Share on WhatsApp" for the current price. */
function SharePrice({ message }: { message: () => string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          } catch {
            window.prompt("Copy this link:", window.location.href);
          }
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[13px] font-semibold text-white transition hover:bg-white/20"
      >
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
        {copied ? "Link copied" : "Copy link"}
      </button>
      <button
        type="button"
        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(message())}`, "_blank", "noopener")}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-whatsapp px-3.5 text-[13px] font-semibold text-white transition hover:brightness-95"
      >
        <WhatsAppIcon className="size-4" /> Share on WhatsApp
      </button>
      <p className="w-full text-xs text-white/60">Send this price to whoever approves it. The link opens this exact calculation.</p>
    </div>
  );
}

export function BookingFlow({
  services,
  site,
  initialService,
  sharedParams = {},
}: {
  services: Service[];
  site: Site;
  initialService: string;
  /** Query params from a shared quote link (see shared-quote.ts). */
  sharedParams?: Record<string, string | string[] | undefined>;
}) {
  const [slug, setSlug] = useState(initialService);
  const service = services.find((s) => s.slug === slug) ?? services[0];
  const quoteOnly = service.pricing_method === "quote";
  const minDate = addDays(site.today, service.min_lead_days ?? site.min_booking_lead_days);
  const timeSlots = service.time_slots.length ? service.time_slots : site.time_slots;

  // Start from a shared link's choices when there are any.
  const [initialChoices] = useState<Choices>(() => choicesFromParams(service, site, sharedParams));
  const [frequencyId, setFrequencyId] = useState<number | null>(initialChoices.frequencyId);
  const [quantities, setQuantities] = useState(initialChoices.quantities);
  const [areaSqm, setAreaSqm] = useState<string>(initialChoices.areaSqm);
  const [addonIds, setAddonIds] = useState<number[]>(initialChoices.addonIds);
  const [areaId, setAreaId] = useState<number | null>(initialChoices.areaId);
  const [step, setStep] = useState<Step>("price");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [quoteRef, setQuoteRef] = useState<string | null>(null);

  function chooseService(next: Service) {
    const fresh = defaultChoices(next);
    setSlug(next.slug);
    setFrequencyId(fresh.frequencyId);
    setQuantities(fresh.quantities);
    setAreaSqm(fresh.areaSqm);
    setAddonIds(fresh.addonIds);
    setSubmitError("");
    setStep("price");
  }

  const sqm = Number(areaSqm);
  const inputs: QuoteInputs = useMemo(
    () => ({
      service: service.slug,
      frequency: frequencyId,
      area: areaId,
      quantities: service.pricing_method === "per_unit" ? quantities : {},
      area_sqm: service.pricing_method === "per_sqm" && sqm > 0 ? sqm : null,
      addon_ids: addonIds,
    }),
    [service, frequencyId, areaId, quantities, sqm, addonIds],
  );
  const { quote, error: quoteError, loading } = useQuote(inputs, !quoteOnly);

  // Keep the address bar in step with the calculator, so the link always
  // reopens this exact calculation (replaceState: no navigation, no reload).
  const choices: Choices = { frequencyId, areaId, quantities, areaSqm, addonIds };
  const query = choicesToQuery(service, choices);
  useEffect(() => {
    const url = `${window.location.pathname}?${query}`;
    if (url !== window.location.pathname + window.location.search) window.history.replaceState(window.history.state, "", url);
  }, [query]);
  const share =
    quote && !quoteOnly && !quoteError ? (
      <SharePrice message={() => shareMessage(service, site, choices, quote as Quote, window.location.href)} />
    ) : null;

  const frequency = service.frequencies.find((f) => f.id === frequencyId);
  const area = site.areas.find((a) => a.id === areaId);
  const canCheckout = !!quote && !quote.requires_quote && !quoteError && !loading && areaId !== null;
  const needsQuote = quoteOnly || !!quote?.requires_quote;

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const res = await fetch("/api/bookings/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...inputs,
          company_name: form.company_name,
          contact_name: form.contact_name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          site_notes: form.site_notes,
          scheduled_date: form.scheduled_date,
          time_slot: form.time_slot,
          accept_terms: form.accept_terms === "on",
          confirm_site_requirements: form.confirm_site_requirements === "on",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(errorMessage(body));
      window.location.assign(body.authorization_url);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  async function submitQuoteRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const res = await fetch("/api/quote-requests/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(quoteOnly ? { service: service.slug, area: areaId } : inputs),
          company_name: form.company_name,
          contact_name: form.contact_name,
          email: form.email,
          phone: form.phone,
          scheduled_date: form.scheduled_date || null,
          message: form.message,
          accept_terms: form.accept_terms === "on",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(errorMessage(body));
      setQuoteRef(body.reference);
      if (body.whatsapp_url) window.location.assign(body.whatsapp_url);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const summary = (
    <Summary
      service={service}
      frequency={frequency}
      area={area}
      quote={quote}
      loading={loading}
      error={quoteError}
      footer={step === "price" ? share : null}
    />
  );

  if (quoteRef) {
    return (
      <div className="mx-auto max-w-xl animate-fade-up rounded-3xl border border-surface-container bg-white p-8 text-center shadow-card">
        <CircleCheck className="mx-auto size-12 text-secondary" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-bold">We&apos;ve got your request</h2>
        <p className="mt-2 text-on-surface-variant">
          Your reference is <strong className="text-on-surface">{quoteRef}</strong>. We&apos;re opening WhatsApp so you can
          send us the details. If it didn&apos;t open, tap below.
        </p>
        <a
          href={whatsappLink(site.whatsapp_number, `Hello Kleandeck, I'd like a quote for ${service.name}. Ref: ${quoteRef}`)}
          className={`${btn.whatsapp} mt-6`}
        >
          <WhatsAppIcon className="size-5" /> Open WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-8">
      <div className="space-y-6">
        {step === "price" && (
          <div className="animate-fade-up space-y-6">
            <Panel title="Choose a service" step={1}>
              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((s) => {
                  const selected = s.slug === service.slug;
                  return (
                    <button
                      key={s.slug}
                      type="button"
                      onClick={() => chooseService(s)}
                      aria-pressed={selected}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-primary bg-primary text-white shadow-pop"
                          : "border-surface-container-high bg-white hover:border-tertiary"
                      }`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-display font-semibold">{s.name}</span>
                        {s.badge && (
                          <span
                            className={`rounded-full px-2 py-0.5 font-display text-[10px] font-bold uppercase ${
                              selected ? "bg-secondary text-white" : "bg-secondary-container text-on-secondary-container"
                            }`}
                          >
                            {s.badge}
                          </span>
                        )}
                      </span>
                      <span className={`mt-1 block text-sm ${selected ? "text-white/70" : "text-on-surface-variant"}`}>
                        {s.starting_price === null ? "Custom quote" : `From ${naira(s.starting_price)} + VAT`}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-sm leading-6 text-on-surface-variant">{service.description || service.tagline}</p>
            </Panel>

            {!quoteOnly && service.frequencies.length > 1 && (
              <Panel title="How often?" step={2}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {service.frequencies.map((f) => {
                    const selected = f.id === frequencyId;
                    const pct = Number(f.discount_percent);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFrequencyId(f.id)}
                        aria-pressed={selected}
                        className={`rounded-2xl border p-4 text-left transition ${
                          selected ? "border-secondary bg-secondary-container" : "border-surface-container-high bg-white hover:border-tertiary"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2 font-display font-semibold">
                          {f.label}
                          {pct > 0 && (
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-white">
                              −{pct}%
                            </span>
                          )}
                        </span>
                        {f.description && <span className="mt-1 block text-sm text-on-surface-variant">{f.description}</span>}
                      </button>
                    );
                  })}
                </div>
              </Panel>
            )}

            {!quoteOnly && (
              <Panel title="About the space" step={service.frequencies.length > 1 ? 3 : 2}>
                <div className="space-y-5">
                  {service.pricing_method === "per_unit" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {service.units.map((u) => (
                        <Stepper
                          key={u.id}
                          label={u.label}
                          hint={u.help_text}
                          value={quantities[String(u.id)] ?? u.default_qty}
                          min={u.min_qty}
                          max={u.max_qty}
                          price={u.price}
                          onChange={(v) => setQuantities((q) => ({ ...q, [String(u.id)]: v }))}
                        />
                      ))}
                    </div>
                  )}
                  {service.pricing_method === "per_sqm" && (
                    <div className="max-w-xs">
                      <Label htmlFor="area_sqm">Floor area (m²)</Label>
                      <input
                        id="area_sqm"
                        type="number"
                        inputMode="numeric"
                        min={service.min_area_sqm}
                        max={service.max_area_sqm}
                        value={areaSqm}
                        onChange={(e) => setAreaSqm(e.target.value)}
                        className="field tabular"
                      />
                      <p className="mt-1.5 text-xs text-outline">
                        {naira(service.rate_per_sqm)} per m². Not sure? An estimate is fine; we confirm on site.
                      </p>
                    </div>
                  )}
                  {service.addons.length > 0 && (
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium text-on-surface">Add-ons</legend>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {service.addons.map((a) => (
                          <label
                            key={a.id}
                            className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-surface-container-high p-4 text-sm has-[:checked]:border-secondary has-[:checked]:bg-secondary-container"
                          >
                            <span className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                className="size-5 accent-secondary"
                                checked={addonIds.includes(a.id)}
                                onChange={(e) =>
                                  setAddonIds((ids) =>
                                    e.target.checked ? [...ids, a.id] : ids.filter((id) => id !== a.id),
                                  )
                                }
                              />
                              {a.label}
                            </span>
                            <span className="tabular text-on-surface-variant">+{naira(a.price)}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </div>
              </Panel>
            )}

            <Panel title="Where is the space?">
              <Label htmlFor="area">Area in Lagos</Label>
              <select
                id="area"
                className="field"
                value={areaId ?? ""}
                onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Choose your area</option>
                {site.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-outline">
                Area not listed?{" "}
                <a href={whatsappLink(site.whatsapp_number, "Hello Kleandeck, do you cover my area?")} className="underline">
                  Ask us on WhatsApp
                </a>
                .
              </p>
            </Panel>

            <div className="lg:hidden">{summary}</div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              {needsQuote ? (
                <button type="button" onClick={() => setStep("quote")} className={btn.whatsapp}>
                  <WhatsAppIcon className="size-5" /> Continue to a WhatsApp quote
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep("details")}
                  disabled={!canCheckout}
                  className={btn.accent}
                >
                  Continue <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
            {!needsQuote && areaId === null && (
              <p className="text-right text-sm text-outline">Choose your area to continue.</p>
            )}
          </div>
        )}

        {step === "details" && quote && (
          <form onSubmit={submitBooking} className="animate-fade-up space-y-6">
            <button
              type="button"
              onClick={() => setStep("price")}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Change service or space
            </button>

            <Panel title="Your details">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="contact_name">Contact name</Label>
                  <input id="contact_name" name="contact_name" required autoComplete="name" className="field" />
                </div>
                <div>
                  <Label htmlFor="company_name">Company (optional)</Label>
                  <input id="company_name" name="company_name" autoComplete="organization" className="field" />
                </div>
                <div>
                  <Label htmlFor="phone">Phone (WhatsApp)</Label>
                  <input id="phone" name="phone" type="tel" required autoComplete="tel" className="field" />
                </div>
                <div>
                  <Label htmlFor="email">Email for your receipt</Label>
                  <input id="email" name="email" type="email" required autoComplete="email" className="field" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="address">Address of the space</Label>
                  <input
                    id="address"
                    name="address"
                    required
                    autoComplete="street-address"
                    placeholder={`Street, building, floor${area ? ` — ${area.name}` : ""}`}
                    className="field"
                  />
                </div>
              </div>
            </Panel>

            <Panel title="When should we come?">
              <div className="grid gap-5 sm:grid-cols-[minmax(0,14rem)_1fr]">
                <div>
                  <Label htmlFor="scheduled_date">Date</Label>
                  <input
                    id="scheduled_date"
                    name="scheduled_date"
                    type="date"
                    required
                    min={minDate}
                    defaultValue={minDate}
                    className="field"
                  />
                </div>
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium text-on-surface">Time</legend>
                  <div className={`grid gap-2 ${timeSlots.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                    {timeSlots.map((slot, i) => (
                      <label
                        key={slot.key}
                        className="cursor-pointer rounded-xl border border-surface-container-high p-2.5 text-center text-sm has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-white"
                      >
                        <input
                          type="radio"
                          name="time_slot"
                          value={slot.key}
                          defaultChecked={i === 0}
                          className="sr-only"
                        />
                        <span className="block font-semibold">{slot.label}</span>
                        <span className="block text-xs opacity-70">{slot.hint}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="sm:col-span-2">
                  <Label htmlFor="site_notes">Access notes (optional)</Label>
                  <textarea
                    id="site_notes"
                    name="site_notes"
                    rows={3}
                    placeholder="Gate pass, who to ask for, parking, floor…"
                    className="field h-auto py-3"
                  />
                </div>
              </div>
            </Panel>

            <div className="lg:hidden">{summary}</div>

            <Panel title="Confirm and pay">
              <div className="space-y-4">
                <Checkbox name="confirm_site_requirements">
                  Running water and electricity (mains or generator) will be available at the site for the whole job.
                </Checkbox>
                <Checkbox name="accept_terms">
                  I agree to Kleandeck&apos;s{" "}
                  <Link href="/terms" target="_blank" className="font-semibold text-primary underline underline-offset-4">
                    terms and conditions
                  </Link>
                  .
                </Checkbox>
              </div>
              {submitError && (
                <p role="alert" className="mt-5 rounded-xl bg-error/10 px-4 py-3 text-sm text-error">
                  {submitError}
                </p>
              )}
              <button type="submit" disabled={submitting} className={`${btn.accent} mt-6 w-full`}>
                {submitting ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Lock className="size-4" aria-hidden="true" />
                )}
                {dueNow(service, quote.total) < quote.total
                  ? `Pay ${naira(dueNow(service, quote.total))} deposit with Paystack`
                  : `Pay ${naira(quote.total)} with Paystack`}
              </button>
              <p className="mt-3 text-center text-xs text-outline">
                Card, bank transfer or USSD. You&apos;ll get a receipt by email.
              </p>
            </Panel>
          </form>
        )}

        {step === "quote" && (
          <form onSubmit={submitQuoteRequest} className="animate-fade-up space-y-6">
            <button
              type="button"
              onClick={() => setStep("price")}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Back
            </button>
            <Panel title="Request a quote">
              <p className="-mt-2 mb-5 text-sm text-on-surface-variant">
                We&apos;ll save your request and open WhatsApp with the details filled in, so you can send it to us in
                one tap.
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="q_contact_name">Contact name</Label>
                  <input id="q_contact_name" name="contact_name" required autoComplete="name" className="field" />
                </div>
                <div>
                  <Label htmlFor="q_company_name">Company (optional)</Label>
                  <input id="q_company_name" name="company_name" autoComplete="organization" className="field" />
                </div>
                <div>
                  <Label htmlFor="q_phone">Phone (WhatsApp)</Label>
                  <input id="q_phone" name="phone" type="tel" required autoComplete="tel" className="field" />
                </div>
                <div>
                  <Label htmlFor="q_email">Email (optional)</Label>
                  <input id="q_email" name="email" type="email" autoComplete="email" className="field" />
                </div>
                <div>
                  <Label htmlFor="q_date">Preferred date (optional)</Label>
                  <input id="q_date" name="scheduled_date" type="date" min={minDate} className="field" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="q_message">What do you need?</Label>
                  <textarea
                    id="q_message"
                    name="message"
                    rows={4}
                    required
                    placeholder={
                      quoteOnly
                        ? "e.g. 2 office assistants, Monday to Friday, 8am – 5pm"
                        : "e.g. 3-floor office after a fit-out, about 600 m²"
                    }
                    className="field h-auto py-3"
                  />
                </div>
              </div>
              <div className="mt-5">
                <Checkbox name="accept_terms">
                  I agree to Kleandeck&apos;s{" "}
                  <Link href="/terms" target="_blank" className="font-semibold text-primary underline underline-offset-4">
                    terms and conditions
                  </Link>
                  , including providing running water and electricity on site.
                </Checkbox>
              </div>
              {submitError && (
                <p role="alert" className="mt-5 rounded-xl bg-error/10 px-4 py-3 text-sm text-error">
                  {submitError}
                </p>
              )}
              <button type="submit" disabled={submitting} className={`${btn.whatsapp} mt-6 w-full`}>
                {submitting ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <WhatsAppIcon className="size-5" />
                )}
                Send on WhatsApp
              </button>
            </Panel>
          </form>
        )}
      </div>

      <div className="hidden lg:block">{summary}</div>
    </div>
  );
}
