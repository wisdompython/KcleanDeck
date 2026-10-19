"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect } from "react";

import { Spinner } from "@/components/admin/ui";
import { api, isAuthError } from "@/lib/admin/api";
import type { Me } from "@/lib/admin/types";

const MeContext = createContext<Me | null>(null);

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe must be used inside <RequireTeam>");
  return me;
}

export const useIsOwner = () => useMe().role === "owner";

/** Renders children only for a signed-in team member; otherwise goes to the login page. */
export function RequireTeam({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, error, isPending } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("auth/me/") });

  useEffect(() => {
    if (error && isAuthError(error)) {
      const next = window.location.pathname + window.location.search;
      router.replace(`/admin/login?next=${encodeURIComponent(next)}`);
    }
  }, [error, router]);

  if (isPending || (error && isAuthError(error))) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-container-low">
        <Spinner label="Checking your sign-in…" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-container-low p-6 text-center text-sm text-on-surface-variant">
        We couldn&apos;t reach the server. Check your connection and refresh the page.
      </div>
    );
  }
  return <MeContext.Provider value={data}>{children}</MeContext.Provider>;
}

export function useSignOut() {
  const client = useQueryClient();
  const router = useRouter();
  return async () => {
    await api("auth/logout/", { method: "POST" }).catch(() => undefined);
    client.clear();
    router.replace("/admin/login");
  };
}
