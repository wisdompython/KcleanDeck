"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Calculator, Copy, Eye, EyeOff, HandCoins, Lightbulb, Lock, Plus, Ruler, Tag, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { useIsOwner } from "@/components/admin/auth";
import { GuidedTabs, InfoTip, SaveBar, type TabItem } from "@/components/admin/guidance";
import { PhotoUploader } from "@/components/admin/photo-uploader";
import { PriceTester } from "@/components/admin/price-tester";
import { BackLink } from "@/components/admin/screens/booking-editor";
import {
  Button,
  buttonClass,
  Chip,
  ErrorNote,
  Field,
  inputClass,
  PageHeader,
  Panel,
  Spinner,
  Switch,
  useToast,
} from "@/components/admin/ui";
import { api } from "@/lib/admin/api";
import type {
  AdminAddOn,
  AdminArea,
  AdminCategory,
  AdminFrequency,
  AdminService,
  AdminTimeSlot,
  AdminUnit,
} from "@/lib/admin/types";
import { naira } from "@/lib/format";

const methods = [
  { value: "per_unit", label: "Per room / unit", icon: Calculator, body: "Base + a price for each room, restroom, kitchen…" },
  { value: "per_sqm", label: "Per square metre", icon: Ruler, body: "Base + floor area × rate. Good for post-construction." },
  { value: "flat", label: "Flat price", icon: Tag, body: "One price per visit, whatever the size." },
  { value: "quote", label: "Custom quote", icon: HandCoins, body: "No online price. Customers are sent to WhatsApp." },
] as const;

const methodLabel = Object.fromEntries(methods.map((m) => [m.value, m.label]));

function ReadOnlyBanner() {
  return (
    <p className="mb-5 flex items-center gap-2 rounded-xl bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
      <Lock className="size-4" /> Only owners can change services and rates.
    </p>
  );
}

