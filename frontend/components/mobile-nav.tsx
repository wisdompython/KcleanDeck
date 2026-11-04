"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { btn } from "@/components/ui";

export function MobileNav({
  links,
  joinLinks,
}: {
  links: { href: string; label: string }[];
  joinLinks: { href: string; label: string; description: string }[];
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="grid size-10 place-items-center rounded-full border border-surface-container-high text-on-surface"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full animate-[fade-up_0.25s_var(--ease-out-soft)_both] border-b border-surface-container-high bg-white px-4 pt-2 pb-6 shadow-pop">
          <nav aria-label="Mobile" className="flex flex-col">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className="border-b border-surface-container py-3 font-display text-base font-semibold text-on-surface"
              >
                {link.label}
              </Link>
            ))}
            <p className="pt-4 pb-1 font-display text-[11px] font-bold tracking-[0.08em] text-outline uppercase">
              Join Kleandeck
            </p>
            {joinLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className="border-b border-surface-container py-3 pl-3 font-display text-sm font-semibold text-on-surface"
              >
                {link.label}
                <span className="mt-0.5 block font-sans text-xs font-normal text-on-surface-variant">{link.description}</span>
              </Link>
            ))}
          </nav>
          <Link href="/book" onClick={close} className={`${btn.primary} mt-5 w-full`}>
            Book a service
          </Link>
        </div>
      )}
    </div>
  );
}
