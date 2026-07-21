import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string; lotId: string }>;
};

export default async function FinanceNewSituationRedirectPage({ params }: PageProps) {
  const { id, lotId } = await params;
  redirect(`/pc/projets/${id}/suivi-financier/situation-travaux/${lotId}/nouvelle`);
}
