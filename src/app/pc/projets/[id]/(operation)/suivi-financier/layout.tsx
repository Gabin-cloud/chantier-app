import type { ReactNode } from "react";
import { NavTabs, type NavTabItem } from "@/components/pc/NavTabs";

type SuiviFinancierLayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export default async function SuiviFinancierLayout({
  children,
  params,
}: SuiviFinancierLayoutProps) {
  const { id } = await params;
  const base = `/pc/projets/${id}/suivi-financier`;

  const items: NavTabItem[] = [
    { href: `${base}/synthese`, label: "Synthèse financière" },
    { href: `${base}/situations`, label: "Synthèse des situations" },
    { href: `${base}/situation-travaux`, label: "Situation de travaux" },
    { href: `${base}/previsionnel`, label: "Prévisionnel" },
    { href: `${base}/suivi-devis`, label: "Suivi des devis" },
    { href: `${base}/cie`, label: "CIE" },
    { href: `${base}/prorata`, label: "ProRata" },
    { href: `${base}/dgd`, label: "DGD" },
    { href: `${base}/avenants`, label: "Avenants" },
    { href: `${base}/attestations`, label: "Attestations" },
  ];

  return (
    <div className="space-y-3">
      <div className="border-b border-slate-200">
        <NavTabs items={items} variant="secondary" />
      </div>
      {children}
    </div>
  );
}
