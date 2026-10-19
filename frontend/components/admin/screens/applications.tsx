"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Search, UserPlus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Avatar } from "@/components/admin/booking-bits";
import { Button, Chip, EmptyState, ErrorNote, inputClass, PageHeader, Spinner, useToast } from "@/components/admin/ui";
import { WhatsAppIcon } from "@/components/icons";
import { api } from "@/lib/admin/api";
import { customerWhatsApp, formatDateTime } from "@/lib/admin/labels";
import type { Application, Paginated } from "@/lib/admin/types";

const statusChip: Record<Application["status"], string> = {
  new: "bg-tertiary/12 text-on-tertiary-container",
  contacted: "bg-warning/12 text-on-warning-container",
  accepted: "bg-secondary/10 text-on-secondary-container",
  declined: "bg-surface-container text-on-surface-variant",
};
const statusLabel: Record<Application["status"], string> = {
  new: "New",
  contacted: "Contacted",
  accepted: "Accepted",
  declined: "Declined",
};

function ApplicationCard({ app }: { app: Application }) {
  const client = useQueryClient();
  const toast = useToast();
  const [notes, setNotes] = useState(app.internal_notes);

  const update = useMutation({
    mutationFn: (body: Partial<Application>) => api<Application>(`applications/${app.id}/`, { method: "PATCH", body }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["applications"] });
      client.invalidateQueries({ queryKey: ["dashboard"] });
      toast("Application updated");
    },
    onError: (e) => toast(e.message, "error"),
  });
  const hire = useMutation({
    mutationFn: () => api(`applications/${app.id}/hire/`, { method: "POST" }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["applications"] });
      client.invalidateQueries({ queryKey: ["cleaners"] });
      client.invalidateQueries({ queryKey: ["dashboard"] });
      toast(`${app.full_name} added to cleaners`);
    },
    onError: (e) => toast(e.message, "error"),
  });

  const wa = customerWhatsApp(app.phone, `Hello ${app.full_name.split(" ")[0]}, this is Kleandeck about your ${app.kind === "job" ? "application" : "academy enquiry"}.`);

  return (
    <article className="rounded-2xl border border-surface-container bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={app.full_name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display font-semibold">{app.full_name}</p>
            <Chip className={statusChip[app.status]}>{statusLabel[app.status]}</Chip>
            {app.kind === "academy" && (
              <Chip className="bg-primary-fixed text-primary">
                <GraduationCap className="size-3" /> Academy
              </Chip>
            )}
          </div>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            {[app.role, app.location, app.experience].filter(Boolean).join(" · ") || "No details"} · {formatDateTime(app.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener"
              onClick={() => app.status === "new" && update.mutate({ status: "contacted" })}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-whatsapp/12 px-3 text-[13px] font-semibold text-on-secondary-container"
            >
              <WhatsAppIcon className="size-4" /> {app.phone}
            </a>
          )}
          {app.kind === "job" && app.status !== "accepted" && (
            <Button size="sm" variant="accent" loading={hire.isPending} onClick={() => hire.mutate()}>
              <UserPlus className="size-4" /> Add to cleaners
            </Button>
          )}
        </div>
      </div>

      {app.message && <p className="mt-4 rounded-xl bg-surface-container-low p-3 text-sm text-on-surface">{app.message}</p>}
      {app.email && <p className="mt-2 text-xs text-on-surface-variant">Email: {app.email}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-start">
        <select
          aria-label="Status"
          value={app.status}
          onChange={(e) => update.mutate({ status: e.target.value as Application["status"] })}
          className={inputClass}
        >
          {Object.entries(statusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          aria-label="Internal notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (interview date, references…)"
          className={inputClass}
        />
        {notes !== app.internal_notes && (
          <Button variant="subtle" loading={update.isPending} onClick={() => update.mutate({ internal_notes: notes })}>
            Save note
          </Button>
        )}
      </div>
    </article>
  );
}

export function ApplicationsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const kind = params.get("kind") ?? "";
  const status = params.get("status") ?? "";
  const [q, setQ] = useState("");

  const setParam = (key: string, value: string) => {
    const qs = new URLSearchParams(params.toString());
    if (value) qs.set(key, value);
    else qs.delete(key);
    router.replace(`${pathname}${qs.size ? `?${qs}` : ""}`, { scroll: false });
  };

  const { data, error, isPending } = useQuery({
    queryKey: ["applications", kind, status, q],
    queryFn: () => api<Paginated<Application>>("applications/", { query: { kind, status, q, page_size: 100 } }),
    placeholderData: keepPreviousData,
  });

  const pill = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${active ? "bg-primary text-white" : "bg-surface text-on-surface-variant hover:text-on-surface"}`;

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Careers & academy"
        title="Job applications"
        description="People who applied on the careers page or asked about the training academy."
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[
          ["", "All"],
          ["job", "Job applications"],
          ["academy", "Academy enquiries"],
        ].map(([value, label]) => (
          <button key={value} type="button" className={pill(kind === value)} onClick={() => setParam("kind", value)}>
            {label}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-surface-container-high" />
        {[["", "Any status"], ...Object.entries(statusLabel)].map(([value, label]) => (
          <button key={value} type="button" className={pill(status === value)} onClick={() => setParam("status", value)}>
            {label}
          </button>
        ))}
        <label className="relative ml-auto w-full sm:w-64">
          <span className="sr-only">Search applications</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-outline" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone" className={`${inputClass} pl-10`} />
        </label>
      </div>

      <ErrorNote error={error} />
      {isPending ? (
        <Spinner />
      ) : data?.results.length ? (
        <div className="space-y-3">
          {data.results.map((app) => (
            <ApplicationCard key={`${app.id}-${app.status}`} app={app} />
          ))}
        </div>
      ) : (
        <EmptyState title="No applications here" body="New applications from the careers and academy pages appear here." />
      )}
    </div>
  );
}
