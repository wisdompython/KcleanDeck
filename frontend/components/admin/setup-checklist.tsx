"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Rocket } from "lucide-react";
import Link from "next/link";

import { useIsOwner } from "@/components/admin/auth";
import { Button } from "@/components/admin/ui";
import { api } from "@/lib/admin/api";

type Step = { key: string; title: string; description: string; href: string | null; done: boolean; manual?: boolean };
type Checklist = { steps: Step[]; done: number; total: number; dismissed: boolean };

/** Owner-only "Getting started" card: what still needs setting up, with a link to each place. */
export function SetupChecklist() {
  const isOwner = useIsOwner();
  const client = useQueryClient();
  const { data } = useQuery({
    queryKey: ["setup"],
    queryFn: () => api<Checklist>("setup/"),
    enabled: isOwner,
  });
  const mark = useMutation({
    mutationFn: (body: { key: string; done: boolean }) => api<Checklist>("setup/", { method: "POST", body }),
    onSuccess: (updated) => client.setQueryData(["setup"], updated),
  });

  if (!isOwner || !data || data.done === data.total) return null;

  if (data.dismissed) {
    return (
      <button
        type="button"
        onClick={() => mark.mutate({ key: "dismissed", done: false })}
        className="mb-6 inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-primary shadow-card transition hover:shadow-pop"
      >
        <Rocket className="size-4" /> Finish setting up ({data.done} of {data.total} done)
      </button>
    );
  }

  const next = data.steps.find((s) => !s.done);
  const pct = Math.round((data.done / data.total) * 100);

  return (
    <section aria-labelledby="setup-title" className="mb-6 rounded-2xl border border-tertiary/30 bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="setup-title" className="flex items-center gap-2 font-display text-lg font-semibold">
            <Rocket className="size-5 text-on-tertiary-container" /> Getting started
          </h2>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            {data.done} of {data.total} done. Finish these so the website is ready for customers.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => mark.mutate({ key: "dismissed", done: true })}>
          Hide for now
        </Button>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-container" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Setup progress">
        <div className="h-full rounded-full bg-secondary transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {data.steps.map((step) => (
          <li
            key={step.key}
            className={`flex gap-3 rounded-xl border p-3 ${
              step.done ? "border-transparent bg-surface-container-low" : step.key === next?.key ? "border-tertiary bg-tertiary/5" : "border-surface-container-high"
            }`}
          >
            <span
              className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${
                step.done ? "bg-secondary text-white" : "border-2 border-outline-variant"
              }`}
              aria-hidden="true"
            >
              {step.done && <Check className="size-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${step.done ? "text-on-surface-variant line-through" : "text-on-surface"}`}>
                {step.title}
                <span className="sr-only">{step.done ? " (done)" : " (to do)"}</span>
              </p>
              {!step.done && <p className="mt-0.5 text-xs leading-5 text-on-surface-variant">{step.description}</p>}
              {!step.done && (
                <div className="mt-2 flex flex-wrap gap-3">
                  {step.href && (
                    <Link href={step.href} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      Go there <ArrowRight className="size-3.5" />
                    </Link>
                  )}
                  {step.manual && (
                    <button
                      type="button"
                      onClick={() => mark.mutate({ key: step.key, done: true })}
                      className="text-xs font-semibold text-on-secondary-container hover:underline"
                    >
                      Mark as done
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
