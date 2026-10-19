"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Plus, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";

import { useIsOwner, useMe } from "@/components/admin/auth";
import { Avatar } from "@/components/admin/booking-bits";
import { Button, Chip, Dialog, EmptyState, ErrorNote, Field, inputClass, PageHeader, Panel, Spinner, useToast } from "@/components/admin/ui";
import { api } from "@/lib/admin/api";
import { formatDateTime } from "@/lib/admin/labels";
import type { Role, TeamMember } from "@/lib/admin/types";

const roleInfo: Record<Role, string> = {
  owner: "Everything, including rates, settings and team accounts",
  staff: "Bookings, cleaners and applications. Can view rates and settings.",
};

function PasswordReveal({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const toast = useToast();
  return (
    <Dialog
      open
      onClose={onClose}
      title="Share these sign-in details"
      description="This password is shown once. Send it privately; they can change it under Account."
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="space-y-2 rounded-xl bg-surface-container-low p-4 font-mono text-sm">
        <p>Sign in: {typeof window !== "undefined" ? `${window.location.origin}/admin` : "/admin"}</p>
        <p>Email: {email}</p>
        <p>Password: {password}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-3"
        onClick={() =>
          navigator.clipboard
            .writeText(`Kleandeck admin\n${window.location.origin}/admin\nEmail: ${email}\nPassword: ${password}`)
            .then(() => toast("Copied"))
        }
      >
        <Copy className="size-3.5" /> Copy details
      </Button>
    </Dialog>
  );
}

export function TeamScreen() {
  const isOwner = useIsOwner();
  const me = useMe();
  const client = useQueryClient();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", role: "staff" as Role });
  const [reveal, setReveal] = useState<{ email: string; password: string } | null>(null);

  const { data, error, isPending } = useQuery({ queryKey: ["team"], queryFn: () => api<TeamMember[]>("team/"), enabled: isOwner });

  const add = useMutation({
    mutationFn: () => api<TeamMember>("team/", { method: "POST", body: draft }),
    onSuccess: (member) => {
      client.invalidateQueries({ queryKey: ["team"] });
      setAdding(false);
      setDraft({ name: "", email: "", role: "staff" });
      if (member.temp_password) setReveal({ email: member.email, password: member.temp_password });
    },
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: Partial<TeamMember> & { id: number }) => api<TeamMember>(`team/${id}/`, { method: "PATCH", body }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["team"] });
      toast("Team updated");
    },
    onError: (e) => toast(e.message, "error"),
  });
  const reset = useMutation({
    mutationFn: (m: TeamMember) => api<{ temp_password: string }>(`team/${m.id}/reset-password/`, { method: "POST" }),
    onSuccess: (res, m) => setReveal({ email: m.email, password: res.temp_password }),
    onError: (e) => toast(e.message, "error"),
  });

  if (!isOwner) return <EmptyState title="Owners only" body="Ask an owner to manage team accounts." />;

  return (
    <div className="animate-fade-up">
      <PageHeader
        eyebrow="Access"
        title="Team accounts"
        description="Who can sign in to this admin."
        actions={
          <Button variant="accent" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add team member
          </Button>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        {(Object.keys(roleInfo) as Role[]).map((role) => (
          <div key={role} className="flex gap-3 rounded-2xl border border-surface-container bg-surface p-4">
            <span className="grid size-9 place-items-center rounded-lg bg-primary-fixed text-primary">
              {role === "owner" ? <ShieldCheck className="size-4" /> : <UserRound className="size-4" />}
            </span>
            <div>
              <p className="text-sm font-semibold capitalize">{role}</p>
              <p className="text-xs text-on-surface-variant">{roleInfo[role]}</p>
            </div>
          </div>
        ))}
      </div>

      <ErrorNote error={error} />
      {isPending ? (
        <Spinner />
      ) : (
        <Panel bodyClassName="divide-y divide-surface-container">
          {data?.map((m) => {
            const self = m.id === me.id;
            return (
              <div key={m.id} className={`flex flex-wrap items-center gap-3 px-5 py-4 ${m.is_active ? "" : "opacity-60"}`}>
                <Avatar name={m.name || m.email} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    {m.name || m.email} {self && <Chip className="bg-surface-container text-on-surface-variant">You</Chip>}
                    {!m.is_active && <Chip className="bg-error/10 text-error">Deactivated</Chip>}
                  </p>
                  <p className="truncate text-xs text-on-surface-variant">
                    {m.email} · last sign-in {m.last_login ? formatDateTime(m.last_login) : "never"}
                  </p>
                </div>
                <select
                  aria-label="Role"
                  value={m.role}
                  disabled={self}
                  onChange={(e) => update.mutate({ id: m.id, role: e.target.value as Role })}
                  className={`${inputClass} w-32`}
                >
                  <option value="owner">Owner</option>
                  <option value="staff">Staff</option>
                </select>
                <Button size="sm" variant="subtle" loading={reset.isPending && reset.variables?.id === m.id} onClick={() => reset.mutate(m)}>
                  <KeyRound className="size-3.5" /> Reset password
                </Button>
                {!self && (
                  <Button size="sm" variant={m.is_active ? "danger" : "ghost"} onClick={() => update.mutate({ id: m.id, is_active: !m.is_active })}>
                    {m.is_active ? "Deactivate" : "Reactivate"}
                  </Button>
                )}
              </div>
            );
          })}
        </Panel>
      )}

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title="Add team member"
        description="They'll get a temporary password to sign in with."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button loading={add.isPending} onClick={() => add.mutate()}>
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            {(id) => <input id={id} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} />}
          </Field>
          <Field label="Email" error={add.error && "fields" in add.error ? (add.error as { fields: Record<string, string> }).fields.email : undefined}>
            {(id) => <input id={id} type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className={inputClass} />}
          </Field>
          <Field label="Role">
            {(id) => (
              <select id={id} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })} className={inputClass}>
                <option value="staff">Staff — {roleInfo.staff}</option>
                <option value="owner">Owner — {roleInfo.owner}</option>
              </select>
            )}
          </Field>
          <ErrorNote error={add.error} />
        </div>
      </Dialog>

      {reveal && <PasswordReveal {...reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}
