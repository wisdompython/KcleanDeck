"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button, ErrorNote, Field, inputClass } from "@/components/admin/ui";
import { api } from "@/lib/admin/api";
import type { Me } from "@/lib/admin/types";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const me = await api<Me>("auth/login/", {
        method: "POST",
        body: { email: form.get("email"), password: form.get("password") },
      });
      client.setQueryData(["me"], me);
      const next = params.get("next");
      router.replace(next?.startsWith("/admin") ? next : "/admin");
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-primary p-12 text-white lg:flex">
        <Image src="/logo-white.png" unoptimized alt="Kleandeck" width={463} height={318} className="h-14 w-auto self-start" />
        <div>
          <p className="font-display text-xs font-bold tracking-[0.08em] text-tertiary uppercase">Operations admin</p>
          <h1 className="mt-3 max-w-md text-4xl leading-tight font-bold text-white">
            Bookings, cleaners and rates in one place.
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Confirm jobs, assign your team, record agreed payments and keep prices up to date.
          </p>
        </div>
        <p className="text-sm text-white/50">Kleandeck · Lagos</p>
      </div>

      <div className="flex items-center justify-center bg-surface-container-low px-4 py-12">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-sm animate-fade-up rounded-2xl border border-surface-container bg-surface p-7 shadow-card"
        >
          <Image src="/logo.png" unoptimized alt="Kleandeck" width={463} height={318} className="mb-6 h-12 w-auto lg:hidden" />
          <h2 className="text-xl font-bold">Sign in</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Use the email and password your admin gave you.</p>
          <div className="mt-6 space-y-4">
            <Field label="Email">
              {(id) => <input id={id} name="email" type="text" inputMode="email" required autoComplete="username" className={inputClass} />}
            </Field>
            <Field label="Password">
              {(id) => (
                <input
                  id={id}
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className={inputClass}
                />
              )}
            </Field>
            <ErrorNote error={error} />
            <Button type="submit" loading={loading} className="w-full">
              <Lock className="size-4" aria-hidden="true" /> Sign in
            </Button>
          </div>
          <p className="mt-5 text-center text-xs text-outline">Forgot your password? Ask an owner to reset it.</p>
        </form>
      </div>
    </div>
  );
}
