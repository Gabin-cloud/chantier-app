"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { storagePublicUrl } from "@/lib/print/table-export";
import type { Project } from "@/lib/types/database";

type FavoriteProject = Pick<Project, "id" | "name" | "owner_name" | "client_name">;

type OperationBannerProps = {
  project: Project;
  favorites: FavoriteProject[];
  operationPhotoUrl: string | null;
  ownerLogoUrl: string | null;
  parametresHref: string;
};

function HomeButton() {
  return (
    <Link
      href="/pc"
      title="Retour au menu principal"
      aria-label="Retour au menu principal"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
        <path d="M12 3l9 8h-3v9h-5v-6H11v6H6v-9H3l9-8z" />
      </svg>
    </Link>
  );
}

function ownerDisplayName(project: Project): string {
  return (project.owner_name || project.client_name || "").trim();
}

export function OperationBanner({
  project,
  favorites,
  operationPhotoUrl,
  ownerLogoUrl,
  parametresHref,
}: OperationBannerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const owner = ownerDisplayName(project);
  const opLine = owner
    ? `${project.name.toUpperCase()} — ${owner.toUpperCase()}`
    : project.name.toUpperCase();

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const photoSrc =
    operationPhotoUrl ??
    (project.operation_photo_path
      ? storagePublicUrl(project.operation_photo_path)
      : null);
  const logoSrc =
    ownerLogoUrl ??
    (project.owner_logo_path ? storagePublicUrl(project.owner_logo_path) : null);

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-[110rem] items-center gap-3 px-4 py-2">
        <HomeButton />

        {/* Photo opération — gauche */}
        <div className="hidden h-14 w-20 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 sm:block">
          {photoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoSrc}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
              Photo
            </div>
          )}
        </div>

        {/* Bandeau central cliquable — favoris */}
        <div ref={menuRef} className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="group w-full rounded-lg px-2 py-1 text-center hover:bg-slate-50"
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
          >
            <p className="truncate text-sm font-bold uppercase tracking-wide text-slate-900 group-hover:text-blue-700">
              {opLine}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Cliquez pour vos favoris ▾
            </p>
          </button>

          {menuOpen && (
            <div className="absolute left-1/2 top-full z-50 mt-1 w-72 max-w-[90vw] -translate-x-1/2 rounded-xl border border-slate-200 bg-white py-2 shadow-xl">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Favoris
              </p>
              {favorites.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-500">
                  Aucun favori. Ajoutez des opérations depuis l&apos;accueil.
                </p>
              ) : (
                <ul className="max-h-64 overflow-y-auto">
                  {favorites.map((fav) => {
                    const favOwner = (fav.owner_name || fav.client_name || "").trim();
                    const label = favOwner
                      ? `${fav.name} — ${favOwner}`
                      : fav.name;
                    return (
                      <li key={fav.id}>
                        <Link
                          href={`/pc/projets/${fav.id}/tableau-de-bord`}
                          onClick={() => setMenuOpen(false)}
                          className="block truncate px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-800"
                        >
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-1 border-t border-slate-100 px-3 pt-2">
                <Link
                  href={parametresHref}
                  onClick={() => setMenuOpen(false)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Fiche opération →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Logo maître d'ouvrage — droite */}
        <div className="flex h-14 w-24 shrink-0 items-center justify-end">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt="Logo maître d'ouvrage"
              className="max-h-14 max-w-[96px] object-contain object-right"
            />
          ) : (
            <div className="flex h-14 w-20 items-center justify-center rounded-md border border-dashed border-slate-200 text-[10px] text-slate-400">
              Logo MOA
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
