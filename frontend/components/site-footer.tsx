import Image from "next/image";
import Link from "next/link";

import { getServices, getSite } from "@/lib/api";
import { whatsappLink } from "@/lib/format";

type FooterLink = { href: string; label: string };

const companyColumn = {
  title: "Company",
    links: [
      { href: "/about", label: "About us" },
      { href: "/pricing", label: "Pricing" },
      { href: "/#faq", label: "FAQ" },
      { href: "/careers", label: "Careers" },
      { href: "/academy", label: "Training academy" },
      { href: "/terms", label: "Terms & conditions" },
    ],
};

function FooterFrame({
  contact,
  year,
  services = [],
}: {
  contact?: React.ReactNode;
  year?: number;
  services?: FooterLink[];
}) {
  const columns = [{ title: "Services", links: services }, companyColumn];
  return (
    <footer className="bg-primary text-white/80">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Image src="/logo-white.png" unoptimized alt="Kleandeck" width={463} height={318} className="h-14 w-auto" />
          <p className="mt-4 max-w-xs text-sm leading-6">
            Commercial cleaning and facility support for offices, gyms, interior projects and growing businesses.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h2 className="font-display text-sm font-bold text-white">{col.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition hover:text-tertiary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div id="contact">
          <h2 className="font-display text-sm font-bold text-white">Contact</h2>
          <div className="mt-4 space-y-2.5 text-sm">{contact}</div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-6 pb-24 text-xs text-white/60 sm:flex-row sm:justify-between sm:pb-6">
          <p>© {year} Kleandeck. All rights reserved.</p>
          <p>Payments secured by Paystack</p>
        </div>
      </div>
    </footer>
  );
}

export function SiteFooterFallback() {
  return <FooterFrame />;
}

export async function SiteFooter() {
  const [site, services] = await Promise.all([getSite().catch(() => null), getServices().catch(() => [])]);
  return (
    <FooterFrame
      year={new Date().getFullYear()}
      services={services.map((s) => ({ href: `/book?service=${s.slug}`, label: s.name }))}
      contact={
        <>
          <p>{site?.coverage_text ?? "Serving businesses across Lagos"}</p>
          {site?.address && <p>{site.address}</p>}
          {site?.phone_number && (
            <p>
              <a href={`tel:${site.phone_number.replace(/\s/g, "")}`} className="hover:text-tertiary">
                {site.phone_number}
              </a>
            </p>
          )}
          {site?.email && (
            <p>
              <a href={`mailto:${site.email}`} className="hover:text-tertiary">
                {site.email}
              </a>
            </p>
          )}
          {site?.whatsapp_number && (
            <p>
              <a href={whatsappLink(site.whatsapp_number, "Hello Kleandeck")} className="hover:text-tertiary">
                WhatsApp: +{site.whatsapp_number}
              </a>
            </p>
          )}
        </>
      }
    />
  );
}
