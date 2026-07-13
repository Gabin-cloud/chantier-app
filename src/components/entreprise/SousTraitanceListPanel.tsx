"use client";

import Link from "next/link";
import { useState } from "react";
import {
  SOUS_TRAITANCE_STATUS_LABELS,
  SOUS_TRAITANCE_TYPE_LABELS,
  type SousTraitanceRequest,
  type SousTraitanceStatus,
} from "@/lib/types/sous-traitance";

type SousTraitanceListPanelProps = {
  projectId: string;
  projectName: string;
  requests: SousTraitanceRequest[];
};

const STATUS_COLORS: Record<SousTraitanceStatus, string> = {
  brouillon: "bg-zinc-100 text-zinc-700",
  soumise: "bg-blue-100 text-blue-800",
  en_revision: "bg-amber-100 text-amber-800",
  acceptee: "bg-emerald-100 text-emerald-800",
  refusee: "bg-red-100 text-red-800",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function SousTraitanceListPanel({
  projectId,
  projectName,
  requests,
}: SousTraitanceListPanelProps) {
  const [filter, setFilter] = useState<SousTraitanceStatus | "all">("all");

  const filtered =
    filter === "all" ? requests : requests.filter((r) => r.status === filter);

  const counts = requests.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6">
        <Link
          href={`/entreprise/projets/${projectId}`}
          className="text-sm font-medium text-amber-600 hover:text-amber-700"
        >
          ← {projectName}
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-zinc-900">Sous-traitance</h1>
        <p className="mt-2 text-zinc-500">
          Demandes de sous-traitance et choix de travaux déposés sur ce chantier.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip
          label="Toutes"
          count={requests.length}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        {(Object.keys(SOUS_TRAITANCE_STATUS_LABELS) as SousTraitanceStatus[]).map(
          (status) =>
            counts[status] ? (
              <FilterChip
                key={status}
                label={SOUS_TRAITANCE_STATUS_LABELS[status]}
                count={counts[status]}
                active={filter === status}
                onClick={() => setFilter(status)}
              />
            ) : null
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href={`/entreprise/projets/${projectId}/sous-traitance/nouvelle`}
          className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500"
        >
          + Nouvelle demande
        </Link>
        <Link
          href={`/entreprise/projets/${projectId}/choix-travaux`}
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-50"
        >
          + Choix de travaux
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-white px-6 py-12 text-center">
          <p className="text-lg font-medium text-zinc-700">Aucune demande</p>
          <p className="mt-2 text-zinc-500">
            Déposez votre première demande de sous-traitance pour ce chantier.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((request) => (
            <li
              key={request.id}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-amber-50"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLORS[request.status]}`}
                    >
                      {SOUS_TRAITANCE_STATUS_LABELS[request.status]}
                    </span>
                    <span className="text-xs font-medium text-zinc-400">
                      {SOUS_TRAITANCE_TYPE_LABELS[request.type]}
                    </span>
                    {request.reference && (
                      <span className="font-mono text-xs text-zinc-400">
                        {request.reference}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-zinc-900">
                    {request.title}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
                    {request.description}
                  </p>
                </div>
                {request.amount_ht != null && (
                  <p className="shrink-0 text-lg font-bold text-zinc-900">
                    {formatMoney(request.amount_ht)}{" "}
                    <span className="text-sm font-normal text-zinc-400">HT</span>
                  </p>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-400">
                <span>Déposée le {formatDate(request.created_at)}</span>
                {request.deadline && (
                  <span>Échéance {formatDate(request.deadline)}</span>
                )}
                {request.enterprises?.lot_number && (
                  <span>Lot {request.enterprises.lot_number}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-amber-600 text-white"
          : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
      }`}
    >
      {label}
      <span className={`ml-1.5 ${active ? "text-amber-200" : "text-zinc-400"}`}>
        {count}
      </span>
    </button>
  );
}
