"use client";

import { useEffect, useState } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { OutlookFileSortPane } from "@/components/outlook/OutlookFileSortPane";
import {
  getFinanceProjects,
  type FinanceProjectOption,
} from "@/lib/actions/incoming-files";
import { createClient } from "@/lib/supabase/client";

export function OutlookTaskpaneShell() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [projects, setProjects] = useState<FinanceProjectOption[]>([]);
  const [error, setError] = useState<string | null>(null);

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
        <h1 className="mb-1 text-lg font-bold text-slate-900">Chantier App</h1>
        <p className="mb-4 text-sm text-slate-500">
          Connectez-vous pour classer les pièces jointes du mail ouvert.
        </p>
        <AuthForm redirectTo="/outlook/taskpane" />
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-slate-100 bg-blue-600 px-4 py-3 text-white">
        <p className="text-sm font-bold">Chantier App</p>
        <p className="text-xs text-blue-100">
          Tri des pièces jointes · {userEmail}
        </p>
      </div>
      {error ? (
        <p className="p-4 text-sm text-red-700">{error}</p>
      ) : (
        <OutlookFileSortPane projects={projects} />
      )}
    </div>
  );
}
