import { EadminSeedsPanel } from "@/components/EadminSeedsPanel";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminM3uImport } from "@/components/admin/AdminM3uImport";
import { AdminMediaLinksPanel } from "@/components/admin/AdminMediaLinksPanel";

export default function AdminLinksPage() {
  return (
    <div>
      <AdminPageHeader
        eyebrow="Catalog"
        title="Links & streams"
        description="Seed HLS URLs, import approved M3U lists, and curate Staff picks that members see on My Links after preview + confirm publish."
      />
      <div className="gls-admin-card mt-8 rounded-lg p-5 sm:p-6">
        <AdminMediaLinksPanel />
      </div>
      <div className="gls-admin-card mt-8 rounded-lg p-5 sm:p-6">
        <EadminSeedsPanel />
      </div>
      <div className="gls-admin-card mt-8 rounded-lg p-5 sm:p-6">
        <AdminM3uImport />
      </div>
    </div>
  );
}
