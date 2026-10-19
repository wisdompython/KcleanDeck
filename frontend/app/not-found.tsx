import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { PageTransition } from "@/components/transitions";
import { btn } from "@/components/ui";

// Rendered under the root layout only, so it brings its own header.
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <PageTransition>
        <main className="container-page py-24 text-center">
          <p className="eyebrow">404</p>
          <h1 className="mt-3 text-3xl font-bold">We couldn&apos;t find that page</h1>
          <p className="mt-3 text-on-surface-variant">
            It may have moved. Try the homepage or get a price for your space.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/" className={btn.ghost}>
              Home
            </Link>
            <Link href="/book" className={btn.primary}>
              Book a clean
            </Link>
          </div>
        </main>
      </PageTransition>
    </>
  );
}
