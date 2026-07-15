"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/pc", label: "Projets", match: (path: string) => path === "/pc" },
  {
    href: "/pc/referentiels",
    label: "Référentiels",
    match: (path: string) => path.startsWith("/pc/referentiels"),
  },
  {
    href: "/pc/parametres",
    label: "Paramètres",
    match: (path: string) => path.startsWith("/pc/parametres"),
  },
  {
    href: "/pc/profil",
    label: "Profil",
    match: (path: string) => path.startsWith("/pc/profil"),
  },
] as const;

export function PcAppNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              active
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
