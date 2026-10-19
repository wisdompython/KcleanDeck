"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { useMe, useSignOut } from "@/components/admin/auth";
import { Button, ErrorNote, Field, inputClass, PageHeader, Panel, useToast } from "@/components/admin/ui";
import { api } from "@/lib/admin/api";

export function AccountScreen() {
  const me = useMe();
  const toast = useToast();
  const signOut = useSignOut();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const change = useMutation({
    mutationFn: () => {
      if (next !== confirm) throw new Error("The new passwords don't match.");
      return api("auth/password/", { method: "POST", body: { current_password: current, new_password: next } });
    },
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      toast("Password changed");
    },
  });

  return (
    <div className="max-w-2xl animate-fade-up">
      <PageHeader eyebrow="Account" title={me.name} description={`${me.email} · ${me.role === "owner" ? "Owner" : "Staff"}`} />
      <Panel title="Change password">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            change.mutate();
          }}
          className="space-y-4"
        >
          <Field label="Current password">
            {(id) => <input id={id} type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />}
          </Field>
          <Field label="New password" hint="At least 8 characters">
            {(id) => <input id={id} type="password" required minLength={8} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Confirm new password">
            {(id) => <input id={id} type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />}
          </Field>
          <ErrorNote error={change.error} />
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="submit" loading={change.isPending}>
              Update password
            </Button>
            <Button variant="ghost" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
