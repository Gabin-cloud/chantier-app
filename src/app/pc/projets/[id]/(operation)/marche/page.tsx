import { redirect } from "next/navigation";

export default async function MarcheIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/pc/projets/${id}/marche/synthese`);
}
