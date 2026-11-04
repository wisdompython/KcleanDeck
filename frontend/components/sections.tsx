import { Check, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { FaqAccordion } from "@/components/faq-accordion";
import { WhatsAppIcon } from "@/components/icons";
import { Photo } from "@/components/photo";
import { btn, card } from "@/components/ui";
import { naira } from "@/lib/format";
import type { Faq, Service } from "@/lib/types";

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  body?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={`reveal ${align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}`}>
      <p className={`eyebrow flex items-center gap-2 ${align === "center" ? "justify-center" : ""}`}>
        <span className="h-px w-6 bg-secondary/45" aria-hidden="true" />
        {eyebrow}
      </p>
      <h2 className="mt-3 text-[28px] leading-9 font-bold tracking-[-0.015em] md:text-[40px] md:leading-[48px] md:tracking-[-0.02em]">
        {title}
      </h2>
      {body && <p className="mt-4 text-base leading-7 text-on-surface-variant md:text-lg">{body}</p>}
    </div>
  );
}

export function PriceTag({ service }: { service: Service }) {
  if (service.starting_price === null) {
    return <span className="font-display text-sm font-bold text-on-tertiary-container">Custom quote</span>;
  }
  return (
    <span className="text-sm text-on-surface-variant">
      From <strong className="tabular font-display text-base text-on-surface">{naira(service.starting_price)}</strong>{" "}
      {service.price_suffix} + VAT
    </span>
  );
}

export function ServiceCard({ service, detailed = false }: { service: Service; detailed?: boolean }) {
  const quoteOnly = service.pricing_method === "quote";
  return (
    <article
      className={`${card} reveal group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-tertiary hover:shadow-pop`}
    >
      {service.image && (
        <div className="relative aspect-[16/10] overflow-hidden bg-surface-container">
          <Photo
            src={service.image}
            card={service.image_card}
            alt=""
            sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
            className="transition duration-500 group-hover:scale-[1.03]"
          />
          {service.badge && (
            <span className="absolute top-4 left-4 rounded-full bg-white/95 px-3 py-1 font-display text-[11px] font-bold tracking-[0.04em] text-on-secondary-container uppercase">
              {service.badge}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-xl font-semibold tracking-[-0.005em]">{service.name}</h3>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">{service.tagline}</p>
        {detailed && service.includes.length > 0 && (
          <ul className="mt-5 space-y-2.5 text-sm text-on-surface">
            {service.includes.map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto pt-6">
          <PriceTag service={service} />
          <Link
            href={`/book?service=${service.slug}`}
            className={`${btn.whatsapp} mt-4 w-full`}
          >
            {quoteOnly ? (
              <>
                <WhatsAppIcon className="size-4" aria-hidden="true" /> Request on WhatsApp
              </>
            ) : (
              <><WhatsAppIcon className="size-4" aria-hidden="true" /> Discuss on WhatsApp</>
            )}
          </Link>
        </div>
      </div>
    </article>
  );
}

export function FaqList({ faqs }: { faqs: Faq[] }) {
  return <FaqAccordion faqs={faqs} />;
}

export function ServiceGridSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`${card} h-[420px] animate-pulse bg-surface-container-low`} />
      ))}
    </div>
  );
}

export function BackendError() {
  return (
    <div role="alert" className="flex flex-col gap-5 rounded-3xl border border-warning/30 bg-warning/10 p-5 text-on-surface sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-warning/15 text-on-warning-container">
          <TriangleAlert className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-display text-sm font-semibold">This section didn&apos;t load</p>
          <p className="mt-1 max-w-xl text-sm leading-6 text-on-surface-variant">
            Try refreshing the page. If it keeps happening, contact us and we&apos;ll help you directly.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 pl-[54px] sm:pl-0">
        <a href="" className="inline-flex h-10 items-center gap-2 rounded-full border border-outline-variant bg-white px-4 font-display text-sm font-semibold text-on-surface transition hover:bg-surface-container-low">
          <RefreshCw className="size-4" aria-hidden="true" /> Try again
        </a>
        <Link href="/#contact" className="inline-flex h-10 items-center rounded-full bg-primary px-4 font-display text-sm font-semibold text-white transition hover:bg-primary-hover">
          Contact us
        </Link>
      </div>
    </div>
  );
}
