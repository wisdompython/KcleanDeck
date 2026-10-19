import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminProviders } from "@/components/admin/providers";
import { Spinner } from "@/components/admin/ui";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Kleandeck admin" },
  robots: { index: false, follow: false },
};

// The admin is client-rendered behind a sign-in check, so the whole area sits
// in one Suspense boundary (URL hooks like useParams suspend during prerender).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProviders>
      <Suspense
        fallback={
          <div className="grid min-h-screen place-items-center bg-surface-container-low">
            <Spinner />
          </div>
        }
      >
        {children}
      </Suspense>
    </AdminProviders>
  );
}
