"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  removeOwnerSituationTemplate,
  uploadOwnerSituationTemplate,
} from "@/lib/actions/owner-situation-template";
import type { OwnerDirectoryEntry } from "@/lib/types/database";

type OwnerSituationTemplatePanelProps = {
  owner: OwnerDirectoryEntry;
  templateUrl: string | null;
  canEdit: boolean;
};

export function OwnerSituationTemplatePanel({
  owner,
  templateUrl,
  canEdit,
}: OwnerSituationTemplatePanelProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleUpload(file: File) {
    setError(null);
    setMessage(null);
    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const result = await uploadOwnerSituationTemplate(owner.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Modèle Excel enregistré.");
      router.refresh();
    });
  }

  function handleRemove() {
    if (!confirm("Supprimer le modèle Excel situation de travaux ?")) return;
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await removeOwnerSituationTemplate(owner.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Modèle supprimé.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Modèle situation de travaux</h2>
      <p className="mt-2 text-sm text-slate-500">
        Importez le modèle Excel fourni par ce promoteur. Il sera proposé lors de
        l&apos;export des situations de travaux pour les opérations rattachées à ce
        maître d&apos;ouvrage.
      </p>

      {owner.situation_template_name ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-medium text-emerald-900">
            Modèle actuel : {owner.situation_template_name}
          </p>
          {templateUrl && (
            <a
              href={templateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-semibold text-emerald-800 underline"
            >
              Télécharger le modèle
            </a>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Aucun modèle Excel enregistré.</p>
      )}

      {canEdit && (
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            {owner.situation_template_name ? "Remplacer le modèle" : "Importer Excel"}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              disabled={isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
          </label>
          {owner.situation_template_name && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={isPending}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Supprimer
            </button>
          )}
        </div>
      )}

      {message && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </section>
  );
}
