"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getFinanceNavLabels } from "@/lib/actions/finance";

type FinanceNavBandeauProps = {
  projectId: string;
  projectName: string;
};

type NavLabels = {
  lotNumber: string | null;
  lotDesignation: string | null;
  lotName: string | null;
  situationNumber: number | null;
  isNewSituation: boolean;
  isPrint: boolean;
};

const PRIMARY_SECTIONS = [
  { id: "home", label: "Accueil", segment: "" },
  { id: "lots", label: "Lots & marchés", segment: "lots" },
  { id: "recap", label: "Récap marchés", segment: "recap" },
  { id: "situations", label: "Situations", segment: "situations" },
  {
    id: "recap-situations",
    label: "Récap situations",
    segment: "recap-situations",
  },
] as const;

function getActiveSection(pathname: string, base: string): string {
  const relative = pathname.replace(base, "").replace(/^\//, "");
  if (!relative) return "home";

  const first = relative.split("/")[0];
  if (first === "lots") return "lots";
  if (first === "recap-situations") return "recap-situations";
  if (first === "recap") return "recap";
  if (first === "situations") return "situations";
  return "home";
}

export function FinanceNavBandeau({
  projectId,
  projectName,
}: FinanceNavBandeauProps) {
  const pathname = usePathname();
  const params = useParams();
  const base = `/pc/projets/${projectId}/finance`;

  const lotId = params.lotId as string | undefined;
  const situationId = params.situationId as string | undefined;

  const [labels, setLabels] = useState<NavLabels>({
    lotNumber: null,
    lotDesignation: null,
    lotName: null,
    situationNumber: null,
    isNewSituation: pathname.includes("/nouvelle"),
    isPrint: pathname.endsWith("/print"),
  });

  const activeSection = useMemo(
    () => getActiveSection(pathname, base),
    [pathname, base]
  );

  useEffect(() => {
    if (!lotId) {
      setLabels((prev) => ({
        ...prev,
        lotNumber: null,
        lotDesignation: null,
        lotName: null,
        situationNumber: null,
        isNewSituation: pathname.includes("/nouvelle"),
        isPrint: pathname.endsWith("/print"),
      }));
      return;
    }

    getFinanceNavLabels(projectId, lotId, situationId).then(setLabels);
  }, [projectId, lotId, situationId, pathname]);

  const lotLabel =
    labels.lotNumber && labels.lotDesignation
      ? `Lot ${labels.lotNumber} — ${labels.lotDesignation}`
      : null;

  const secondaryItems = useMemo(() => {
    if (activeSection === "situations") {
      const items = [
        {
          href: `${base}/situations`,
          label: "Tous les lots",
          active: pathname === `${base}/situations`,
        },
      ];

      if (lotId && lotLabel) {
        items.push({
          href: `${base}/situations/${lotId}`,
          label: lotLabel,
          active:
            pathname === `${base}/situations/${lotId}` ||
            (pathname.includes(`/situations/${lotId}`) &&
              !situationId &&
              !pathname.includes("/nouvelle")),
        });
        items.push({
          href: `${base}/situations/${lotId}/nouvelle`,
          label: "+ Nouvelle situation",
          active: pathname.includes("/nouvelle"),
        });
      }

      if (lotId && situationId && labels.situationNumber) {
        items.push({
          href: `${base}/situations/${lotId}/${situationId}`,
          label: `Situation n°${labels.situationNumber}`,
          active:
            pathname === `${base}/situations/${lotId}/${situationId}` &&
            !pathname.endsWith("/print"),
        });
        items.push({
          href: `${base}/situations/${lotId}/${situationId}/print`,
          label: "Export PDF",
          active: pathname.endsWith("/print"),
        });
      }

      return items;
    }

    if (activeSection === "lots") {
      const items = [
        {
          href: `${base}/lots`,
          label: "Liste des lots",
          active: pathname === `${base}/lots`,
        },
      ];

      if (lotId && lotLabel) {
        items.push({
          href: `${base}/lots/${lotId}`,
          label: lotLabel,
          active: pathname === `${base}/lots/${lotId}`,
        });
      }

      return items;
    }

    return [];
  }, [
    activeSection,
    base,
    pathname,
    lotId,
    situationId,
    lotLabel,
    labels.situationNumber,
  ]);

  const breadcrumbs = useMemo(() => {
    const crumbs: { href: string; label: string }[] = [
      { href: `/pc/projets/${projectId}`, label: projectName },
      { href: base, label: "Suivi financier" },
    ];

    const section = PRIMARY_SECTIONS.find((s) => s.id === activeSection);
    if (section && section.id !== "home") {
      crumbs.push({
        href: `${base}/${section.segment}`,
        label: section.label,
      });
    }

    if (lotId && lotLabel) {
      const lotHref =
        activeSection === "lots"
          ? `${base}/lots/${lotId}`
          : `${base}/situations/${lotId}`;
      crumbs.push({ href: lotHref, label: lotLabel });
    }

    if (pathname.includes("/nouvelle")) {
      crumbs.push({
        href: `${base}/situations/${lotId}/nouvelle`,
        label: "Nouvelle situation",
      });
    } else if (situationId && labels.situationNumber) {
      crumbs.push({
        href: `${base}/situations/${lotId}/${situationId}`,
        label: `Situation n°${labels.situationNumber}`,
      });
      if (pathname.endsWith("/print")) {
        crumbs.push({
          href: `${base}/situations/${lotId}/${situationId}/print`,
          label: "Export PDF",
        });
      }
    }

    return crumbs;
  }, [
    projectId,
    projectName,
    base,
    activeSection,
    lotId,
    situationId,
    lotLabel,
    labels.situationNumber,
    pathname,
  ]);

  return (
    <div className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
      {/* Bandeau 1 — sections principales */}
      <div className="border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex w-full max-w-[96rem] flex-wrap items-center gap-1 px-4 py-2 sm:px-8">
          <Link
            href={`/pc/projets/${projectId}`}
            className="mr-3 hidden text-xs font-medium text-slate-400 hover:text-white sm:inline"
          >
            ← Projet
          </Link>
          <span className="mr-4 truncate text-sm font-semibold text-slate-200">
            {projectName}
          </span>
          <nav className="flex flex-1 flex-wrap gap-1">
            {PRIMARY_SECTIONS.map((section) => {
              const href =
                section.id === "home" ? base : `${base}/${section.segment}`;
              const isActive = activeSection === section.id;

              return (
                <Link
                  key={section.id}
                  href={href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-white text-slate-900"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {section.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bandeau 2 — sous-navigation contextuelle */}
      {secondaryItems.length > 0 && (
        <div className="border-b border-slate-200 bg-slate-100">
          <div className="mx-auto flex w-full max-w-[96rem] flex-wrap gap-1 px-4 py-2 sm:px-8">
            {secondaryItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  item.active
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-700 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Bandeau 3 — fil d'Ariane */}
      <div className="bg-white">
        <div className="mx-auto flex w-full max-w-[96rem] flex-wrap items-center gap-1 px-4 py-2 text-sm sm:px-8">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.href} className="flex items-center gap-1">
              {index > 0 && (
                <span className="text-slate-300" aria-hidden>
                  ›
                </span>
              )}
              {index === breadcrumbs.length - 1 ? (
                <span className="font-semibold text-slate-900">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-slate-500 hover:text-blue-600"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
