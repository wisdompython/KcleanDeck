"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus, Sparkles, TicketPercent } from "lucide-react";
import { useState } from "react";

import {
  Button,
  Chip,
  Dialog,
  EmptyState,
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
import type { DiscountCode } from "@/lib/admin/types";
import { naira } from "@/lib/format";
import type { Service } from "@/lib/types";

type Draft = Omit<DiscountCode, "id" | "redemption_count" | "created_at" | "updated_at"> & { id?: number; redemption_count?: number };

const blank: Draft = {
  code: "",
  name: "",
  kind: "percentage",
  value: 10,
  minimum_subtotal: 0,
  maximum_discount: null,
  usage_limit: null,
  services: [],
  starts_at: null,
  expires_at: null,
  is_active: true,
};

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(6));
  return `KLEAN-${Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("")}`;
}

function dateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function codeStatus(code: DiscountCode) {
  const now = Date.now();
  if (!code.is_active) return { label: "Paused", className: "bg-surface-container text-on-surface-variant" };
  if (code.starts_at && new Date(code.starts_at).getTime() > now) return { label: "Scheduled", className: "bg-tertiary/20 text-primary" };
  if (code.expires_at && new Date(code.expires_at).getTime() <= now) return { label: "Expired", className: "bg-error/10 text-error" };
  if (code.usage_limit && code.redemption_count >= code.usage_limit) return { label: "Used up", className: "bg-warning/15 text-on-warning-container" };
  return { label: "Active", className: "bg-secondary/10 text-on-secondary-container" };
}

function offerLabel(code: Pick<DiscountCode, "kind" | "value" | "maximum_discount">) {
  if (code.kind === "fixed") return `${naira(code.value)} off`;
  return `${code.value}% off${code.maximum_discount ? ` · up to ${naira(code.maximum_discount)}` : ""}`;
}

