import { ProfilesGate } from "@/components/ProfilesGate";
import { Suspense } from "react";
import { GlsLogo } from "@/components/GlsLogo";

function ProfilesFallback() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gls-black px-6">
      <GlsLogo size="lg" href="/" glass />
      <div className="gls-buffer-ring mt-16" aria-hidden />
      <p className="mt-6 text-sm text-gls-muted">Loading who&apos;s watching…</p>
    </main>
  );
}

export default function ProfilesPage() {
  return (
    <Suspense fallback={<ProfilesFallback />}>
      <ProfilesGate />
    </Suspense>
  );
}
