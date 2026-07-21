import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function FinanceSituationsRedirectPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/pc/projets/${id}/suivi-financier/situation-travaux`);
}
