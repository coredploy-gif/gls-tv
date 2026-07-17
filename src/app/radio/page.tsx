import { BrowseNav } from "@/components/BrowseNav";
import { RadioHub } from "@/components/RadioHub";

export const metadata = {
  title: "Radio · GLS TV",
  description:
    "Listen to curated African radio — SABC, MBC, Capital FM, Wazobia, Peace FM, ZBC, and more on GLS TV.",
};

export default function RadioPage() {
  return (
    <main className="min-h-screen bg-gls-black pb-24">
      <BrowseNav />
      <RadioHub />
    </main>
  );
}
