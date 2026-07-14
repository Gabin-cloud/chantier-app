import type { ReactNode } from "react";
import { NavTabs, type NavTabItem } from "@/components/pc/NavTabs";

type MarcheLayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export default async function MarcheLayout({
  children,
  params,
}: MarcheLayoutProps) {
  const { id } = await params;
  const base = `/pc/projets/${id}/marche`;

  const items: NavTabItem[] = [
    { href: `${base}/synthese`, label: "Synthèse" },
    { href: `${base}/pieces`, label: "Contrôle des pièces administratives" },
    { href: `${base}/sous-traitance`, label: "Sous-traitance" },
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
