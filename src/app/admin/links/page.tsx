import { EadminSeedsPanel } from "@/components/EadminSeedsPanel";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminM3uImport } from "@/components/admin/AdminM3uImport";

export default function AdminLinksPage() {
  return (
    <div>
      <AdminPageHeader
        eyebrow="Catalog"
        title="Links & streams"
        description="Seed and manage HLS URLs for the catalog — TSN, Fox, series packs, and custom slugs. Fully managed in this portal."
      />
      <div className="gls-admin-card mt-8 rounded-lg p-5 sm:p-6">
        <EadminSeedsPanel />
      </div>
      <div className="gls-admin-card mt-8 rounded-lg p-5 sm:p-6">
        <AdminM3uImport />
      </div>
    </div>
  );
}
