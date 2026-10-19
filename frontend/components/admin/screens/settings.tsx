"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Plus, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Markdown from "react-markdown";

import { useIsOwner } from "@/components/admin/auth";
import { GuidedTabs, SaveBar } from "@/components/admin/guidance";
import {
  Button,
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
import type { AdminArea, AdminFaq, AdminFrequency, AdminTimeSlot, SiteSettings } from "@/lib/admin/types";

const tabs = [
  {
    id: "business",
    label: "Business & contact",
    description:
      "Your WhatsApp number, phone, email and address shown on the website, and who gets emailed about new bookings.",
  },
  {
    id: "booking",
    label: "Booking & VAT",
    description: "Whether VAT is charged, and how much notice customers must give when booking online.",
  },
  {
    id: "terms",
    label: "Terms",
    description: "The terms and conditions customers agree to before paying, shown on the Terms page.",
  },
  {
    id: "frequencies",
    label: "Frequencies",
    description:
      "How often customers can book (one-off, weekly…), the discount for each, and how many visits one payment covers.",
  },
  {
    id: "time-slots",
    label: "Time slots",
    description: "The arrival windows customers choose from, e.g. Morning 8am – 12pm.",
  },
  {
    id: "areas",
    label: "Areas",
    description: "The parts of Lagos customers can pick, and any travel charge for each.",
  },
  {
    id: "faqs",
    label: "FAQs",
    description: "Questions and answers on the FAQ page, and which ones also appear on the homepage.",
  },
] as const;

export function SettingsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const isOwner = useIsOwner();
  const tab = tabs.find((item) => item.id === params.get("tab"))?.id ?? "business";
  const active = tabs.find((item) => item.id === tab)!;

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Setup"
        title="Business settings"
        description="Manage the details and booking options used across your website. Choose a section to get started."
      />
      {!isOwner && (
        <p className="mb-5 flex items-center gap-2 rounded-xl bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
          <Lock className="size-4" /> Only owners can change settings.
        </p>
      )}
      <div className="grid items-start gap-6 md:grid-cols-[220px_minmax(0,1fr)] xl:gap-8">
        <GuidedTabs
          id="settings"
          label="Settings sections"
          layout="rail"
          tabs={tabs.map((t) => ({ ...t }))}
          value={tab}
          onChange={(id) => router.replace(`${pathname}?tab=${id}`, { scroll: false })}
        />
        <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${tab}`} tabIndex={0} className="min-w-0 pb-24">
          <p className="mb-5 max-w-3xl text-sm leading-6 text-on-surface-variant">{active.description}</p>
          <fieldset disabled={!isOwner} className="min-w-0">
            {(tab === "business" || tab === "booking" || tab === "terms") && <SiteSettingsForm key={tab} tab={tab} />}
            {tab === "frequencies" && <FrequenciesEditor />}
            {tab === "time-slots" && <TimeSlotsEditor />}
            {tab === "areas" && <AreasEditor />}
            {tab === "faqs" && <FaqsEditor />}
          </fieldset>
        </div>
      </div>
    </div>
  );
}

// --- Site settings ------------------------------------------------------------

function SiteSettingsForm({ tab }: { tab: "business" | "booking" | "terms" }) {
  const { data, error, isPending } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<SiteSettings>("settings/"),
  });
  if (isPending) return <Spinner />;
  if (!data) return <ErrorNote error={error} />;
  return <SiteSettingsFields initial={data} tab={tab} />;
}

function SiteSettingsFields({ initial, tab }: { initial: SiteSettings; tab: "business" | "booking" | "terms" }) {
  const isOwner = useIsOwner();
  const client = useQueryClient();
  const toast = useToast();
  const [s, setS] = useState(initial);
  const [preview, setPreview] = useState(false);
  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => setS((x) => ({ ...x, [k]: v }));
  const [baseline, setBaseline] = useState(initial);
  const dirty = JSON.stringify(s) !== JSON.stringify(baseline);

  const save = useMutation({
    mutationFn: () => api<SiteSettings>("settings/", { method: "PATCH", body: s }),
    onSuccess: (saved) => {
      client.setQueryData(["settings"], saved);
      client.invalidateQueries({ queryKey: ["public-site"] });
      setS(saved);
      setBaseline(saved);
      toast("Settings saved");
    },
  });
  const err = (k: string) =>
    save.error && "fields" in save.error ? (save.error as { fields: Record<string, string> }).fields[k] : undefined;

  return (
    <>
      <Panel
        title={tab === "business" ? "Business & contact" : tab === "booking" ? "Booking & VAT" : "Terms and conditions"}
        action={
          <Button variant="accent" size="sm" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
            Save changes
          </Button>
        }
      >
        <ErrorNote error={save.error} />
        {tab === "business" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name">
              {(id) => (
                <input
                  id={id}
                  value={s.business_name}
                  onChange={(e) => set("business_name", e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
            <Field label="Coverage line" hint="Shown in the footer">
              {(id) => (
                <input
                  id={id}
                  value={s.coverage_text}
                  onChange={(e) => set("coverage_text", e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
            <Field
              label="WhatsApp number"
              hint="International format, e.g. 2348012345678. Used by every WhatsApp button."
              error={err("whatsapp_number")}
            >
              {(id) => (
                <input
                  id={id}
                  inputMode="tel"
                  value={s.whatsapp_number}
                  onChange={(e) => set("whatsapp_number", e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
            <Field label="Phone number" hint="As shown on the site">
              {(id) => (
                <input
                  id={id}
                  value={s.phone_number}
                  onChange={(e) => set("phone_number", e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
            <Field label="Public email" error={err("email")}>
              {(id) => (
                <input
                  id={id}
                  type="email"
                  value={s.email}
                  onChange={(e) => set("email", e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
            <Field label="Address">
              {(id) => (
                <input
                  id={id}
                  value={s.address}
                  onChange={(e) => set("address", e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
            <Field
              label="Team notification emails"
              hint="Comma-separated. Get an email for every paid booking, quote request and application."
              className="sm:col-span-2"
            >
              {(id) => (
                <input
                  id={id}
                  value={s.notification_emails}
                  onChange={(e) => set("notification_emails", e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
          </div>
        )}
        {tab === "booking" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Switch
                checked={s.vat_enabled}
                onChange={(v) => set("vat_enabled", v)}
                label="Charge VAT"
                description="Added on top of every price and shown separately."
              />
            </div>
            <Field label="VAT rate (%)" hint="Nigerian standard VAT is 7.5%" error={err("vat_rate")}>
              {(id) => (
                <input
                  id={id}
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={s.vat_rate}
                  onChange={(e) => set("vat_rate", e.target.value)}
                  className={`${inputClass} tabular`}
                />
              )}
            </Field>
            <Field label="Earliest booking (days from today)" hint="1 = customers can book from tomorrow">
              {(id) => (
                <input
                  id={id}
                  type="number"
                  min={0}
                  value={s.min_booking_lead_days}
                  onChange={(e) => set("min_booking_lead_days", Number(e.target.value))}
                  className={`${inputClass} tabular`}
                />
              )}
            </Field>
          </div>
        )}
        {tab === "terms" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Last updated" className="w-48">
                {(id) => (
                  <input
                    id={id}
                    type="date"
                    value={s.terms_updated_on ?? ""}
                    onChange={(e) => set("terms_updated_on", e.target.value || null)}
                    className={inputClass}
                  />
                )}
              </Field>
              <Switch checked={preview} onChange={setPreview} label="Preview" />
            </div>
            {preview ? (
              <div className="space-y-3 rounded-xl border border-surface-container-high p-5 text-sm leading-6 text-on-surface-variant [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-on-surface [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-on-surface">
                <Markdown>{s.terms_content}</Markdown>
              </div>
            ) : (
              <textarea
                aria-label="Terms and conditions"
                rows={22}
                value={s.terms_content}
                onChange={(e) => set("terms_content", e.target.value)}
                className={`${inputClass} h-auto py-3 font-mono text-[13px] leading-6`}
              />
            )}
            <p className="text-xs text-outline">
              Use &quot;## &quot; for headings, a blank line between paragraphs, and &quot;- &quot; for bullet points.
            </p>
          </div>
        )}
      </Panel>
      {isOwner && (
        <SaveBar dirty={dirty} saving={save.isPending} onSave={() => save.mutate()} onDiscard={() => setS(baseline)} />
      )}
    </>
  );
}

// --- Row editors ---------------------------------------------------------------

function useRowsEditor<T extends { id: number }>(path: string, key: string, label: string) {
  const client = useQueryClient();
  const toast = useToast();
  const query = useQuery({
    queryKey: [key],
    queryFn: () => api<T[]>(`${path}/`),
  });
  const done = (message: string) => {
    client.invalidateQueries({ queryKey: [key] });
    client.invalidateQueries({ queryKey: ["public-site"] });
    client.invalidateQueries({ queryKey: ["public-services"] });
    toast(message);
  };
  const save = useMutation({
    mutationFn: (row: Partial<T>) =>
      row.id
        ? api<T>(`${path}/${row.id}/`, { method: "PATCH", body: row })
        : api<T>(`${path}/`, { method: "POST", body: row }),
    onSuccess: (_, row) => done(row.id ? `${label} saved` : `${label} added`),
    onError: (e) => toast(e.message, "error"),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`${path}/${id}/`, { method: "DELETE" }),
    onSuccess: () => done(`${label} deleted`),
    onError: (e) => toast(e.message, "error"),
  });
  return { query, save, remove };
}

function RowShell({
  dirty,
  onSave,
  onDelete,
  saving,
  children,
}: {
  dirty: boolean;
  onSave: () => void;
  onDelete?: () => void;
  saving: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-surface-container py-4 last:border-0 lg:flex-row lg:items-center">
      <div className="flex-1">{children}</div>
      <div className="flex gap-2">
        {dirty && (
          <Button size="sm" loading={saving} onClick={onSave}>
            Save
          </Button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete"
            className="grid size-9 place-items-center rounded-xl text-error hover:bg-error/5"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function FrequencyRow({
  row,
  editor,
}: {
  row: Partial<AdminFrequency>;
  editor: ReturnType<typeof useRowsEditor<AdminFrequency>>;
}) {
  const [r, setR] = useState(row);
  const set = <K extends keyof AdminFrequency>(k: K, v: AdminFrequency[K]) => setR((x) => ({ ...x, [k]: v }));
  const isNew = !row.id;
  return (
    <RowShell
      dirty={isNew ? !!r.label : JSON.stringify(r) !== JSON.stringify(row)}
      saving={editor.save.isPending}
      onSave={() =>
        editor.save.mutate(
          {
            ...r,
            slug: r.slug || r.label?.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          },
          { onSuccess: () => isNew && setR(row) },
        )
      }
      onDelete={row.id ? () => editor.remove.mutate(row.id!) : undefined}
    >
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_7rem_7rem_auto] sm:items-center">
        <input
          aria-label="Label"
          value={r.label ?? ""}
          onChange={(e) => set("label", e.target.value)}
          placeholder={isNew ? "New frequency, e.g. Fortnightly" : "Label"}
          className={inputClass}
        />
        <input
          aria-label="Description"
          value={r.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          placeholder="e.g. Billed monthly for 4 visits"
          className={inputClass}
        />
        <label className="relative">
          <span className="sr-only">Discount percent</span>
          <input
            type="number"
            min={0}
            max={100}
            step="0.5"
            value={r.discount_percent ?? "0"}
            onChange={(e) => set("discount_percent", e.target.value)}
            className={`${inputClass} tabular pr-8`}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-outline">
            % off
          </span>
        </label>
        <label className="relative">
          <span className="sr-only">Visits per payment</span>
          <input
            type="number"
            min={1}
            value={r.visits_per_payment ?? 1}
            onChange={(e) => set("visits_per_payment", Number(e.target.value))}
            className={`${inputClass} tabular pr-14`}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-outline">
            visits
          </span>
        </label>
        <Switch checked={r.is_active ?? true} onChange={(v) => set("is_active", v)} label="On" />
      </div>
    </RowShell>
  );
}

function FrequenciesEditor() {
  const editor = useRowsEditor<AdminFrequency>("frequencies", "admin-frequencies", "Frequency");
  if (editor.query.isPending) return <Spinner />;
  return (
    <Panel
      title="Frequencies"
      description="Discount is taken off each visit. Visits per payment sets how many visits one payment covers (weekly billed monthly = 4)."
    >
      {editor.query.data?.map((f) => (
        <FrequencyRow
          key={`${f.id}-${f.discount_percent}-${f.visits_per_payment}-${f.is_active}-${f.label}`}
          row={f}
          editor={editor}
        />
      ))}
      <FrequencyRow
        key="new"
        row={{
          label: "",
          description: "",
          discount_percent: "0",
          visits_per_payment: 1,
          is_active: true,
          sort_order: 99,
        }}
        editor={editor}
      />
    </Panel>
  );
}

function TimeSlotRow({
  row,
  editor,
}: {
  row: Partial<AdminTimeSlot>;
  editor: ReturnType<typeof useRowsEditor<AdminTimeSlot>>;
}) {
  const [r, setR] = useState(row);
  const isNew = !row.id;
  const key = (label: string) =>
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  return (
    <RowShell
      dirty={isNew ? !!r.label : JSON.stringify(r) !== JSON.stringify(row)}
      saving={editor.save.isPending}
      onSave={() =>
        editor.save.mutate({ ...r, key: r.key || key(r.label ?? "") }, { onSuccess: () => isNew && setR(row) })
      }
      onDelete={row.id ? () => editor.remove.mutate(row.id!) : undefined}
    >
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
        <input
          aria-label="Time slot name"
          value={r.label ?? ""}
          onChange={(e) => setR({ ...r, label: e.target.value })}
          placeholder={isNew ? "New time slot, e.g. Early morning" : "Name"}
          className={inputClass}
        />
        <input
          aria-label="Hours"
          value={r.hint ?? ""}
          onChange={(e) => setR({ ...r, hint: e.target.value })}
          placeholder="e.g. 6am – 8am"
          className={inputClass}
        />
        <Switch checked={r.is_active ?? true} onChange={(v) => setR({ ...r, is_active: v })} label="On" />
      </div>
    </RowShell>
  );
}

function TimeSlotsEditor() {
  const editor = useRowsEditor<AdminTimeSlot>("time-slots", "admin-time-slots", "Time slot");
  if (editor.query.isPending) return <Spinner />;
  return (
    <Panel
      title="Time slots"
      description="Arrival windows customers can choose. Each service can offer all of them or just some (set on the service). Turn one off instead of deleting it if past bookings use it."
    >
      {editor.query.data?.map((t) => (
        <TimeSlotRow key={`${t.id}-${t.label}-${t.hint}-${t.is_active}`} row={t} editor={editor} />
      ))}
      <TimeSlotRow key="new" row={{ label: "", hint: "", key: "", is_active: true, sort_order: 99 }} editor={editor} />
    </Panel>
  );
}

function AreaRow({ row, editor }: { row: Partial<AdminArea>; editor: ReturnType<typeof useRowsEditor<AdminArea>> }) {
  const [r, setR] = useState(row);
  const isNew = !row.id;
  return (
    <RowShell
      dirty={isNew ? !!r.name : JSON.stringify(r) !== JSON.stringify(row)}
      saving={editor.save.isPending}
      onSave={() => editor.save.mutate(r, { onSuccess: () => isNew && setR(row) })}
      onDelete={row.id ? () => editor.remove.mutate(row.id!) : undefined}
    >
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-center">
        <input
          aria-label="Area"
          value={r.name ?? ""}
          onChange={(e) => setR({ ...r, name: e.target.value })}
          placeholder={isNew ? "New area, e.g. Ikorodu" : "Area"}
          className={inputClass}
        />
        <label className="relative">
          <span className="sr-only">Surcharge</span>
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-outline">+₦</span>
          <input
            type="number"
            min={0}
            value={r.surcharge ?? 0}
            onChange={(e) => setR({ ...r, surcharge: Number(e.target.value) })}
            className={`${inputClass} tabular pl-9`}
          />
        </label>
        <Switch checked={r.is_active ?? true} onChange={(v) => setR({ ...r, is_active: v })} label="On" />
      </div>
    </RowShell>
  );
}

function AreasEditor() {
  const editor = useRowsEditor<AdminArea>("areas", "admin-areas", "Area");
  if (editor.query.isPending) return <Spinner />;
  return (
    <Panel
      title="Service areas"
      description="Areas customers pick from. A surcharge is added to each visit (e.g. for travel); leave 0 for none."
    >
      {editor.query.data?.map((a) => (
        <AreaRow key={`${a.id}-${a.name}-${a.surcharge}-${a.is_active}`} row={a} editor={editor} />
      ))}
      <AreaRow key="new" row={{ name: "", surcharge: 0, is_active: true, sort_order: 99 }} editor={editor} />
    </Panel>
  );
}

function FaqRow({ row, editor }: { row: Partial<AdminFaq>; editor: ReturnType<typeof useRowsEditor<AdminFaq>> }) {
  const [r, setR] = useState(row);
  const isNew = !row.id;
  return (
    <RowShell
      dirty={isNew ? !!(r.question && r.answer) : JSON.stringify(r) !== JSON.stringify(row)}
      saving={editor.save.isPending}
      onSave={() => editor.save.mutate(r, { onSuccess: () => isNew && setR(row) })}
      onDelete={row.id ? () => editor.remove.mutate(row.id!) : undefined}
    >
      <div className="space-y-2">
        <input
          aria-label="Question"
          value={r.question ?? ""}
          onChange={(e) => setR({ ...r, question: e.target.value })}
          placeholder={isNew ? "New question" : "Question"}
          className={`${inputClass} font-semibold`}
        />
        <textarea
          aria-label="Answer"
          rows={2}
          value={r.answer ?? ""}
          onChange={(e) => setR({ ...r, answer: e.target.value })}
          placeholder="Answer"
          className={`${inputClass} h-auto py-2.5`}
        />
        <div className="flex flex-wrap gap-5">
          <Switch
            checked={r.is_active ?? true}
            onChange={(v) => setR({ ...r, is_active: v })}
            label="Show on FAQ page"
          />
          <Switch
            checked={r.show_on_homepage ?? false}
            onChange={(v) => setR({ ...r, show_on_homepage: v })}
            label="Also on homepage"
          />
        </div>
      </div>
    </RowShell>
  );
}

function FaqsEditor() {
  const editor = useRowsEditor<AdminFaq>("faqs", "admin-faqs", "FAQ");
  if (editor.query.isPending) return <Spinner />;
  return (
    <Panel title="FAQs" description="Questions on the FAQ page and homepage, in this order.">
      {editor.query.data?.map((f) => (
        <FaqRow
          key={`${f.id}-${f.question}-${f.answer}-${f.is_active}-${f.show_on_homepage}`}
          row={f}
          editor={editor}
        />
      ))}
      <div className="pt-2">
        <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
          <Plus className="size-4" /> Add a question
        </p>
        <FaqRow
          key="new"
          row={{
            question: "",
            answer: "",
            is_active: true,
            show_on_homepage: false,
            sort_order: 99,
          }}
          editor={editor}
        />
      </div>
    </Panel>
  );
}
