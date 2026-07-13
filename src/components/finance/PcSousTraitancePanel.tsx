"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateSousTraitanceStatus } from "@/lib/actions/sous-traitance";
import {
  SOUS_TRAITANCE_STATUS_LABELS,
  SOUS_TRAITANCE_TYPE_LABELS,
  type SousTraitanceRequest,
  type SousTraitanceStatus,
} from "@/lib/types/sous-traitance";

type PcSousTraitancePanelProps = {
  projectId: string;
  requests: SousTraitanceRequest[];
  canManage: boolean;
};

const STATUS_COLORS: Record<SousTraitanceStatus, string> = {
  brouillon: "bg-zinc-100 text-zinc-700",
  soumise: "bg-blue-100 text-blue-800",
  en_revision: "bg-amber-100 text-amber-800",
  acceptee: "bg-emerald-100 text-emerald-800",
  refusee: "bg-red-100 text-red-800",
};

const MANAGER_STATUSES: SousTraitanceStatus[] = [
  "en_revision",
  "acceptee",
  "refusee",
];

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

export function PcSousTraitancePanel({
  projectId,
  requests,
  canManage,
}: PcSousTraitancePanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(requestId: string, status: SousTraitanceStatus) {
    startTransition(async () => {
      await updateSousTraitanceStatus(projectId, requestId, status);
      router.refresh();
    });
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Sous-traitance</h1>
        <p className="mt-2 text-slate-500">
          Demandes déposées par les entreprises sur ce chantier.
        </p>
      </header>

      {requests.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-lg font-medium text-slate-700">Aucune demande</p>
          <p className="mt-2 text-slate-500">
            Les entreprises déposeront leurs demandes depuis l&apos;interface
            Entreprise.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => (
            <li
              key={request.id}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLORS[request.status]}`}
                    >
                      {SOUS_TRAITANCE_STATUS_LABELS[request.status]}
                    </span>
                    <span className="text-xs font-medium text-slate-400">
                      {SOUS_TRAITANCE_TYPE_LABELS[request.type]}
                    </span>
                    {request.enterprises && (
                      <span className="text-xs font-semibold text-slate-600">
                        {request.enterprises.name}
                        {request.enterprises.lot_number &&
                          ` — Lot ${request.enterprises.lot_number}`}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">
                    {request.title}
                  </h2>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">
                    {request.description}
                  </p>
                </div>
                {request.amount_ht != null && (
                  <p className="shrink-0 text-lg font-bold text-slate-900">
                    {formatMoney(request.amount_ht)}{" "}
                    <span className="text-sm font-normal text-slate-400">HT</span>
                  </p>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <span>Déposée le {formatDate(request.created_at)}</span>
                {request.reference && <span>{request.reference}</span>}
              </div>
              {canManage && request.status !== "acceptee" && request.status !== "refusee" && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  {MANAGER_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={isPending || request.status === status}
                      onClick={() => handleStatusChange(request.id, status)}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                    >
                      {SOUS_TRAITANCE_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
