"use client";

import { CircleCheck, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { btn } from "@/components/ui";

type Kind = "job" | "academy";

const roles = ["Cleaner", "Office assistant", "Event assistant", "Supervisor"];
const experienceLevels = ["No experience yet", "Less than 1 year", "1–3 years", "More than 3 years"];

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-on-surface">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-outline">{hint}</span>}
    </label>
  );
}

export function ApplicationForm({ kind }: { kind: Kind }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const res = await fetch("/api/applications/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, kind }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(Object.values(body).flat().join(" ") || "Something went wrong.");
      }
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-3xl border border-secondary/20 bg-secondary-container p-8 text-center">
        <CircleCheck className="mx-auto size-10 text-secondary" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold">Thank you — we&apos;ve received it</h2>
        <p className="mt-2 text-on-surface-variant">We&apos;ll contact you by phone or WhatsApp.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-3xl border border-surface-container-high bg-white p-6 shadow-card md:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name">
          <input name="full_name" required maxLength={120} autoComplete="name" className="field" />
        </Field>
        <Field label="Phone (WhatsApp)">
          <input name="phone" required maxLength={30} type="tel" autoComplete="tel" className="field" />
        </Field>
        <Field label="Email (optional)">
          <input name="email" type="email" autoComplete="email" className="field" />
        </Field>
        <Field label="Where in Lagos do you live?">
          <input name="location" maxLength={120} placeholder="e.g. Yaba" className="field" />
        </Field>
        {kind === "job" && (
          <>
            <Field label="Role">
              <select name="role" required className="field" defaultValue="">
                <option value="" disabled>
                  Choose a role
                </option>
                {roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Cleaning experience">
              <select name="experience" className="field" defaultValue={experienceLevels[0]}>
                {experienceLevels.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </Field>
          </>
        )}
      </div>
      <Field label={kind === "job" ? "Tell us about yourself (optional)" : "What would you like to know? (optional)"}>
        <textarea name="message" rows={4} className="field h-auto py-3" />
      </Field>
      {state === "error" && (
        <p role="alert" className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}
      <button type="submit" disabled={state === "sending"} className={`${btn.primary} w-full sm:w-auto`}>
        {state === "sending" && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        {kind === "job" ? "Send application" : "Send enquiry"}
      </button>
    </form>
  );
}
