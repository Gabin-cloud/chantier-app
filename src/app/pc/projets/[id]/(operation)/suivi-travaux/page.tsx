import { redirect } from "next/navigation";

export default async function SuiviTravauxIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/pc/projets/${id}/suivi-travaux/synthese`);
}
