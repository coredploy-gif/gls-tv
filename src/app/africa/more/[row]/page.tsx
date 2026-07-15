import { Suspense } from "react";
import { CategoryMore } from "@/components/HubExtras";

type Props = { params: Promise<{ row: string }> };

export default async function AfricaMorePage({ params }: Props) {
  const { row } = await params;
  return (
    <Suspense fallback={<main className="min-h-screen bg-gls-black" />}>
      <CategoryMore hubKey="africa" row={row} />
    </Suspense>
  );
}
