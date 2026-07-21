"use client";

import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { AuthForm } from "@/components/auth/AuthForm";
import { OutlookFileSortPane } from "@/components/outlook/OutlookFileSortPane";
import { OutlookAttestationPane } from "@/components/outlook/OutlookAttestationPane";
import {
  getFinanceProjects,
  type FinanceProjectOption,
} from "@/lib/actions/incoming-files";
import { createClient } from "@/lib/supabase/client";

type OutlookTab = "attestations" | "files";

export function OutlookTaskpaneShell() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [projects, setProjects] = useState<FinanceProjectOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<OutlookTab>("attestations");

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          setError(null);
          setUserEmail(null);
          setProjects([]);
          return;
        }

        if (!user) {
          setUserEmail(null);
          setProjects([]);
          return;
        }

        setUserEmail(user.email ?? null);
        const financeProjects = await getFinanceProjects();
        setProjects(financeProjects);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger le volet Outlook."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="p-4 text-sm text-slate-500">Chargement du volet…</div>
    );
  }

  if (!userEmail) {
    return (
      <div className="p-4">
        <h1 className="mb-1 text-lg font-bold text-slate-900">{APP_NAME}</h1>
        <p className="mb-4 text-sm text-slate-500">
          Connectez-vous pour classer les pièces jointes ou lever des NC.
        </p>
        <AuthForm redirectTo="/outlook/taskpane" />
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-slate-100 bg-blue-600 px-4 py-3 text-white">
        <p className="text-sm font-bold">{APP_NAME}</p>
        <p className="text-xs text-blue-100">{userEmail}</p>
      </div>
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab("attestations")}
          className={`flex-1 px-2 py-2 text-[11px] font-semibold ${
            tab === "attestations"
              ? "border-b-2 border-emerald-600 text-emerald-800"
              : "text-slate-500"
          }`}
        >
          Levée NC
        </button>
        <button
          type="button"
          onClick={() => setTab("files")}
          className={`flex-1 px-2 py-2 text-[11px] font-semibold ${
            tab === "files"
              ? "border-b-2 border-emerald-600 text-emerald-800"
              : "text-slate-500"
          }`}
        >
          Classer PJ
        </button>
      </div>
      {error ? (
        <p className="p-4 text-sm text-red-700">{error}</p>
      ) : tab === "attestations" ? (
        <OutlookAttestationPane projects={projects} />
      ) : (
        <OutlookFileSortPane projects={projects} />
      )}
    </div>
  );
}
