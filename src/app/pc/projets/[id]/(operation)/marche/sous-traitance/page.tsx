import { redirect } from "next/navigation";

export default async function SousTraitanceIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/pc/projets/${id}/marche/sous-traitance/tableau-de-bord`);
}
