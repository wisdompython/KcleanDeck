import { RequireTeam } from "@/components/admin/auth";
import { AdminShell } from "@/components/admin/shell";

export default function AdminAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireTeam>
      <AdminShell>{children}</AdminShell>
    </RequireTeam>
  );
}
