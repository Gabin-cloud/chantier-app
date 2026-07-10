"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  completeVisit,
  createMarker,
  deleteMarker,
  updateMarker,
  uploadMarkerPhoto,
} from "@/lib/actions/visits";
import type { MarkerWithLinks, Plan, Visit } from "@/lib/types/database";

type PlanWithUrl = Plan & { public_url: string };

type MarkerWithPhoto = MarkerWithLinks & {
  photo_public_url: string | null;
};

type VisitEditorProps = {
  projectId: string;
  visit: Visit;
  plans: PlanWithUrl[];
  initialMarkers: MarkerWithPhoto[];
};

export function VisitEditor({
  projectId,
  visit,
  plans,
  initialMarkers,
}: VisitEditorProps) {
  const router = useRouter();
  const [markers, setMarkers] = useState(initialMarkers);
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? "");
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [remarkDraft, setRemarkDraft] = useState("");
  const [linkDraft, setLinkDraft] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const planMarkers = markers.filter((m) => m.plan_id === selectedPlanId);
  const selectedMarker = markers.find((m) => m.id === selectedMarkerId) ?? null;

  const otherMarkers = useMemo(
    () => markers.filter((m) => m.id !== selectedMarkerId),
    [markers, selectedMarkerId]
  );

  function selectMarker(marker: MarkerWithPhoto) {
    setSelectedMarkerId(marker.id);
    setRemarkDraft(marker.remark ?? "");
    setLinkDraft(marker.linked_marker_ids);
    setAddMode(false);
  }

  function handlePlanClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!addMode || !selectedPlan || visit.status === "completed") return;

    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

    startTransition(async () => {
      try {
        setError(null);
        const newMarker = await createMarker(
          visit.id,
          projectId,
          selectedPlanId,
          Math.min(100, Math.max(0, xPercent)),
          Math.min(100, Math.max(0, yPercent))
        );
        const withPhoto: MarkerWithPhoto = { ...newMarker, photo_public_url: null };
        setMarkers((prev) => [...prev, withPhoto]);
        selectMarker(withPhoto);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible d'ajouter la pastille.");
      }
    });
  }

  function handleSaveMarker() {
    if (!selectedMarker) return;

    startTransition(async () => {
      try {
        setError(null);
        await updateMarker(visit.id, projectId, selectedMarker.id, {
          remark: remarkDraft,
          linked_marker_ids: linkDraft,
        });
        setMarkers((prev) =>
          prev.map((m) =>
            m.id === selectedMarker.id
              ? { ...m, remark: remarkDraft, linked_marker_ids: linkDraft }
              : m
          )
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
      }
    });
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedMarker || !e.target.files?.[0]) return;

    const formData = new FormData();
    formData.append("photo", e.target.files[0]);

    startTransition(async () => {
      try {
        setError(null);
        const url = await uploadMarkerPhoto(
          visit.id,
          projectId,
          selectedMarker.id,
          formData
        );
        setMarkers((prev) =>
          prev.map((m) =>
            m.id === selectedMarker.id ? { ...m, photo_public_url: url } : m
          )
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'upload.");
      }
    });
  }

  function handleDeleteMarker() {
    if (!selectedMarker || !confirm("Supprimer cette pastille ?")) return;

    startTransition(async () => {
      try {
        setError(null);
        await deleteMarker(visit.id, projectId, selectedMarker.id);
        setMarkers((prev) => prev.filter((m) => m.id !== selectedMarker.id));
        setSelectedMarkerId(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la suppression.");
      }
    });
  }

  function handleCompleteVisit() {
    startTransition(async () => {
      try {
        setError(null);
        await completeVisit(projectId, visit.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function toggleLink(markerId: string) {
    setLinkDraft((prev) =>
      prev.includes(markerId) ? prev.filter((id) => id !== markerId) : [...prev, markerId]
    );
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-semibold text-zinc-900">Aucun plan disponible</p>
        <p className="mt-2 text-zinc-500">
          Importez des plans PDF dans les paramètres du projet avant de commencer
          une visite.
        </p>
        <Link
          href={`/tablette/projets/${projectId}/parametres`}
          className="mt-6 inline-block rounded-xl bg-zinc-900 px-6 py-3 font-semibold text-white"
        >
          Aller aux paramètres
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col lg:flex-row lg:gap-4">
      {/* Zone plan */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => {
                setSelectedPlanId(plan.id);
                setSelectedMarkerId(null);
              }}
              className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                plan.id === selectedPlanId
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
              }`}
            >
              {plan.name}
            </button>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {visit.status !== "completed" && (
            <button
              type="button"
              onClick={() => setAddMode((v) => !v)}
              className={`min-h-12 rounded-xl px-5 py-3 text-sm font-bold ${
                addMode
                  ? "bg-amber-500 text-white"
                  : "bg-white text-zinc-800 shadow-sm"
              }`}
            >
              {addMode ? "✓ Mode pastille actif — touchez le plan" : "+ Ajouter une pastille"}
            </button>
          )}
          {visit.status !== "completed" && (
            <button
              type="button"
              onClick={handleCompleteVisit}
              disabled={isPending}
              className="min-h-12 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Terminer la visite
            </button>
          )}
          {visit.status === "completed" && (
            <span className="inline-flex min-h-12 items-center rounded-xl bg-emerald-100 px-5 text-sm font-semibold text-emerald-800">
              Visite terminée
            </span>
          )}
        </div>

        <div
          className={`relative flex-1 overflow-hidden rounded-2xl bg-white shadow-sm ${
            addMode ? "ring-4 ring-amber-400" : ""
          }`}
          style={{ minHeight: "55vh" }}
        >
          {selectedPlan && (
            <>
              <iframe
                src={`${selectedPlan.public_url}#toolbar=0&navpanes=0`}
                title={selectedPlan.name}
                className="h-full w-full border-0"
                style={{ minHeight: "55vh" }}
              />
              <div
                className={`absolute inset-0 ${addMode ? "cursor-crosshair" : "pointer-events-none"}`}
                onClick={handlePlanClick}
              >
                {planMarkers.map((marker) => (
                  <button
                    key={marker.id}
                    type="button"
                    style={{
                      left: `${marker.x_percent}%`,
                      top: `${marker.y_percent}%`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectMarker(marker);
                    }}
                    className={`pointer-events-auto absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-sm font-bold shadow-lg transition-transform hover:scale-110 ${
                      selectedMarkerId === marker.id
                        ? "border-white bg-amber-500 text-white ring-4 ring-amber-300"
                        : "border-white bg-red-600 text-white"
                    }`}
                  >
                    {marker.marker_number}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Panneau récap */}
      <aside className="mt-4 flex w-full shrink-0 flex-col lg:mt-0 lg:w-96">
        <div className="flex max-h-[85vh] flex-col rounded-2xl bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="text-lg font-bold text-zinc-900">Remarques</h2>
            <p className="text-sm text-zinc-500">
              {planMarkers.length} pastille{planMarkers.length !== 1 ? "s" : ""} sur ce plan
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {planMarkers.length === 0 ? (
              <p className="px-2 py-4 text-sm text-zinc-500">
                Activez le mode pastille et touchez le plan pour commencer.
              </p>
            ) : (
              <ul className="space-y-2">
                {planMarkers.map((marker) => (
                  <li key={marker.id}>
                    <button
                      type="button"
                      onClick={() => selectMarker(marker)}
                      className={`w-full rounded-xl px-4 py-3 text-left transition-colors ${
                        selectedMarkerId === marker.id
                          ? "bg-amber-50 ring-2 ring-amber-400"
                          : "bg-zinc-50 hover:bg-zinc-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white">
                          {marker.marker_number}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-900">
                            {marker.remark || "Sans remarque"}
                          </p>
                          {marker.linked_marker_ids.length > 0 && (
                            <p className="text-xs text-zinc-500">
                              Liée à {marker.linked_marker_ids.length} pastille(s)
                            </p>
                          )}
                        </div>
                        {marker.photo_public_url && (
                          <span className="text-xs text-emerald-600">📷</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedMarker && (
            <div className="border-t border-zinc-100 px-5 py-4">
              <h3 className="mb-3 font-semibold text-zinc-900">
                Pastille n°{selectedMarker.marker_number}
              </h3>
              <textarea
                value={remarkDraft}
                onChange={(e) => setRemarkDraft(e.target.value)}
                placeholder="Saisissez votre remarque…"
                rows={3}
                disabled={visit.status === "completed"}
                className="mb-3 w-full resize-none rounded-xl border-2 border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none disabled:opacity-60"
              />

              {otherMarkers.length > 0 && visit.status !== "completed" && (
                <div className="mb-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Lier à d&apos;autres pastilles
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {otherMarkers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleLink(m.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          linkDraft.includes(m.id)
                            ? "bg-zinc-900 text-white"
                            : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        #{m.marker_number}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedMarker.photo_public_url && (
                <img
                  src={selectedMarker.photo_public_url}
                  alt="Photo pastille"
                  className="mb-3 max-h-32 rounded-xl object-cover"
                />
              )}

              {visit.status !== "completed" && (
                <div className="space-y-2">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-zinc-700">
                      Photo
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      disabled={isPending}
                      className="w-full text-sm text-zinc-600"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleSaveMarker}
                    disabled={isPending}
                    className="min-h-11 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteMarker}
                    disabled={isPending}
                    className="min-h-11 w-full rounded-xl border border-red-200 py-2.5 text-sm font-medium text-red-600"
                  >
                    Supprimer la pastille
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </aside>
    </div>
  );
}
