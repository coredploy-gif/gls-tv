import { BrowseNav } from "@/components/BrowseNav";
import { RadioHub } from "@/components/RadioHub";

export const metadata = {
  title: "Radio · GLS TV",
  description:
    "Listen to curated South African radio — SABC, Primedia, and community stations on GLS TV.",
};

export default function RadioPage() {
  return (
    <main className="min-h-screen bg-gls-black pb-24">
      <BrowseNav />
      <RadioHub />
    </main>
  );
}
