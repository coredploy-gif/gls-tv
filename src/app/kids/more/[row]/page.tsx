import { Suspense } from "react";
import { CategoryMore } from "@/components/HubExtras";
import type { HubKey } from "@/lib/hubs";

type Props = {
  params: Promise<{ row: string }>;
};

function MoreInner({
  hubKey,
  row,
}: {
  hubKey: HubKey;
  row: string;
}) {
  return <CategoryMore hubKey={hubKey} row={row} />;
}

export default async function KidsMorePage({ params }: Props) {
  const { row } = await params;
  return (
    <Suspense fallback={<main className="min-h-screen bg-gls-black" />}>
      <MoreInner hubKey="kids" row={row} />
    </Suspense>
  );
}
