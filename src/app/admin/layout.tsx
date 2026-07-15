import { requireAdmin } from "@/lib/admin/guard";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminServiceRoleBanner } from "@/components/admin/AdminServiceRoleBanner";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  return (
    <AdminShell email={user.email}>
      <AdminServiceRoleBanner />
      {children}
    </AdminShell>
  );
}
