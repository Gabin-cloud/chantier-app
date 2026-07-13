"use client";

import {
  INCOMING_FILE_CATEGORY_LABELS,
  type IncomingFileWithDetails,
} from "@/lib/types/database";

type IncomingFilesTableProps = {
  files: IncomingFileWithDetails[];
  fileUrls: Record<string, string>;
};

const CATEGORY_COLORS: Record<string, string> = {
  facture: "bg-blue-100 text-blue-800",
  devis: "bg-amber-100 text-amber-800",
  administratif: "bg-slate-100 text-slate-700",
  chantier: "bg-emerald-100 text-emerald-800",
  plan_exe: "bg-violet-100 text-violet-800",
  autre: "bg-violet-100 text-violet-800",
};

export function IncomingFilesTable({
  files,
  fileUrls,
}: IncomingFilesTableProps) {
  if (files.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">
        Aucun fichier classé pour l&apos;instant. Utilisez le bouton{" "}
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
          📥
        </span>{" "}
        en bas à droite pour classer vos premiers fichiers reçus par mail.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Fichier</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Lot</th>
              <th className="px-4 py-3">Situation</th>
              <th className="px-4 py-3">E-mail</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr
                key={file.id}
                className="border-b border-slate-50 hover:bg-slate-50/50"
              >
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                  {new Date(file.created_at).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3">
                  <a
                    href={fileUrls[file.id]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {file.file_name}
                  </a>
                  {file.notes && (
                    <p className="mt-0.5 text-xs text-slate-400">{file.notes}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      CATEGORY_COLORS[file.category] ?? CATEGORY_COLORS.autre
                    }`}
                  >
                    {INCOMING_FILE_CATEGORY_LABELS[file.category]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {file.lot_number
                    ? `Lot ${file.lot_number}`
                    : file.enterprise_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {file.situation_number ? `n°${file.situation_number}` : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {file.source_email ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
