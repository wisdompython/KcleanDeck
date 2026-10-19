import { Suspense } from "react";

import { FloatingWhatsApp } from "@/components/floating-whatsapp";
import { SiteFooter, SiteFooterFallback } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <Suspense fallback={<SiteFooterFallback />}>
        <SiteFooter />
      </Suspense>
      <Suspense fallback={null}>
        <FloatingWhatsApp />
      </Suspense>
    </>
  );
}