export function ServicesScreen() {
  const isOwner = useIsOwner();
  const { data, error, isPending } = useQuery({ queryKey: ["admin-services"], queryFn: () => api<AdminService[]>("services/") });

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Pricing"
        title="Services & prices"
        description="What customers can book and how each price is worked out. Changes show on the website straight away."
        actions={
          isOwner && (
            <Link href="/admin/services/new" className={buttonClass("accent")}>
              <Plus className="size-4" /> New service
            </Link>
          )
        }
      />
      {!isOwner && <ReadOnlyBanner />}
      <ErrorNote error={error} />
      {isPending ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.map((s) => (
            <Link
              key={s.id}
              href={`/admin/services/${s.id}`}
              className={`group overflow-hidden rounded-2xl border border-surface-container bg-surface shadow-card transition hover:-translate-y-0.5 hover:border-tertiary hover:shadow-pop ${s.is_active ? "" : "opacity-60"}`}
            >
              <div className="relative aspect-[16/7] bg-surface-container">
                {s.photo_card_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.photo_card_url} alt="" className="absolute inset-0 size-full object-cover" />
                )}
              </div>
              <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">{s.name}</p>
                  <p className="mt-0.5 text-xs text-on-surface-variant">{methodLabel[s.pricing_method]}</p>
                </div>
                {s.is_active ? (
                  <Chip className="bg-secondary/10 text-on-secondary-container">
                    <Eye className="size-3" /> Live
                  </Chip>
                ) : (
                  <Chip className="bg-surface-container text-on-surface-variant">
                    <EyeOff className="size-3" /> Hidden
                  </Chip>
                )}
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-on-surface-variant">{s.tagline}</p>
              <div className="mt-4 flex items-end justify-between border-t border-surface-container pt-4">
                <div>
                  <p className="text-xs text-outline">From (before VAT)</p>
                  <p className="tabular font-display text-xl font-bold">
                    {s.starting_price === null ? "Custom quote" : naira(s.starting_price)}
                  </p>
                </div>
                <p className="text-xs text-on-surface-variant">
                  {s.booking_count} booking{s.booking_count === 1 ? "" : "s"}
                </p>
              </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const emptyService: Omit<AdminService, "id" | "starting_price" | "booking_count"> = {
  name: "",
  slug: "",
  tagline: "",
  description: "",
  includes: "",
  badge: "",
  image: "",
  pricing_method: "per_unit",
  base_price: 0,
  rate_per_sqm: 0,
  min_area_sqm: 10,
  max_area_sqm: 5000,
  minimum_charge: 0,
  quote_threshold: null,
  price_suffix: "per visit",
  frequencies: [],
  sort_order: 0,
  is_active: true,
  units: [],
  addons: [],
  time_slots: [],
  min_lead_days: null,
  deposit_percent: 0,
  categories: [],
  area_prices: [],
  photo_url: "",
  photo_card_url: "",
  photo_width: 0,
  has_photo: false,
};

type Draft = typeof emptyService & { id?: number; starting_price?: number | null };

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function startingPrice(d: Draft): number | null {
  if (d.pricing_method === "quote") return null;
  let amount = d.base_price;
  if (d.pricing_method === "per_unit") amount += d.units.reduce((sum, u) => sum + u.price * u.min_qty, 0);
  if (d.pricing_method === "per_sqm") amount += d.rate_per_sqm * d.min_area_sqm;
  return Math.max(amount, d.minimum_charge);
}

function NumberInput({ value, onChange, disabled, prefix, ...rest }: { value: number; onChange: (v: number) => void; disabled?: boolean; prefix?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-outline">{prefix}</span>}
      <input
        type="number"
        min={0}
        {...rest}
        value={Number.isFinite(value) ? value : ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className={`${inputClass} tabular ${prefix ? "pl-7" : ""}`}
      />
    </div>
  );
}

export function ServiceEditorScreen() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const service = useQuery({
    queryKey: ["admin-service", id],
    queryFn: () => api<AdminService>(`services/${id}/`),
    enabled: !isNew,
  });
  const frequencies = useQuery({ queryKey: ["admin-frequencies"], queryFn: () => api<AdminFrequency[]>("frequencies/") });
  const areas = useQuery({ queryKey: ["admin-areas"], queryFn: () => api<AdminArea[]>("areas/") });
  const slots = useQuery({ queryKey: ["admin-time-slots"], queryFn: () => api<AdminTimeSlot[]>("time-slots/") });
  const categories = useQuery({ queryKey: ["admin-categories"], queryFn: () => api<AdminCategory[]>("categories/") });

  if (!isNew && service.isPending) return <Spinner />;
  if (service.error) return <ErrorNote error={service.error} />;
  return (
    <ServiceEditor
      key={id}
      initial={isNew ? { ...emptyService } : (service.data as Draft)}
      options={{
        frequencies: frequencies.data ?? [],
        areas: areas.data ?? [],
        slots: slots.data ?? [],
        categories: categories.data ?? [],
      }}
    />
  );
}

type EditorOptions = {
  frequencies: AdminFrequency[];
  areas: AdminArea[];
  slots: AdminTimeSlot[];
  categories: AdminCategory[];
};

function Chips<T extends { id: number }>({
  items,
  selected,
  label,
  onChange,
}: {
  items: T[];
  selected: number[];
  label: (item: T) => React.ReactNode;
  onChange: (ids: number[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const on = selected.includes(item.id);
        return (
          <label
            key={item.id}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition has-[:disabled]:cursor-default ${on ? "border-secondary bg-secondary-container text-on-secondary-container" : "border-surface-container-high"}`}
          >
            <input
              type="checkbox"
              checked={on}
              onChange={() => onChange(on ? selected.filter((x) => x !== item.id) : [...selected, item.id])}
              className="sr-only"
            />
            {label(item)}
          </label>
        );
      })}
    </div>
  );
}

function ServiceEditor({ initial, options }: { initial: Draft; options: EditorOptions }) {
  const { frequencies, areas, slots, categories } = options;
  const isOwner = useIsOwner();
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const [d, setD] = useState<Draft>(initial);
  const [saved, setSaved] = useState<Draft>(initial);
  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const isNew = !d.id;
  const ro = !isOwner;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setUnit = (i: number, patch: Partial<AdminUnit>) =>
    set("units", d.units.map((u, j) => (j === i ? { ...u, ...patch } : u)));
  const setAddon = (i: number, patch: Partial<AdminAddOn>) =>
    set("addons", d.addons.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  const save = useMutation({
    mutationFn: () =>
      isNew
        ? api<AdminService>("services/", { method: "POST", body: d })
        : api<AdminService>(`services/${d.id}/`, { method: "PATCH", body: d }),
    onSuccess: (saved) => {
      client.invalidateQueries({ queryKey: ["admin-services"] });
      client.invalidateQueries({ queryKey: ["public-services"] });
      client.setQueryData(["admin-service", String(saved.id)], saved);
      toast(isNew ? "Service created" : "Service saved");
      if (isNew) router.replace(`/admin/services/${saved.id}`);
      else {
        setD(saved);
        setSaved(saved);
      }
    },
  });
  const duplicate = useMutation({
    mutationFn: () => api<AdminService>(`services/${d.id}/duplicate/`, { method: "POST" }),
    onSuccess: (copy) => {
      client.invalidateQueries({ queryKey: ["admin-services"] });
      toast(`Created "${copy.name}" (hidden until you turn it on)`);
      router.push(`/admin/services/${copy.id}`);
    },
    onError: (e) => toast(e.message, "error"),
  });
  const surchargeFor = (areaId: number) => d.area_prices.find((p) => p.area === areaId)?.surcharge;
  const setSurcharge = (areaId: number, value: string) =>
    set(
      "area_prices",
      value === ""
        ? d.area_prices.filter((p) => p.area !== areaId)
        : [...d.area_prices.filter((p) => p.area !== areaId), { area: areaId, surcharge: Number(value) }],
    );
  const remove = useMutation({
    mutationFn: () => api(`services/${d.id}/`, { method: "DELETE" }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["admin-services"] });
      toast("Service deleted");
      router.replace("/admin/services");
    },
    onError: (e) => toast(e.message, "error"),
  });

  const fieldError = (name: string) =>
    save.error && "fields" in save.error ? (save.error as { fields: Record<string, string> }).fields[name] : undefined;
  const from = startingPrice(d);
  const quoteOnly = d.pricing_method === "quote";

  // Tabs live in the URL so a link can open the right one.
  const params = useSearchParams();
  const pathname = usePathname();
  const requestedTab = params.get("tab");
  const tab: EditorTab = requestedTab === "pricing" || requestedTab === "booking" ? requestedTab : "basics";
  const goTo = (next: EditorTab) => {
    router.replace(`${pathname}?tab=${next}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const hasErrorIn = (t: EditorTab) => TAB_FIELDS[t].some((f) => fieldError(f));
  const tabs: TabItem<EditorTab>[] = [
    {
      id: "basics",
      label: "Basics",
      description: "What customers read about this service: its name, description, photo and where it appears.",
      alert: hasErrorIn("basics"),
    },
    {
      id: "pricing",
      label: "Pricing",
      description: "How the price is worked out: the starting price, what customers count (rooms or floor area), extras and discounts.",
      alert: hasErrorIn("pricing"),
    },
    {
      id: "booking",
      label: "Booking rules",
      description: "When and how customers can book: arrival times, how far ahead, deposits and travel charges.",
      alert: hasErrorIn("booking"),
    },
  ];
  const order: EditorTab[] = ["basics", "pricing", "booking"];
  const next = order[order.indexOf(tab) + 1];
  const prev = order[order.indexOf(tab) - 1];

  return (
    <div className="animate-fade-up pb-20">
      <BackLink href="/admin/services" label="Services & prices" />
      <PageHeader
        eyebrow={isNew ? "New service" : "Edit service"}
        title={d.name || "Untitled service"}
        description={isNew ? "Fill in the three tabs, then save. You can come back and change anything later." : undefined}
        actions={
          isOwner && (
            <>
              {!isNew && (
                <>
                  <Button variant="ghost" loading={duplicate.isPending} onClick={() => duplicate.mutate()}>
                    <Copy className="size-4" /> Duplicate
                  </Button>
                  <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
                    <Trash2 className="size-4" /> Delete
                  </Button>
                </>
              )}
              <Button variant="accent" loading={save.isPending} onClick={() => save.mutate()}>
                {isNew ? "Create service" : "Save service"}
              </Button>
            </>
          )
        }
      />
      {ro && <ReadOnlyBanner />}
      <div className="mb-5">
        <ErrorNote error={save.error} />
      </div>

      <GuidedTabs id="service" label="Service sections" tabs={tabs} value={tab} onChange={goTo} numbered />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <fieldset id="service-panel" role="tabpanel" aria-labelledby={`service-tab-${tab}`} tabIndex={0} disabled={ro} className="min-w-0 space-y-5">
          {tab === "basics" && (
            <>
              <Panel title="Name and description" description="Shown on the service card, the pricing page and the booking form">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" error={fieldError("name")}>
                    {(id) => (
                      <input
                        id={id}
                        value={d.name}
                        onChange={(e) => setD((x) => ({ ...x, name: e.target.value, slug: isNew ? slugify(e.target.value) : x.slug }))}
                        placeholder="e.g. Window cleaning"
                        className={inputClass}
                      />
                    )}
                  </Field>
                  <Field
                    label="Web address"
                    hint={`kleandeck.com/book?service=${d.slug || "…"}`}
                    error={fieldError("slug")}
                    tip="The short name used in links to this service. It's filled in from the name; you rarely need to change it."
                  >
                    {(id) => <input id={id} value={d.slug} onChange={(e) => set("slug", slugify(e.target.value))} className={inputClass} />}
                  </Field>
                  <Field label="One-line summary" hint="Shown under the name on the service card" className="sm:col-span-2" error={fieldError("tagline")}>
                    {(id) => <input id={id} value={d.tagline} onChange={(e) => set("tagline", e.target.value)} className={inputClass} />}
                  </Field>
                  <Field label="Description" hint="A sentence or two shown on the booking page" className="sm:col-span-2">
                    {(id) => <textarea id={id} rows={2} value={d.description} onChange={(e) => set("description", e.target.value)} className={`${inputClass} h-auto py-2.5`} />}
                  </Field>
                  <Field label="What's included" hint="One item per line. Shown as a checklist on the pricing page." className="sm:col-span-2">
                    {(id) => <textarea id={id} rows={5} value={d.includes} onChange={(e) => set("includes", e.target.value)} className={`${inputClass} h-auto py-2.5`} />}
                  </Field>
                  <Field label="Badge" hint='Optional label on the photo, e.g. "Most booked"'>
                    {(id) => <input id={id} value={d.badge} onChange={(e) => set("badge", e.target.value)} className={inputClass} />}
                  </Field>
                  <Field label="Position in lists" hint="1 shows first, 2 second, and so on">
                    {(id) => <NumberInput id={id} value={d.sort_order} onChange={(v) => set("sort_order", v)} />}
                  </Field>
                </div>
              </Panel>

              <Panel title="Photo" description="The picture on the service card">
                <div className="max-w-md">
                  <PhotoUploader
                    endpoint={d.id ? `services/${d.id}/photo/` : undefined}
                    entity={d}
                    disabled={ro}
                    onSaved={(updated) => {
                      const merge = (x: Draft) => ({
                        ...x,
                        photo_url: updated.photo_url,
                        photo_card_url: updated.photo_card_url,
                        photo_width: updated.photo_width,
                        has_photo: updated.has_photo,
                      });
                      setD(merge);
                      setSaved(merge);
                      client.invalidateQueries({ queryKey: ["admin-services"] });
                      client.invalidateQueries({ queryKey: ["public-services"] });
                    }}
                  />
                </div>
              </Panel>

              <Panel
                title="Homepage categories"
                description="Tick the kinds of business this service is for. It's listed under those cards on the homepage."
              >
                <Chips items={categories} selected={d.categories} onChange={(ids) => set("categories", ids)} label={(c) => c.name} />
                {categories.length === 0 && <p className="text-sm text-on-surface-variant">No categories yet. Create them under Homepage categories.</p>}
              </Panel>

              <Panel title="Visibility">
                <Switch
                  checked={d.is_active}
                  disabled={ro}
                  onChange={(v) => set("is_active", v)}
                  label="Show on the website"
                  description="Turn off to hide it from the website and booking form while you work on it. Past bookings keep it."
                />
              </Panel>
            </>
          )}

          {tab === "pricing" && (
            <>
              <Panel title="How is it priced?" description="Pick the option that matches how you quote this job">
                <div className="grid gap-2 sm:grid-cols-2">
                  {methods.map(({ value, label, icon: Icon, body }) => {
                    const on = d.pricing_method === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => set("pricing_method", value)}
                        aria-pressed={on}
                        className={`flex gap-3 rounded-xl border p-3.5 text-left transition ${on ? "border-primary bg-primary-fixed/40" : "border-surface-container-high hover:border-tertiary"}`}
                      >
                        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${on ? "bg-primary text-white" : "bg-surface-container text-on-surface-variant"}`}>
                          <Icon className="size-4" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold">{label}</span>
                          <span className="block text-xs text-on-surface-variant">{body}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {!quoteOnly && (
                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <Field label="Starting price" hint="Charged on every visit" tip="The fixed part of the price. Rooms, floor area and extras are added on top of this.">
                      {(id) => <NumberInput id={id} prefix="₦" value={d.base_price} onChange={(v) => set("base_price", v)} />}
                    </Field>
                    <Field
                      label="Minimum charge"
                      hint="A visit never costs less"
                      tip="If the rooms and extras add up to less than this, the customer pays this amount instead. Use it so small jobs are still worth the trip."
                    >
                      {(id) => <NumberInput id={id} prefix="₦" value={d.minimum_charge} onChange={(v) => set("minimum_charge", v)} />}
                    </Field>
                    <Field label="Price shown as" hint='e.g. "per visit", "per job"'>
                      {(id) => <input id={id} value={d.price_suffix} onChange={(e) => set("price_suffix", e.target.value)} className={inputClass} />}
                    </Field>
                    {d.pricing_method === "per_sqm" && (
                      <>
                        <Field label="Price per m²">
                          {(id) => <NumberInput id={id} prefix="₦" value={d.rate_per_sqm} onChange={(v) => set("rate_per_sqm", v)} />}
                        </Field>
                        <Field label="Smallest area (m²)" tip="Customers can't enter a floor area smaller than this.">
                          {(id) => <NumberInput id={id} value={d.min_area_sqm} onChange={(v) => set("min_area_sqm", v)} />}
                        </Field>
                        <Field label="Largest area (m²)" error={fieldError("max_area_sqm")} tip="Customers can't enter a floor area bigger than this.">
                          {(id) => <NumberInput id={id} value={d.max_area_sqm} onChange={(v) => set("max_area_sqm", v)} />}
                        </Field>
                      </>
                    )}
                    <Field
                      label="Big jobs go to WhatsApp above"
                      hint="Leave empty for no limit"
                      tip="If a customer's price (before VAT) goes above this, they can't pay online. Instead they send you the details on WhatsApp so you can check the job and agree a price."
                      className="sm:col-span-3"
                    >
                      {(id) => (
                        <div className="relative max-w-xs">
                          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-outline">₦</span>
                          <input
                            id={id}
                            type="number"
                            min={0}
                            value={d.quote_threshold ?? ""}
                            onChange={(e) => set("quote_threshold", e.target.value === "" ? null : Number(e.target.value))}
                            placeholder="No limit"
                            className={`${inputClass} tabular pl-7`}
                          />
                        </div>
                      )}
                    </Field>
                  </div>
                )}
              </Panel>

              {!quoteOnly && <PriceExplainer d={d} />}

              {d.pricing_method === "per_unit" && (
                <Panel
                  title="What customers count"
                  description="Each row is a counter in the booking calculator, e.g. rooms or restrooms, with its price"
                  action={
                    !ro && (
                      <Button
                        size="sm"
                        variant="subtle"
                        onClick={() => set("units", [...d.units, { label: "", help_text: "", price: 0, min_qty: 0, max_qty: 20, default_qty: 1 }])}
                      >
                        <Plus className="size-4" /> Add a counter
                      </Button>
                    )
                  }
                >
                  {d.units.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">Add at least one, e.g. &quot;Rooms / work areas&quot;.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="hidden grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_2.5rem] items-center gap-2 px-1 text-xs font-semibold text-on-surface-variant md:grid">
                        <span>What they count</span>
                        <span>Price each</span>
                        <span className="flex items-center gap-1">
                          Fewest <InfoTip>The lowest number a customer can choose, e.g. at least 1 room.</InfoTip>
                        </span>
                        <span className="flex items-center gap-1">
                          Starts at <InfoTip>The number already filled in when the calculator opens.</InfoTip>
                        </span>
                        <span className="flex items-center gap-1">
                          Most <InfoTip>The highest number a customer can choose online.</InfoTip>
                        </span>
                        <span />
                      </div>
                      {d.units.map((u, i) => (
                        <div key={u.id ?? `new-${i}`} className="grid grid-cols-2 gap-2 rounded-xl bg-surface-container-low p-2 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_2.5rem] md:bg-transparent md:p-0">
                          <input aria-label="Label" value={u.label} onChange={(e) => setUnit(i, { label: e.target.value })} placeholder="e.g. Restrooms" className={`${inputClass} col-span-2 md:col-span-1`} />
                          <NumberInput aria-label="Price each" prefix="₦" value={u.price} onChange={(v) => setUnit(i, { price: v })} />
                          <NumberInput aria-label="Minimum" value={u.min_qty} onChange={(v) => setUnit(i, { min_qty: v })} />
                          <NumberInput aria-label="Default" value={u.default_qty} onChange={(v) => setUnit(i, { default_qty: v })} />
                          <NumberInput aria-label="Maximum" value={u.max_qty} onChange={(v) => setUnit(i, { max_qty: v })} />
                          {!ro && (
                            <button
                              type="button"
                              aria-label={`Remove ${u.label || "unit"}`}
                              onClick={() => set("units", d.units.filter((_, j) => j !== i))}
                              className="grid size-11 place-items-center rounded-xl text-error hover:bg-error/5"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      <p className="text-xs text-error">{fieldError("units")}</p>
                    </div>
                  )}
                </Panel>
              )}

              {!quoteOnly && (
                <Panel
                  title="Optional extras"
                  description="Things customers can tick to add, e.g. interior windows or sofa cleaning"
                  action={
                    !ro && (
                      <Button size="sm" variant="subtle" onClick={() => set("addons", [...d.addons, { label: "", price: 0, is_active: true }])}>
                        <Plus className="size-4" /> Add an extra
                      </Button>
                    )
                  }
                >
                  {d.addons.length === 0 ? (
                    <p className="text-sm text-on-surface-variant">No extras yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {d.addons.map((a, i) => (
                        <div key={a.id ?? `new-${i}`} className="grid grid-cols-[minmax(0,1fr)_9rem_auto_2.5rem] items-center gap-2">
                          <input aria-label="Add-on" value={a.label} onChange={(e) => setAddon(i, { label: e.target.value })} placeholder="e.g. Interior windows" className={inputClass} />
                          <NumberInput aria-label="Price" prefix="₦" value={a.price} onChange={(v) => setAddon(i, { price: v })} />
                          <label className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant">
                            <input type="checkbox" checked={a.is_active} onChange={(e) => setAddon(i, { is_active: e.target.checked })} className="size-4 accent-secondary" /> Offered
                          </label>
                          {!ro && (
                            <button
                              type="button"
                              aria-label={`Remove ${a.label || "add-on"}`}
                              onClick={() => set("addons", d.addons.filter((_, j) => j !== i))}
                              className="grid size-11 place-items-center rounded-xl text-error hover:bg-error/5"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              )}

              {!quoteOnly && (
                <Panel
                  title="How often customers can book it"
                  description="Tick the options to offer. Regular bookings get the discount shown. None ticked offers them all."
                >
                  <Chips
                    items={frequencies}
                    selected={d.frequencies}
                    onChange={(ids) => set("frequencies", ids)}
                    label={(f) => (
                      <>
                        {f.label}
                        {Number(f.discount_percent) > 0 && <span className="text-xs opacity-70">−{Number(f.discount_percent)}%</span>}
                      </>
                    )}
                  />
                  <p className="mt-3 text-xs text-outline">Change the options and their discounts in Business settings → Frequencies.</p>
                </Panel>
              )}
            </>
          )}

          {tab === "booking" &&
            (quoteOnly ? (
              <Panel title="Booked on WhatsApp">
                <p className="text-sm text-on-surface-variant">
                  This is a custom-quote service, so customers send their details on WhatsApp instead of booking online.
                  There are no online booking rules to set.
                </p>
              </Panel>
            ) : (
              <>
                <Panel title="Arrival times" description="Which time windows customers can pick for this service">
                  <Chips
                    items={slots.filter((t) => t.is_active)}
                    selected={d.time_slots}
                    onChange={(ids) => set("time_slots", ids)}
                    label={(t) => (
                      <>
                        {t.label}
                        {t.hint && <span className="text-xs opacity-70">{t.hint}</span>}
                      </>
                    )}
                  />
                  <p className="mt-2 text-xs text-outline">None ticked offers them all. Add or rename times in Business settings → Time slots.</p>
                </Panel>

                <Panel title="Notice and payment">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Earliest booking"
                      hint="Days from today. Leave empty to use your usual notice."
                      tip="How much notice you need. 2 means a customer booking today can choose the day after tomorrow at the earliest."
                    >
                      {(id) => (
                        <input
                          id={id}
                          type="number"
                          min={0}
                          value={d.min_lead_days ?? ""}
                          placeholder="Usual notice"
                          onChange={(e) => set("min_lead_days", e.target.value === "" ? null : Number(e.target.value))}
                          className={`${inputClass} tabular`}
                        />
                      )}
                    </Field>
                    <Field
                      label="Deposit to confirm (%)"
                      hint="0 means customers pay the full amount online"
                      error={fieldError("deposit_percent")}
                      tip="For bigger jobs, customers can pay part of the price online to confirm, and the rest when the job is done. For example 30 means they pay 30% now."
                    >
                      {(id) => <NumberInput id={id} max={100} value={d.deposit_percent} onChange={(v) => set("deposit_percent", Math.min(100, v))} />}
                    </Field>
                  </div>
                </Panel>

                <Panel
                  title="Travel charges for this service"
                  description="Usually leave these empty. Only fill one in if this service should charge a different travel fee for an area than your usual one."
                >
                  <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {areas
                      .filter((a) => a.is_active)
                      .map((a) => (
                        <label key={a.id} className="flex items-center justify-between gap-3 border-b border-surface-container py-1.5 text-sm">
                          <span className="min-w-0 truncate">{a.name}</span>
                          <span className="relative w-40 shrink-0">
                            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-outline">+₦</span>
                            <input
                              type="number"
                              min={0}
                              aria-label={`Surcharge for ${a.name}`}
                              value={surchargeFor(a.id) ?? ""}
                              placeholder={`${a.surcharge.toLocaleString("en-NG")} usual`}
                              onChange={(e) => setSurcharge(a.id, e.target.value)}
                              className={`${inputClass} tabular h-9 pl-8 text-sm`}
                            />
                          </span>
                        </label>
                      ))}
                  </div>
                  <p className="mt-2 text-xs text-error">{fieldError("area_prices")}</p>
                </Panel>
              </>
            ))}

          <div className="flex justify-between gap-2 pt-1">
            {prev ? (
              <Button variant="ghost" onClick={() => goTo(prev)}>
                <ArrowLeft className="size-4" /> Back: {tabs.find((t) => t.id === prev)!.label}
              </Button>
            ) : (
              <span />
            )}
            {next ? (
              <Button variant="primary" onClick={() => goTo(next)}>
                Next: {tabs.find((t) => t.id === next)!.label} <ArrowRight className="size-4" />
              </Button>
            ) : (
              isOwner && (
                <Button variant="accent" loading={save.isPending} onClick={() => save.mutate()}>
                  {isNew ? "Create service" : "Save service"}
                </Button>
              )
            )}
          </div>
        </fieldset>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <div className="overflow-hidden rounded-2xl bg-primary text-white shadow-pop">
            {d.photo_card_url && (
              <div className="relative aspect-[16/9]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.photo_card_url} alt="" className="absolute inset-0 size-full object-cover" />
              </div>
            )}
            <div className="p-5">
              <p className="font-display text-[11px] font-bold tracking-[0.08em] text-tertiary uppercase">Preview: customers see</p>
              <p className="mt-2 font-display text-lg font-semibold text-white">{d.name || "Untitled service"}</p>
              <p className="mt-1 text-sm text-white/70">{d.tagline || "One-line summary"}</p>
              <div className="mt-4 rounded-xl bg-white/10 p-4">
                <p className="text-xs text-white/60">Starting price</p>
                <p className="tabular mt-0.5 font-display text-3xl font-extrabold">{from === null ? "Custom quote" : naira(from)}</p>
                {from !== null && <p className="mt-0.5 text-xs text-white/60">{d.price_suffix} + VAT</p>}
                {from !== null && d.deposit_percent > 0 && d.deposit_percent < 100 && (
                  <p className="mt-1 text-xs text-tertiary">{d.deposit_percent}% deposit online, rest on completion</p>
                )}
              </div>
              {!d.is_active && <p className="mt-3 text-xs text-warning">Hidden: not on the website yet</p>}
            </div>
          </div>
          {d.id ? (
            <Panel title="Try a price" description="Pick a job and see exactly what the customer pays" bodyClassName="p-5">
              <PriceTester service={saved as AdminService} frequencies={frequencies} areas={areas.filter((a) => a.is_active)} dirty={dirty} />
            </Panel>
          ) : (
            <Panel bodyClassName="p-5">
              <p className="text-sm text-on-surface-variant">Once you create the service you can try prices here.</p>
            </Panel>
          )}
        </aside>
      </div>

      {isOwner && (
        <SaveBar
          dirty={dirty}
          saving={save.isPending}
          onSave={() => save.mutate()}
          onDiscard={() => setD(saved)}
          saveLabel={isNew ? "Create service" : "Save service"}
        />
      )}
    </div>
  );
}

type EditorTab = "basics" | "pricing" | "booking";

/** Which tab each server field lives on, to flag tabs with errors after saving. */
const TAB_FIELDS: Record<EditorTab, string[]> = {
  basics: ["name", "slug", "tagline", "description", "includes", "badge", "sort_order", "categories"],
  pricing: [
    "pricing_method", "base_price", "minimum_charge", "price_suffix", "rate_per_sqm", "min_area_sqm",
    "max_area_sqm", "quote_threshold", "units", "addons", "frequencies",
  ],
  booking: ["time_slots", "min_lead_days", "deposit_percent", "area_prices"],
};

/** The pricing rules in plain words, built from the numbers being edited. */
function PriceExplainer({ d }: { d: Draft }) {
  const parts: string[] = [];
  const counted = d.units.filter((u) => u.label && u.price);
  if (d.base_price) parts.push(`${naira(d.base_price)} to start`);
  if (d.pricing_method === "per_unit" && counted.length) {
    parts.push(counted.map((u) => `${naira(u.price)} each for ${u.label.toLowerCase()}`).join(", "));
  }
  if (d.pricing_method === "per_sqm" && d.rate_per_sqm) parts.push(`${naira(d.rate_per_sqm)} per m² of floor`);
  const activeExtras = d.addons.filter((a) => a.is_active && a.label);

  return (
    <div className="flex gap-3 rounded-2xl border border-tertiary/30 bg-tertiary/5 p-4 text-sm leading-6 text-on-surface">
      <Lightbulb className="mt-0.5 size-5 shrink-0 text-on-tertiary-container" />
      <div>
        <p className="font-semibold">How this price is worked out</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-on-surface-variant">
          <li>{parts.length ? `Each visit costs ${parts.join(", plus ")}.` : "Set a starting price and what customers count."}</li>
          {activeExtras.length > 0 && <li>Any extras the customer ticks are added.</li>}
          <li>Regular bookings (weekly, monthly…) get their discount.</li>
          {d.minimum_charge > 0 && <li>If that comes to less than {naira(d.minimum_charge)}, the customer pays {naira(d.minimum_charge)}.</li>}
          <li>Any travel charge for their area is added, then VAT.</li>
          {d.quote_threshold && <li>Over {naira(d.quote_threshold)} before VAT, they&apos;re sent to WhatsApp instead of paying online.</li>}
        </ol>
      </div>
    </div>
  );
}
