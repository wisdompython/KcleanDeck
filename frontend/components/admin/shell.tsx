"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CalendarCheck2,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  Tags,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useMe, useSignOut } from "@/components/admin/auth";
import { api } from "@/lib/admin/api";
import type { Dashboard } from "@/lib/admin/types";

type NavItem = {
  href: string;
  label: string;
  /** Shown as a tooltip so people know what's behind each link. */
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeLabel?: string;
  ownerOnly?: boolean;
};

type NavGroup = { title: string; items: NavItem[] };

function useNav(): NavGroup[] {
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("dashboard/") });
  return [
    {
      title: "Daily work",
      items: [
        { href: "/admin", label: "Dashboard", hint: "Today's jobs, payments to chase and new requests", icon: LayoutDashboard },
        {
          href: "/admin/bookings",
          label: "Bookings",
          hint: "Every booking: online, WhatsApp quotes and ones you entered",
          icon: CalendarCheck2,
          badge: data?.counts.quote_requests,
          badgeLabel: "quote requests waiting",
        },
        { href: "/admin/cleaners", label: "Cleaners", hint: "Your team on the ground, to assign to jobs", icon: Users },
        {
          href: "/admin/applications",
          label: "Job applications",
          hint: "People who applied to work with you or asked about the academy",
          icon: ClipboardList,
          badge: data?.new_applications,
          badgeLabel: "new applications",
        },
      ],
    },
    {
      title: "Your services",
      items: [
        { href: "/admin/services", label: "Services & prices", hint: "What customers can book and how much it costs", icon: Tags },
        { href: "/admin/categories", label: "Homepage categories", hint: "The 'Who we work with' cards on the homepage", icon: LayoutGrid },
      ],
    },
    {
      title: "Setup",
      items: [
        { href: "/admin/settings", label: "Business settings", hint: "Contact details, VAT, terms, areas, times and FAQs", icon: Settings },
        { href: "/admin/team", label: "Team accounts", hint: "Who can sign in to this admin", icon: ShieldCheck, ownerOnly: true },
      ],
    },
  ];
}

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const me = useMe();
  const signOut = useSignOut();
  const groups = useNav()
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.ownerOnly || me.role === "owner") }))
    .filter((g) => g.items.length);

  return (
    <div className="flex h-full flex-col bg-primary text-white">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <Image src="/logo-white.png" unoptimized alt="Kleandeck" width={463} height={318} className="h-10 w-auto" />
        <div className="leading-tight">
          <p className="font-display text-[11px] font-bold tracking-[0.08em] text-tertiary uppercase">Operations</p>
          <p className="text-xs text-white/60">Lagos</p>
        </div>
      </div>

      <div className="px-4">
        <Link
          href="/admin/bookings/new"
          onClick={onNavigate}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-secondary font-display text-sm font-semibold text-white transition hover:bg-on-secondary-container"
        >
          <Plus className="size-4" aria-hidden="true" /> New booking
        </Link>
      </div>

      <nav aria-label="Admin" className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-2">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-1.5 font-display text-[11px] font-bold tracking-[0.08em] text-white/40 uppercase">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, hint, icon: Icon, badge, badgeLabel }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    title={hint}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon className={`size-[18px] ${active ? "text-tertiary" : ""}`} />
                    <span className="flex-1">{label}</span>
                    {!!badge && (
                      <span
                        aria-label={`${badge} ${badgeLabel}`}
                        className="rounded-full bg-tertiary px-2 py-0.5 text-[11px] font-bold text-primary"
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-white/10 p-3">
        <a
          href="/"
          target="_blank"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
        >
          <ExternalLink className="size-4" /> View website
        </a>
        <Link
          href="/admin/account"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-white/5"
        >
          <span className="grid size-8 place-items-center rounded-full bg-white/10 text-white">
            <UserRound className="size-4" />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold">{me.name}</span>
            <span className="block text-xs text-white/60 capitalize">{me.role}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-container-low">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-surface-container-high bg-surface/90 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="grid size-10 place-items-center rounded-xl border border-surface-container-high"
        >
          <Menu className="size-5" />
        </button>
        <Image src="/logo.png" unoptimized alt="Kleandeck" width={463} height={318} className="h-9 w-auto" />
        <Link
          href="/admin/bookings/new"
          aria-label="New booking"
          className="grid size-10 place-items-center rounded-xl bg-secondary text-white"
        >
          <Plus className="size-5" />
        </Link>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 animate-[vt-fade_0.2s_ease-out_both] bg-primary/50 backdrop-blur-sm"
          />
          <div className="relative h-full w-72 max-w-[85%] animate-[slide-in_0.25s_var(--ease-out-soft)_both]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-3 z-10 grid size-8 place-items-center rounded-full text-white/70 hover:bg-white/10"
            >
              <X className="size-4" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
