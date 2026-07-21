import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string; lotId: string; situationId: string }>;
};

export default async function FinancePrintSituationRedirectPage({ params }: PageProps) {
  const { id, lotId, situationId } = await params;
  redirect(
    `/pc/projets/${id}/suivi-financier/situation-travaux/${lotId}/${situationId}/print`
  );
}
