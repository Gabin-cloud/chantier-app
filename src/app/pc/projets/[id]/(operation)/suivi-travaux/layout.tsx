import type { ReactNode } from "react";
import { NavTabs, type NavTabItem } from "@/components/pc/NavTabs";

type SuiviTravauxLayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export default async function SuiviTravauxLayout({
  children,
  params,
}: SuiviTravauxLayoutProps) {
  const { id } = await params;
  const base = `/pc/projets/${id}/suivi-travaux`;

  const items: NavTabItem[] = [
    { href: `${base}/synthese`, label: "Synthèse" },
    { href: `${base}/controle`, label: "Contrôle" },
    { href: `${base}/rapport`, label: "Rapport" },
    { href: `${base}/plan`, label: "Plan" },
    { href: `${base}/plans`, label: "Suivi des plans" },
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
