"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Calculator, Check, Droplets, HandCoins, Minus, Pencil, Plus, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { useUnsavedChangesWarning } from "@/components/admin/guidance";
import { Button, ErrorNote, Field, inputClass, Panel, Switch, useToast } from "@/components/admin/ui";
import { useQuote } from "@/components/booking/use-quote";
import { api } from "@/lib/admin/api";
import { bookingStatuses, statusMeta } from "@/lib/admin/labels";
import type { BookingDetail, BookingStatus, Cleaner, PricingMode, TimeSlot } from "@/lib/admin/types";
import { naira, vatLabel } from "@/lib/format";
import type { Service, Site } from "@/lib/types";

interface FormState {
  status: BookingStatus;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  area: number | null;
  service: string;
  frequency: number | null;
  quantities: Record<string, number>;
  area_sqm: string;
  addon_ids: number[];
  scheduled_date: string;
  time_slot: TimeSlot;
  site_notes: string;
  site_requirements_confirmed: boolean;
  pricing_mode: PricingMode;
  subtotal: string;
  vat_exempt: boolean;
  cleaners: number[];
  internal_notes: string;
}

function defaultsFor(service: Service | undefined) {
  return {
    frequency: service?.frequencies[0]?.id ?? null,
    quantities: Object.fromEntries((service?.units ?? []).map((u) => [String(u.id), u.default_qty])),
    area_sqm: service ? String(service.min_area_sqm * 5) : "",
    addon_ids: [] as number[],
    pricing_mode: (service?.pricing_method === "quote" ? "manual" : "calculated") as PricingMode,
  };
}

function initialState(services: Service[], existing?: BookingDetail): FormState {
  if (existing) {
    return {
      status: existing.status,
      company_name: existing.company_name,
      contact_name: existing.contact_name,
      phone: existing.phone,
      email: existing.email,
      address: existing.address,
      area: existing.area,
      service: existing.service,
      frequency: existing.frequency,
      quantities: Object.fromEntries(
        Object.entries(existing.inputs.quantities ?? {}).map(([k, v]) => [String(k), Number(v)]),
      ),
      area_sqm: existing.inputs.area_sqm ? String(existing.inputs.area_sqm) : "",
      addon_ids: existing.inputs.addon_ids ?? [],
      scheduled_date: existing.scheduled_date ?? "",
      time_slot: existing.time_slot,
      site_notes: existing.site_notes,
      site_requirements_confirmed: existing.site_requirements_confirmed,
      pricing_mode: existing.pricing_mode,
      subtotal: existing.pricing_mode === "manual" ? String(existing.subtotal || "") : "",
      vat_exempt: existing.vat_exempt,
      cleaners: existing.cleaners.map((c) => c.id),
      internal_notes: existing.internal_notes,
    };
  }
  const first = services[0];
  return {
    status: "awaiting_payment",
    company_name: "",
    contact_name: "",
    phone: "",
    email: "",
    address: "",
    area: null,
    service: first?.slug ?? "",
    ...defaultsFor(first),
    scheduled_date: "",
    time_slot: "morning",
    site_notes: "",
    site_requirements_confirmed: false,
    subtotal: "",
    vat_exempt: false,
    cleaners: [],
    internal_notes: "",
  };
}

const bookingSteps = [
  { id: "client", label: "Client details", description: "Who the job is for and how to reach them.", fields: ["company_name", "contact_name", "phone", "email", "address", "area"] },
  { id: "service", label: "Service & space", description: "Choose the service, the size of the job and any extras.", fields: ["service", "frequency", "inputs"] },
  { id: "schedule", label: "Schedule & team", description: "Set an arrival time and assign cleaners. You can leave these for later.", fields: ["scheduled_date", "time_slot", "cleaners", "site_notes"] },
  { id: "notes", label: "Site & notes", description: "Confirm site access requirements and add notes for your team.", fields: ["site_requirements_confirmed", "internal_notes"] },
  { id: "review", label: "Review & billing", description: "Check the booking, confirm the price and save when everything is ready.", fields: ["subtotal", "pricing_mode", "vat_exempt", "status"] },
] as const;

type BookingStep = (typeof bookingSteps)[number]["id"];

