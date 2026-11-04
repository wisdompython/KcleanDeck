import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getServices, getSite } from "@/lib/api";
import { whatsappLink } from "@/lib/format";

export const metadata: Metadata = {
  title: "Discuss a service",
  description: "Discuss your commercial cleaning or facility-support needs with Kleandeck on WhatsApp.",
};

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const [params, site, services] = await Promise.all([
    searchParams,
    getSite().catch(() => null),
    getServices().catch(() => []),
  ]);
  const requestedSlug = Array.isArray(params.service) ? params.service[0] : params.service;
  const service = services.find((item) => item.slug === requestedSlug);
  const message = service
    ? `Hello Kleandeck, I'd like to discuss booking ${service.name}. Please help me confirm the scope, availability and final price.`
    : "Hello Kleandeck, I'd like to book a service. Please help me choose the right option and confirm availability and pricing.";

  redirect(whatsappLink(site?.whatsapp_number, message));
}
