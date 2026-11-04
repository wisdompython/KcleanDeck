import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { MobileNav } from "@/components/mobile-nav";
import { btn } from "@/components/ui";

const navLinks = [
  { href: "/#services", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About us" },
];

const joinLinks = [
  { href: "/careers", label: "Careers", description: "Join our cleaning and support team" },
  { href: "/academy", label: "Academy", description: "Screening and practical training" },
];

export function SiteHeader() {
  return (
    <header style={{ viewTransitionName: "site-header" }} className="sticky top-0 z-40 border-b border-on-surface/[0.06] bg-white/[0.88] backdrop-blur-lg">
      <div className="container-page relative flex h-16 items-center justify-between gap-4 md:h-[72px]">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Kleandeck home">
          <Image src="/logo.png" unoptimized alt="Kleandeck" width={463} height={318} priority className="h-11 w-auto md:h-12" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 rounded-full bg-surface-container p-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-on-surface-variant transition hover:bg-white hover:text-on-surface"
            >
              {link.label}
            </Link>
          ))}
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full px-4 py-2 text-sm font-medium text-on-surface-variant transition hover:bg-white hover:text-on-surface [&::-webkit-details-marker]:hidden">
              Join Kleandeck <ChevronDown className="size-3.5 transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="absolute top-[calc(100%+0.75rem)] right-0 w-64 rounded-2xl border border-surface-container-high bg-white p-2 shadow-pop">
              {joinLinks.map((link) => (
                <Link key={link.href} href={link.href} className="block rounded-xl px-3 py-2.5 transition hover:bg-surface-container-low">
                  <span className="block font-display text-sm font-semibold text-on-surface">{link.label}</span>
                  <span className="mt-0.5 block text-xs text-on-surface-variant">{link.description}</span>
                </Link>
              ))}
            </div>
          </details>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/book" className={`${btn.primary} hidden h-10 px-5 text-sm sm:inline-flex`}>
            Book a service
          </Link>
          <MobileNav links={navLinks} joinLinks={joinLinks} />
        </div>
      </div>
    </header>
  );
}