function Section({ step, active, title, description, children }: { step: BookingStep; active: boolean; title: string; description?: string; children: React.ReactNode }) {
  return (
    <div hidden={!active} data-booking-step={step} role="region" aria-label={title} tabIndex={-1} className="scroll-mt-20 lg:scroll-mt-6">
      <Panel title={title} description={description} bodyClassName="p-5 sm:p-6">{children}</Panel>
    </div>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-xl border border-surface-container-high p-3 text-center">
      <p className="text-xs font-semibold text-on-surface-variant">{label}</p>
      <div className="mt-2 flex items-center justify-center gap-2">
        <button
          type="button"
          aria-label={`Fewer ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid size-8 place-items-center rounded-lg bg-surface-container disabled:opacity-40"
        >
          <Minus className="size-3.5" />
        </button>
        <span className="tabular w-8 font-display text-xl font-bold">{value}</span>
        <button
          type="button"
          aria-label={`More ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid size-8 place-items-center rounded-lg bg-surface-container disabled:opacity-40"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function BookingForm({ services, site, existing }: { services: Service[]; site: Site; existing?: BookingDetail }) {
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => initialState(services, existing));
  const [baseline] = useState(form);
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<BookingStep>("client");
  const [paidNow, setPaidNow] = useState(false);
  const [paidMethod, setPaidMethod] = useState("bank_transfer");
  const [paidAmount, setPaidAmount] = useState("");
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline) || paidNow;
  useUnsavedChangesWarning(dirty);

  function goTo(next: BookingStep) {
    setStep(next);
    requestAnimationFrame(() => {
      const section = formRef.current?.querySelector<HTMLElement>(`[data-booking-step="${next}"]`);
      section?.focus({ preventScroll: true });
      section?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }

  function validate(scope: HTMLElement | null) {
    const invalid = Array.from(scope?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea") ?? [])
      .find((field) => !field.disabled && !field.checkValidity());
    if (!invalid) return true;
    const invalidStep = invalid.closest<HTMLElement>("[data-booking-step]")?.dataset.bookingStep as BookingStep | undefined;
    if (invalidStep) setStep(invalidStep);
    requestAnimationFrame(() => {
      invalid.focus();
      invalid.reportValidity();
    });
    return false;
  }

  const stepIndex = bookingSteps.findIndex((item) => item.id === step);
  const nextStep = bookingSteps[stepIndex + 1];
  const previousStep = bookingSteps[stepIndex - 1];
  const continueToNext = () => {
    if (nextStep && validate(formRef.current?.querySelector<HTMLElement>(`[data-booking-step="${step}"]`) ?? null)) goTo(nextStep.id);
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const service = services.find((s) => s.slug === form.service);
  const quoteOnly = service?.pricing_method === "quote";

  const { data: cleaners } = useQuery({
    queryKey: ["cleaners", "active"],
    queryFn: () => api<Cleaner[]>("cleaners/", { query: { active: "1" } }),
  });

  const quoteInputs = useMemo(
    () => ({
      service: form.service,
      frequency: form.frequency,
      area: form.area,
      quantities: service?.pricing_method === "per_unit" ? form.quantities : {},
      area_sqm: service?.pricing_method === "per_sqm" && Number(form.area_sqm) > 0 ? Number(form.area_sqm) : null,
      addon_ids: form.addon_ids,
    }),
    [form.service, form.frequency, form.area, form.quantities, form.area_sqm, form.addon_ids, service],
  );
  const calculated = form.pricing_mode === "calculated" && !quoteOnly;
  const { quote, error: quoteError, loading: quoteLoading } = useQuote(quoteInputs, calculated && !!service);

  // Totals shown in the summary panel. The server recomputes on save.
  const vatRate = site.vat_enabled && !form.vat_exempt ? Number(site.vat_rate) : 0;
  const manualSubtotal = Number(form.subtotal) || 0;
  const subtotal = calculated ? (quote?.subtotal ?? 0) : manualSubtotal;
  const vat = calculated && !form.vat_exempt ? (quote?.vat_amount ?? 0) : Math.round((manualSubtotal * vatRate) / 100);
  const total = subtotal + vat;

  function chooseService(next: Service) {
    setForm((f) => ({ ...f, service: next.slug, ...defaultsFor(next) }));
  }

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        status: form.status,
        company_name: form.company_name,
        contact_name: form.contact_name,
        phone: form.phone,
        email: form.email,
        address: form.address,
        area: form.area,
        service: form.service,
        frequency: form.frequency,
        inputs: {
          quantities: service?.pricing_method === "per_unit" ? form.quantities : {},
          area_sqm: service?.pricing_method === "per_sqm" ? Number(form.area_sqm) || null : null,
          addon_ids: form.addon_ids,
        },
        pricing_mode: quoteOnly ? "manual" : form.pricing_mode,
        subtotal: calculated ? null : manualSubtotal,
        vat_exempt: form.vat_exempt,
        scheduled_date: form.scheduled_date || null,
        time_slot: form.time_slot,
        site_notes: form.site_notes,
        site_requirements_confirmed: form.site_requirements_confirmed,
        cleaners: form.cleaners,
        internal_notes: form.internal_notes,
      };
      let booking = existing
        ? await api<BookingDetail>(`bookings/${existing.reference}/`, { method: "PATCH", body })
        : await api<BookingDetail>("bookings/", { method: "POST", body });
      if (!existing && paidNow) {
        booking = await api<BookingDetail>(`bookings/${booking.reference}/record-payment/`, {
          method: "POST",
          body: { method: paidMethod, amount: Number(paidAmount) || undefined },
        });
      }
      return booking;
    },
    onSuccess: (booking) => {
      client.invalidateQueries({ queryKey: ["bookings"] });
      client.invalidateQueries({ queryKey: ["dashboard"] });
      client.setQueryData(["booking", booking.reference], booking);
      toast(existing ? "Booking updated" : `Booking ${booking.reference} created`);
      router.push(`/admin/bookings/${booking.reference}`);
    },
    onError: (error) => {
      const fields = "fields" in error ? (error as { fields: Record<string, string> }).fields : {};
      const target = bookingSteps.find((item) => item.fields.some((field) => fields[field]));
      if (target) goTo(target.id);
    },
  });

  const fieldError = (name: string) =>
    save.error && "fields" in save.error ? (save.error as { fields: Record<string, string> }).fields[name] : undefined;

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (step !== "review") continueToNext();
        else if (validate(formRef.current)) save.mutate();
      }}
      className="space-y-6 pb-24"
    >
      <nav aria-label="Booking steps" className="rounded-2xl border border-surface-container-high bg-surface p-2 shadow-card">
        <ol className="grid grid-cols-5 gap-1">
          {bookingSteps.map((item, index) => (
            <li key={item.id} className="min-w-0">
              <button type="button" aria-current={step === item.id ? "step" : undefined} onClick={() => goTo(item.id)}
                className={`flex w-full min-w-0 flex-col items-center gap-2 rounded-xl px-1 py-3 text-center text-xs font-semibold transition sm:flex-row sm:px-3 sm:text-left sm:text-sm ${step === item.id ? "bg-primary text-white" : "text-on-surface-variant hover:bg-surface-container-low"}`}>
                <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs ${step === item.id ? "bg-white/15 text-white" : "bg-surface-container text-on-surface-variant"}`}>{index + 1}</span>
                <span className="hidden sm:block">{item.label}</span>
                <span className="sr-only sm:hidden">{item.label}</span>
              </button>
            </li>
          ))}
        </ol>
        <p className="px-3 pt-2 pb-1 text-sm text-on-surface-variant sm:hidden">Step {stepIndex + 1} of 5 · <span className="font-semibold text-on-surface">{bookingSteps[stepIndex].label}</span></p>
      </nav>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        <ErrorNote error={save.error} />
        <Section step="client" active={step === "client"} title="Client details" description={bookingSteps[0].description}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company (optional)">
              {(id) => (
                <input id={id} value={form.company_name} onChange={(e) => set("company_name", e.target.value)} className={inputClass} />
              )}
            </Field>
            <Field label="Contact name" error={fieldError("contact_name")}>
              {(id) => (
                <input id={id} required value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} className={inputClass} />
              )}
            </Field>
            <Field label="Phone (WhatsApp)" error={fieldError("phone")}>
              {(id) => (
                <input id={id} required type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass} />
              )}
            </Field>
            <Field label="Email" hint="Optional contact for confirmations and receipts" error={fieldError("email")}>
              {(id) => (
                <input id={id} type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} />
              )}
            </Field>
            <Field label="Address" className="sm:col-span-2">
              {(id) => (
                <input
                  id={id}
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Street, building, floor"
                  className={inputClass}
                />
              )}
            </Field>
            <Field label="Area">
              {(id) => (
                <select
                  id={id}
                  value={form.area ?? ""}
                  onChange={(e) => set("area", e.target.value ? Number(e.target.value) : null)}
                  className={inputClass}
                >
                  <option value="">Choose area</option>
                  {site.areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.surcharge ? ` (+${naira(a.surcharge)})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        </Section>

        <Section step="service" active={step === "service"} title="Service and space" description={bookingSteps[1].description}>
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((s) => {
              const selected = s.slug === form.service;
              return (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => chooseService(s)}
                  aria-pressed={selected}
                  className={`rounded-xl border p-3 text-left transition ${
                    selected ? "border-primary bg-primary text-white" : "border-surface-container-high hover:border-tertiary"
                  }`}
                >
                  <span className="block text-sm font-semibold">{s.name}</span>
                  <span className={`block text-xs ${selected ? "text-white/70" : "text-on-surface-variant"}`}>
                    {s.pricing_method === "quote" ? "Custom quote" : `From ${naira(s.starting_price ?? 0)}`}
                  </span>
                </button>
              );
            })}
          </div>

          {service && !quoteOnly && service.frequencies.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[13px] font-semibold">Frequency</p>
              <div className="flex flex-wrap gap-2">
                {service.frequencies.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => set("frequency", f.id)}
                    aria-pressed={form.frequency === f.id}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      form.frequency === f.id
                        ? "border-secondary bg-secondary text-white"
                        : "border-surface-container-high hover:border-tertiary"
                    }`}
                  >
                    {f.label}
                    {Number(f.discount_percent) > 0 && ` (−${Number(f.discount_percent)}%)`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {service?.pricing_method === "per_unit" && (
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              {service.units.map((u) => (
                <Stepper
                  key={u.id}
                  label={u.label}
                  value={form.quantities[String(u.id)] ?? u.default_qty}
                  min={u.min_qty}
                  max={u.max_qty}
                  onChange={(v) => set("quantities", { ...form.quantities, [String(u.id)]: v })}
                />
              ))}
            </div>
          )}
          {service?.pricing_method === "per_sqm" && (
            <Field label="Floor area (m²)" className="mt-5 max-w-xs" hint={`${naira(service.rate_per_sqm)} per m²`}>
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={service.min_area_sqm}
                  max={service.max_area_sqm}
                  value={form.area_sqm}
                  onChange={(e) => set("area_sqm", e.target.value)}
                  className={`${inputClass} tabular`}
                />
              )}
            </Field>
          )}
          {service && service.addons.length > 0 && !quoteOnly && (
            <div className="mt-5 flex flex-wrap gap-2">
              {service.addons.map((a) => {
                const on = form.addon_ids.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set("addon_ids", on ? form.addon_ids.filter((i) => i !== a.id) : [...form.addon_ids, a.id])
                    }
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition ${
                      on ? "border-secondary bg-secondary-container text-on-secondary-container" : "border-surface-container-high"
                    }`}
                  >
                    {on && <Check className="size-3.5" />}
                    {a.label} · {naira(a.price)}
                  </button>
                );
              })}
            </div>
          )}
        </Section>

        <Section step="schedule" active={step === "schedule"} title="Schedule and team" description={bookingSteps[2].description}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" error={fieldError("scheduled_date")}>
              {(id) => (
                <input
                  id={id}
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) => set("scheduled_date", e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
            <Field label="Time">
              {(id) => (
                <select
                  id={id}
                  value={form.time_slot}
                  onChange={(e) => set("time_slot", e.target.value)}
                  className={inputClass}
                >
                  <option value="">To be agreed</option>
                  {(service?.time_slots.length ? service.time_slots : site.time_slots).map((slot) => (
                    <option key={slot.key} value={slot.key}>
                      {slot.label}
                      {slot.hint ? ` · ${slot.hint}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
          <div className="mt-5">
            <p className="mb-2 text-[13px] font-semibold">Assign cleaners</p>
            {cleaners?.length ? (
              <div className="flex flex-wrap gap-2">
                {cleaners.map((c) => {
                  const on = form.cleaners.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("cleaners", on ? form.cleaners.filter((i) => i !== c.id) : [...form.cleaners, c.id])}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition ${
                        on ? "border-primary bg-primary text-white" : "border-surface-container-high hover:border-tertiary"
                      }`}
                    >
                      {on && <Check className="size-3.5" />}
                      {c.full_name}
                      <span className={`text-xs ${on ? "text-white/60" : "text-outline"}`}>{c.role}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">No active cleaners yet. Add them on the Cleaners page.</p>
            )}
          </div>
          <Field label="Access notes" className="mt-5">
            {(id) => (
              <textarea
                id={id}
                rows={2}
                value={form.site_notes}
                onChange={(e) => set("site_notes", e.target.value)}
                placeholder="Gate pass, who to ask for, floor, parking…"
                className={`${inputClass} h-auto py-2.5`}
              />
            )}
          </Field>
        </Section>

        <Section step="notes" active={step === "notes"} title="Site requirements and notes" description={bookingSteps[3].description}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3 text-sm">
              <Droplets className="size-5 text-tertiary" /> Running water
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3 text-sm">
              <Zap className="size-5 text-warning" /> Electricity (mains or generator)
            </div>
          </div>
          <div className="mt-4">
            <Switch
              checked={form.site_requirements_confirmed}
              onChange={(v) => set("site_requirements_confirmed", v)}
              label="Customer confirmed water and power will be available"
            />
          </div>
          <Field label="Internal notes" hint="Only the team sees these" className="mt-5">
            {(id) => (
              <textarea
                id={id}
                rows={3}
                value={form.internal_notes}
                onChange={(e) => set("internal_notes", e.target.value)}
                className={`${inputClass} h-auto py-2.5`}
              />
            )}
          </Field>
        </Section>
      <div hidden={step !== "review"} data-booking-step="review" role="region" aria-label="Review and billing" tabIndex={-1} className="scroll-mt-20 space-y-5 lg:scroll-mt-6">
        <Panel title="Review and billing" description={bookingSteps[4].description} bodyClassName="p-5 sm:p-6">
          <h3 className="text-sm font-semibold">{service?.name ?? "Choose a service"}</h3>

          {!quoteOnly && (
            <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-surface-container p-1 text-sm font-semibold">
              {(
                [
                  ["calculated", "Rate card", Calculator],
                  ["manual", "Agreed price", HandCoins],
                ] as const
              ).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set("pricing_mode", mode)}
                  aria-pressed={form.pricing_mode === mode}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 transition ${
                    form.pricing_mode === mode ? "bg-surface text-primary shadow-card" : "text-on-surface-variant hover:text-primary"
                  }`}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 space-y-2 text-sm">
            {calculated ? (
              quoteError ? (
                <p role="alert" className="rounded-lg bg-warning/10 px-3 py-2 text-on-warning-container">{quoteError}</p>
              ) : quote ? (
                <div className={`space-y-2 ${quoteLoading ? "opacity-60" : ""}`}>
                  {quote.lines.map((l) => (
                    <div key={l.label} className="flex justify-between gap-3 text-on-surface-variant">
                      <span>{l.label}</span>
                      <span className="tabular">{naira(l.amount)}</span>
                    </div>
                  ))}
                  {quote.discount_amount > 0 && (
                    <div className="flex justify-between text-on-surface-variant">
                      <span>Frequency discount</span>
                      <span className="tabular">−{naira(quote.discount_amount)}</span>
                    </div>
                  )}
                  {quote.area_surcharge > 0 && (
                    <div className="flex justify-between text-on-surface-variant">
                      <span>Area surcharge</span>
                      <span className="tabular">{naira(quote.area_surcharge)}</span>
                    </div>
                  )}
                  {quote.visits > 1 && (
                    <div className="flex justify-between text-on-surface-variant">
                      <span>× {quote.visits} visits</span>
                      <span className="tabular">{naira(quote.subtotal)}</span>
                    </div>
                  )}
                  {quote.requires_quote && (
                    <p className="rounded-lg bg-tertiary/10 px-3 py-2 text-xs text-on-surface-variant">
                      Above the online limit. Fine for staff bookings, or switch to an agreed price.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-on-surface-variant">Calculating…</p>
              )
            ) : (
              <Field label="Agreed price before VAT (₦)" error={fieldError("subtotal")}>
                {(id) => (
                  <input
                    id={id}
                    type="number"
                    min={0}
                    required
                    value={form.subtotal}
                    onChange={(e) => set("subtotal", e.target.value)}
                    className={`${inputClass} tabular font-semibold`}
                    placeholder="0"
                  />
                )}
              </Field>
            )}
          </div>

          <div className="my-5 h-px bg-surface-container-high" />
          <div className="space-y-2 text-sm text-on-surface-variant">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="tabular">{naira(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT {form.vat_exempt ? "(exempt)" : `(${vatLabel(site.vat_rate)})`}</span>
              <span className="tabular">{naira(vat)}</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-container-low p-4">
            <p className="text-sm font-semibold text-on-surface">Total payable</p>
            <p className="tabular font-display text-2xl font-bold text-primary">{naira(total)}</p>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-on-surface-variant">
            <input
              type="checkbox"
              checked={form.vat_exempt}
              onChange={(e) => set("vat_exempt", e.target.checked)}
              className="size-4 accent-secondary"
            />
            VAT exempt
          </label>
        </Panel>

        <Panel title="Status and payment" bodyClassName="p-5 space-y-4 sm:p-6">
          <Field label="Status">
            {(id) => (
              <select
                id={id}
                value={form.status}
                onChange={(e) => set("status", e.target.value as BookingStatus)}
                className={inputClass}
              >
                {bookingStatuses.map((s) => (
                  <option key={s} value={s}>
                    {statusMeta[s].label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {!existing && (
            <div className="space-y-3 rounded-xl bg-surface-container-low p-3">
              <Switch checked={paidNow} onChange={setPaidNow} label="Customer has already paid" />
              {paidNow && (
                <div className="grid grid-cols-2 gap-2">
                  <select value={paidMethod} onChange={(e) => setPaidMethod(e.target.value)} className={inputClass} aria-label="Payment method">
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder={`Full: ${total}`}
                    aria-label="Amount paid"
                    className={`${inputClass} tabular`}
                  />
                </div>
              )}
            </div>
          )}

        </Panel>
      </div>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-6">
        <div className={step === "review" ? "" : "hidden xl:block"}>
        <Panel title="Booking at a glance" bodyClassName="divide-y divide-surface-container px-5">
          {([
            ["client", "Client", form.company_name || form.contact_name || "Add client details", form.phone],
            ["service", "Service", service?.name || "Choose a service", site.areas.find((area) => area.id === form.area)?.name ?? "Area not selected"],
            ["schedule", "Schedule", form.scheduled_date || "Date to be agreed", form.cleaners.length ? `${form.cleaners.length} cleaner${form.cleaners.length > 1 ? "s" : ""} assigned` : "Team not assigned"],
            ["notes", "Site", form.site_requirements_confirmed ? "Water and power confirmed" : "Requirements to confirm", form.internal_notes ? "Internal notes added" : ""],
          ] as const).map(([target, label, value, detail]) => (
            <button key={target} type="button" onClick={() => goTo(target)} aria-label={`Edit ${label.toLowerCase()}`} className="group flex w-full items-start justify-between gap-3 py-4 text-left">
              <span className="min-w-0">
                <span className="block text-xs text-on-surface-variant">{label}</span>
                <span className="mt-1 block break-words text-sm font-semibold text-on-surface">{value}</span>
                {detail && <span className="mt-1 block text-xs text-on-surface-variant">{detail}</span>}
              </span>
              <Pencil className="mt-1 size-3.5 shrink-0 text-outline transition group-hover:text-primary" aria-hidden="true" />
            </button>
          ))}
        </Panel>
        </div>
        {step !== "review" && (
          <div className="rounded-2xl border border-surface-container-high bg-surface p-5">
            <p className="text-xs text-on-surface-variant">Estimated total, including VAT</p>
            <p className="tabular mt-1 font-display text-2xl font-bold text-primary">{quoteLoading ? "Calculating…" : naira(total)}</p>
            <p className="mt-2 text-xs leading-5 text-on-surface-variant">{calculated ? "Updates as you choose the service and space." : "Enter the agreed price in Review & billing."}</p>
            <button type="button" onClick={() => goTo("review")} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">Review billing <ArrowRight className="size-3.5" aria-hidden="true" /></button>
          </div>
        )}
      </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-container-high bg-surface/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div>
            {previousStep ? <Button variant="ghost" onClick={() => goTo(previousStep.id)}><ArrowLeft className="size-4" aria-hidden="true" /> Back</Button> : <p className="text-xs text-on-surface-variant">Step 1 of 5</p>}
          </div>
          <p className="hidden text-xs text-on-surface-variant md:block">{dirty ? "Unsaved booking" : "Work through each section, then review"}</p>
          {nextStep ? (
            <Button onClick={continueToNext}>Continue <ArrowRight className="size-4" aria-hidden="true" /></Button>
          ) : (
            <Button type="submit" variant="accent" loading={save.isPending}>{existing ? "Save changes" : "Create booking"}</Button>
          )}
        </div>
      </div>
    </form>
  );
}
