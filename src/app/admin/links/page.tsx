import { EadminSeedsPanel } from "@/components/EadminSeedsPanel";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminM3uImport } from "@/components/admin/AdminM3uImport";
import { AdminMediaLinksPanel } from "@/components/admin/AdminMediaLinksPanel";
import { LinkReportsPanel } from "@/components/admin/LinkReportsPanel";

export default function AdminLinksPage() {
  return (
    <div>
      <AdminPageHeader
        eyebrow="Catalog"
        title="Links & streams"
        description="Curate Staff picks for My Links, seed catalog HLS, and preview M3U/HLS imports. Individual streams belong in Staff picks; catalog publish stays MFA-gated."
      />
      <div className="gls-admin-card mt-8 rounded-lg p-5 sm:p-6">
        <AdminMediaLinksPanel />
      </div>
      <div className="gls-admin-card mt-8 rounded-lg p-5 sm:p-6">
        <LinkReportsPanel />
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
