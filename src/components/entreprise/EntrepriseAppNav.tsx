"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/entreprise",
    label: "Mes chantiers",
    match: (path: string) =>
      path === "/entreprise" || path.startsWith("/entreprise/projets"),
  },
  {
    href: "/entreprise/profil",
    label: "Profil",
    match: (path: string) => path.startsWith("/entreprise/profil"),
  },
] as const;

export function EntrepriseAppNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-amber-200 pb-3">
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              active
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-white text-amber-800 ring-1 ring-amber-200 hover:text-amber-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
