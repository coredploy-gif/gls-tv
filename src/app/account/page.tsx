import type { Metadata } from "next";
import { AccountDashboard } from "@/components/AccountDashboard";

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your GLS TV account, security, notifications and data.",
};

export default function AccountPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="gls-display text-4xl text-white">Your account</h1>
      <p className="mt-2 text-sm text-gls-body">Security, preferences, data export and deletion controls.</p>
      <div className="mt-8">
        <AccountDashboard />
      </div>
    </main>
  );
}
