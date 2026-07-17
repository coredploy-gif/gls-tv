import { notFound } from "next/navigation";
import {
  parseReligionFolderParam,
  ReligionFolderHub,
} from "@/components/ReligionHub";
import { RELIGION_FOLDERS } from "@/lib/religion";

type Props = { params: Promise<{ folder: string }> };

export function generateStaticParams() {
  return RELIGION_FOLDERS.map((folder) => ({ folder: folder.key }));
}

export async function generateMetadata({ params }: Props) {
  const { folder: folderParam } = await params;
  const folderKey = parseReligionFolderParam(folderParam);
  if (!folderKey) return { title: "Religion · GLS TV" };
  const meta = RELIGION_FOLDERS.find((f) => f.key === folderKey);
  return {
    title: `${meta?.title ?? folderKey} · Religion · GLS TV`,
    description: meta?.blurb,
  };
}

export default async function ReligionFolderPage({ params }: Props) {
  const { folder: folderParam } = await params;
  const folderKey = parseReligionFolderParam(folderParam);
  if (!folderKey) notFound();
  return <ReligionFolderHub folderKey={folderKey} />;
}
