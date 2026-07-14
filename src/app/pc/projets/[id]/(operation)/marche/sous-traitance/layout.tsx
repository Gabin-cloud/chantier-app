import type { ReactNode } from "react";
import { NavTabs, type NavTabItem } from "@/components/pc/NavTabs";

type SousTraitanceLayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export default async function SousTraitanceLayout({
  children,
  params,
}: SousTraitanceLayoutProps) {
  const { id } = await params;
  const base = `/pc/projets/${id}/marche/sous-traitance`;

  const items: NavTabItem[] = [
    { href: `${base}/tableau-de-bord`, label: "Tableau de bord" },
    { href: `${base}/validation`, label: "Validation des pièces" },
  ];

  return (
    <div className="space-y-3">
      <NavTabs items={items} variant="tertiary" />
      {children}
    </div>
  );
}
