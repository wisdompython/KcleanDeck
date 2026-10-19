"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Avatar } from "@/components/admin/booking-bits";
import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  ErrorNote,
  Field,
  inputClass,
  PageHeader,
  Spinner,
  Switch,
  useToast,
} from "@/components/admin/ui";
import { WhatsAppIcon } from "@/components/icons";
import { api } from "@/lib/admin/api";
import { customerWhatsApp, formatDate } from "@/lib/admin/labels";
import type { Cleaner } from "@/lib/admin/types";

const roles = ["Cleaner", "Supervisor", "Office assistant", "Event assistant"];
type Draft = Omit<Cleaner, "id" | "upcoming_jobs" | "completed_jobs"> & { id?: number };
const blank: Draft = { full_name: "", phone: "", role: "Cleaner", is_active: true, notes: "", joined_on: null };

export function CleanersScreen() {
  const client = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const { data, error, isPending } = useQuery({ queryKey: ["cleaners", "all"], queryFn: () => api<Cleaner[]>("cleaners/") });

  const save = useMutation({
    mutationFn: (d: Draft) =>
      d.id
        ? api<Cleaner>(`cleaners/${d.id}/`, { method: "PATCH", body: d })
        : api<Cleaner>("cleaners/", { method: "POST", body: d }),
    onSuccess: (_, d) => {
      client.invalidateQueries({ queryKey: ["cleaners"] });
      toast(d.id ? "Cleaner updated" : "Cleaner added");
      setDraft(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`cleaners/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["cleaners"] });
      toast("Cleaner removed");
      setDraft(null);
    },
  });

  const list = (data ?? []).filter(
    (c) =>
      (showInactive || c.is_active) &&
      (!query || `${c.full_name} ${c.phone} ${c.role}`.toLowerCase().includes(query.toLowerCase())),
  );
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Team on the ground"
        title="Cleaners"
        description="Your roster. Assign cleaners to bookings and message them the job details on WhatsApp."
        actions={
          <Button variant="accent" onClick={() => setDraft({ ...blank })}>
            <Plus className="size-4" /> Add cleaner
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="relative w-full max-w-sm">
          <span className="sr-only">Search cleaners</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-outline" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, role…" className={`${inputClass} pl-10`} />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-on-surface-variant">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="size-4 accent-secondary" />
          Show inactive
        </label>
      </div>

      <ErrorNote error={error} />
      {isPending ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState
          title={data?.length ? "No cleaners match" : "No cleaners yet"}
          body="Add the people you send to jobs, or hire them from Applications."
          action={<Button size="sm" onClick={() => setDraft({ ...blank })}>Add cleaner</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <article
              key={c.id}
              className={`rounded-2xl border border-surface-container bg-surface p-4 shadow-card transition hover:shadow-pop ${c.is_active ? "" : "opacity-60"}`}
            >
              <div className="flex items-start gap-3">
                <Avatar name={c.full_name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-semibold">{c.full_name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {c.role}
                    {c.joined_on ? ` · since ${formatDate(c.joined_on, { day: undefined })}` : ""}
                  </p>
                </div>
                {!c.is_active && <Chip className="bg-surface-container text-on-surface-variant">Inactive</Chip>}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <Link
                  href={`/admin/bookings?cleaner=${c.id}&status=confirmed,in_progress&ordering=scheduled_date`}
                  className="rounded-xl bg-surface-container-low p-2.5 transition hover:bg-surface-container"
                >
                  <p className="tabular font-display text-lg font-bold">{c.upcoming_jobs}</p>
                  <p className="text-xs text-on-surface-variant">Upcoming</p>
                </Link>
                <div className="rounded-xl bg-surface-container-low p-2.5">
                  <p className="tabular font-display text-lg font-bold">{c.completed_jobs}</p>
                  <p className="text-xs text-on-surface-variant">Completed</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {customerWhatsApp(c.phone) && (
                  <a
                    href={customerWhatsApp(c.phone)!}
                    target="_blank"
                    rel="noopener"
                    aria-label={`WhatsApp ${c.full_name}`}
                    className="grid size-9 place-items-center rounded-xl bg-whatsapp/12 text-on-secondary-container"
                  >
                    <WhatsAppIcon className="size-4" />
                  </a>
                )}
                {c.phone && (
                  <a href={`tel:${c.phone}`} aria-label={`Call ${c.full_name}`} className="grid size-9 place-items-center rounded-xl bg-surface-container">
                    <Phone className="size-4" />
                  </a>
                )}
                <Button size="sm" variant="subtle" className="ml-auto" onClick={() => setDraft({ ...c })}>
                  Edit
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit cleaner" : "Add cleaner"}
        footer={
          <>
            {draft?.id && (
              <Button variant="danger" className="mr-auto" loading={remove.isPending} onClick={() => remove.mutate(draft.id!)}>
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button loading={save.isPending} onClick={() => draft && save.mutate(draft)}>
              Save
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" className="sm:col-span-2">
              {(id) => <input id={id} value={draft.full_name} onChange={(e) => set("full_name", e.target.value)} className={inputClass} />}
            </Field>
            <Field label="Phone (WhatsApp)">
              {(id) => <input id={id} type="tel" value={draft.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass} />}
            </Field>
            <Field label="Role">
              {(id) => (
                <input id={id} list="cleaner-roles" value={draft.role} onChange={(e) => set("role", e.target.value)} className={inputClass} />
              )}
            </Field>
            <datalist id="cleaner-roles">
              {roles.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            <Field label="Joined on">
              {(id) => (
                <input id={id} type="date" value={draft.joined_on ?? ""} onChange={(e) => set("joined_on", e.target.value || null)} className={inputClass} />
              )}
            </Field>
            <div className="flex items-end pb-2">
              <Switch checked={draft.is_active} onChange={(v) => set("is_active", v)} label="Active" description="Inactive cleaners can't be assigned" />
            </div>
            <Field label="Notes" className="sm:col-span-2">
              {(id) => (
                <textarea id={id} rows={3} value={draft.notes} onChange={(e) => set("notes", e.target.value)} className={`${inputClass} h-auto py-2.5`} />
              )}
            </Field>
            <div className="sm:col-span-2">
              <ErrorNote error={save.error || remove.error} />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
