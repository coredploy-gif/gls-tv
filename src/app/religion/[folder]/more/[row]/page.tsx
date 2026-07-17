import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ReligionFolderMore } from "@/components/ReligionHub";
import { parseReligionFolderParam } from "@/lib/religion";

type Props = { params: Promise<{ folder: string; row: string }> };

export default async function Page({ params }: Props) {
  const { folder: folderParam, row } = await params;
  const folderKey = parseReligionFolderParam(folderParam);
  if (!folderKey) notFound();

  return (
    <Suspense fallback={<main className="min-h-screen bg-gls-black" />}>
      <ReligionFolderMore folderKey={folderKey} row={row} />
    </Suspense>
  );
}
