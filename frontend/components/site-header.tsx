import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { WhatsAppIcon } from "@/components/icons";
import { MobileNav } from "@/components/mobile-nav";
import { btn } from "@/components/ui";
import { getSite } from "@/lib/api";
import { whatsappLink } from "@/lib/format";

const navLinks = [
  { href: "/#services", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/careers", label: "Careers" },
  { href: "/academy", label: "Academy" },
];

async function HeaderWhatsApp() {
  const site = await getSite().catch(() => null);
  return (
    <a
      href={whatsappLink(site?.whatsapp_number, "Hello Kleandeck, I'd like to ask about a cleaning job.")}
      className="hidden h-10 items-center gap-2 rounded-full border border-surface-container-high px-4 text-sm font-semibold text-on-surface transition hover:bg-surface-container-low lg:inline-flex"
    >
      <WhatsAppIcon className="size-4 text-whatsapp" />
      Chat on WhatsApp
    </a>
  );
}

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
        </nav>

        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <HeaderWhatsApp />
          </Suspense>
          <Link href="/book" className={`${btn.primary} hidden h-10 px-5 text-sm sm:inline-flex`}>
            Book a clean
          </Link>
          <MobileNav links={navLinks} />
        </div>
      </div>
    </header>
  );
}