export function DiscountsScreen() {
  const client = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const codes = useQuery({ queryKey: ["discount-codes"], queryFn: () => api<DiscountCode[]>("discount-codes/") });
  const services = useQuery({
    queryKey: ["public-services"],
    queryFn: () => fetch("/api/services/").then((r) => r.json() as Promise<Service[]>),
  });

  const save = useMutation({
    mutationFn: (item: Draft) =>
      item.id
        ? api<DiscountCode>(`discount-codes/${item.id}/`, { method: "PATCH", body: item })
        : api<DiscountCode>("discount-codes/", { method: "POST", body: item }),
    onSuccess: (_, item) => {
      client.invalidateQueries({ queryKey: ["discount-codes"] });
      toast(item.id ? "Discount code updated" : "Discount code created");
      setDraft(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`discount-codes/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["discount-codes"] });
      toast("Discount code deleted");
      setDraft(null);
    },
  });

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const fieldError = (key: string) =>
    save.error && "fields" in save.error ? (save.error as { fields: Record<string, string> }).fields[key] : undefined;

  async function copy(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Promotions"
        title="Discount codes"
        description="Generate trackable offers, choose where they work, and control when or how often they can be used."
        actions={
          <Button variant="accent" onClick={() => setDraft({ ...blank, code: randomCode() })}>
            <Plus className="size-4" /> Create discount
          </Button>
        }
      />

      <ErrorNote error={codes.error || services.error} />
      {codes.isPending ? (
        <Spinner />
      ) : !codes.data?.length ? (
        <EmptyState
          title="No discount codes yet"
          body="Create a code for a campaign, loyal client, referral or seasonal offer."
          action={<Button onClick={() => setDraft({ ...blank, code: randomCode() })}>Generate your first code</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {codes.data.map((code) => {
            const status = codeStatus(code);
            const eligible = code.services.length
              ? services.data?.filter((service) => code.services.includes(service.id)).map((service) => service.name).join(", ")
              : "All bookable services";
            return (
              <Panel key={code.id} bodyClassName="p-5">
                <div className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary-container text-on-secondary-container">
                    <TicketPercent className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-lg font-bold tracking-[0.03em]">{code.code}</p>
                      <Chip className={status.className}>{status.label}</Chip>
                    </div>
                    <p className="mt-0.5 text-sm text-on-surface-variant">{code.name || "Untitled campaign"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(code.code)}
                    aria-label={`Copy ${code.code}`}
                    className="grid size-9 place-items-center rounded-xl bg-surface-container text-on-surface-variant hover:text-primary"
                  >
                    {copied === code.code ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </button>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-surface-container-low p-4 text-sm">
                  <div>
                    <p className="text-xs text-outline">Offer</p>
                    <p className="mt-0.5 font-semibold">{offerLabel(code)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-outline">Uses</p>
                    <p className="tabular mt-0.5 font-semibold">{code.redemption_count}{code.usage_limit ? ` / ${code.usage_limit}` : " / Unlimited"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-outline">Works with</p>
                    <p className="mt-0.5 truncate font-semibold" title={eligible}>{eligible}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-outline">
                    {code.expires_at ? `Expires ${new Date(code.expires_at).toLocaleDateString("en-NG")}` : "No expiry date"}
                  </p>
                  <Button size="sm" variant="subtle" onClick={() => setDraft({ ...code })}>Edit</Button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit discount code" : "Create discount code"}
        description="The final discount is always checked by the server before payment."
        wide
        footer={
          <>
            {draft?.id && !draft.redemption_count && (
              <Button variant="danger" className="mr-auto" loading={remove.isPending} onClick={() => remove.mutate(draft.id!)}>
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            <Button
              loading={save.isPending}
              disabled={!draft?.code || !draft.name || !draft.value}
              onClick={() => draft && save.mutate(draft)}
            >
              Save discount
            </Button>
          </>
        }
      >
        {draft && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Campaign name" hint="Only your team sees this" error={fieldError("name")}>
                {(id) => <input id={id} value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="New customer offer" className={inputClass} />}
              </Field>
              <Field label="Customer code" error={fieldError("code")}>
                {(id) => (
                  <div className="flex gap-2">
                    <input id={id} value={draft.code} onChange={(e) => set("code", e.target.value.toUpperCase())} className={`${inputClass} font-mono font-bold tracking-[0.08em]`} />
                    <Button variant="subtle" aria-label="Generate another code" onClick={() => set("code", randomCode())}>
                      <Sparkles className="size-4" />
                    </Button>
                  </div>
                )}
              </Field>
              <Field label="Discount type">
                {(id) => (
                  <select id={id} value={draft.kind} onChange={(e) => { const kind = e.target.value as Draft["kind"]; setDraft({ ...draft, kind, maximum_discount: kind === "fixed" ? null : draft.maximum_discount }); }} className={inputClass}>
                    <option value="percentage">Percentage off</option>
                    <option value="fixed">Fixed Naira amount</option>
                  </select>
                )}
              </Field>
              <Field label={draft.kind === "percentage" ? "Percentage off" : "Amount off (₦)"} error={fieldError("value")}>
                {(id) => <input id={id} type="number" min={1} max={draft.kind === "percentage" ? 90 : undefined} value={draft.value} onChange={(e) => set("value", Number(e.target.value))} className={`${inputClass} tabular`} />}
              </Field>
              <Field label="Minimum booking (₦)" hint="Before VAT; 0 means no minimum">
                {(id) => <input id={id} type="number" min={0} value={draft.minimum_subtotal} onChange={(e) => set("minimum_subtotal", Number(e.target.value))} className={`${inputClass} tabular`} />}
              </Field>
              {draft.kind === "percentage" && (
                <Field label="Maximum discount (₦)" hint="Optional spending cap" error={fieldError("maximum_discount")}>
                  {(id) => <input id={id} type="number" min={1} value={draft.maximum_discount ?? ""} onChange={(e) => set("maximum_discount", e.target.value ? Number(e.target.value) : null)} className={`${inputClass} tabular`} />}
                </Field>
              )}
              <Field label="Usage limit" hint="Leave blank for unlimited" error={fieldError("usage_limit")}>
                {(id) => <input id={id} type="number" min={1} value={draft.usage_limit ?? ""} onChange={(e) => set("usage_limit", e.target.value ? Number(e.target.value) : null)} className={`${inputClass} tabular`} />}
              </Field>
              <div className="flex items-end pb-2">
                <Switch checked={draft.is_active} onChange={(value) => set("is_active", value)} label="Active" description="Customers can apply this code" />
              </div>
              <Field label="Starts" hint="Optional">
                {(id) => <input id={id} type="datetime-local" value={dateInput(draft.starts_at)} onChange={(e) => set("starts_at", e.target.value || null)} className={inputClass} />}
              </Field>
              <Field label="Expires" hint="Optional" error={fieldError("expires_at")}>
                {(id) => <input id={id} type="datetime-local" value={dateInput(draft.expires_at)} onChange={(e) => set("expires_at", e.target.value || null)} className={inputClass} />}
              </Field>
            </div>

            <fieldset>
              <legend className="text-[13px] font-semibold">Eligible services</legend>
              <p className="mt-0.5 text-xs text-outline">Leave all unchecked to allow every bookable service.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {services.data?.map((service) => (
                  <label key={service.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-surface-container-high p-3 text-sm has-[:checked]:border-secondary has-[:checked]:bg-secondary-container">
                    <input type="checkbox" checked={draft.services.includes(service.id)} onChange={(e) => set("services", e.target.checked ? [...draft.services, service.id] : draft.services.filter((id) => id !== service.id))} className="size-4 accent-secondary" />
                    {service.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <ErrorNote error={save.error || remove.error} />
          </div>
        )}
      </Dialog>
    </div>
  );
}
