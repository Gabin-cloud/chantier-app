"use client";

import { useState } from "react";

const CHECKLIST_ITEMS = [
  "Port des EPI",
  "Balisage de la zone",
  "Extincteur accessible",
  "Échafaudage conforme",
  "Zone dégagée",
] as const;

type CheckStatus = "conforme" | "non-conforme";

export function SecurityChecklist() {
  const [statuses, setStatuses] = useState<
    Record<string, CheckStatus | undefined>
  >({});
  const [remarques, setRemarques] = useState("");
  const [saved, setSaved] = useState(false);

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const allAnswered = CHECKLIST_ITEMS.every((item) => statuses[item]);

  function handleStatus(item: string, status: CheckStatus) {
    setStatuses((prev) => ({ ...prev, [item]: status }));
    setSaved(false);
  }

  function handleSave() {
    setSaved(true);
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6 rounded-2xl bg-white px-6 py-5 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wider text-zinc-400">
          Checklist terrain
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 sm:text-3xl">
          Contrôle de Sécurité Terrain
        </h1>
        <p className="mt-2 capitalize text-zinc-500">{today}</p>
      </header>

      <div className="space-y-4">
        {CHECKLIST_ITEMS.map((item) => {
          const status = statuses[item];

          return (
            <div key={item} className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-zinc-800">{item}</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleStatus(item, "conforme")}
                  className={`min-h-14 rounded-xl px-4 py-4 text-base font-semibold transition-all active:scale-[0.98] ${
                    status === "conforme"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                      : "border-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300"
                  }`}
                >
                  Conforme
                </button>
                <button
                  type="button"
                  onClick={() => handleStatus(item, "non-conforme")}
                  className={`min-h-14 rounded-xl px-4 py-4 text-base font-semibold transition-all active:scale-[0.98] ${
                    status === "non-conforme"
                      ? "bg-red-600 text-white shadow-md shadow-red-600/25"
                      : "border-2 border-red-200 bg-red-50 text-red-700 hover:border-red-300"
                  }`}
                >
                  Non conforme
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <label
          htmlFor="remarques"
          className="mb-3 block text-lg font-semibold text-zinc-800"
        >
          Remarques
        </label>
        <textarea
          id="remarques"
          value={remarques}
          onChange={(e) => {
            setRemarques(e.target.value);
            setSaved(false);
          }}
          placeholder="Saisissez vos observations ici…"
          rows={4}
          className="w-full resize-none rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!allAnswered}
        className={`mt-6 w-full min-h-16 rounded-2xl px-6 py-5 text-lg font-bold transition-all active:scale-[0.99] ${
          allAnswered
            ? "bg-zinc-900 text-white shadow-lg shadow-zinc-900/20 hover:bg-zinc-800"
            : "cursor-not-allowed bg-zinc-300 text-zinc-500"
        }`}
      >
        Enregistrer la fiche de contrôle
      </button>

      {saved && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-center text-base font-medium text-emerald-700">
          Fiche enregistrée avec succès.
        </p>
      )}
    </div>
  );
}
