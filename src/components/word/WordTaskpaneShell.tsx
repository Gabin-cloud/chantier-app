"use client";

import { useEffect, useState } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { WordLabelsPane } from "@/components/word/WordLabelsPane";
import { getWordAddinBootstrap } from "@/lib/actions/word-addin";
import type { DocumentLabelDefinition } from "@/lib/documents/document-labels";
import type { FinanceProjectOption } from "@/lib/actions/incoming-files";
import { createClient } from "@/lib/supabase/client";

export function WordTaskpaneShell() {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [projects, setProjects] = useState<FinanceProjectOption[]>([]);
  const [labels, setLabels] = useState<DocumentLabelDefinition[]>([]);
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
          setLabels([]);
          return;
        }

        if (!user) {
          setUserEmail(null);
          setProjects([]);
          setLabels([]);
          return;
        }

        setUserEmail(user.email ?? null);
        const bootstrap = await getWordAddinBootstrap();
        setProjects(bootstrap.projects);
        setLabels(bootstrap.labels);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Impossible de charger le volet Word."
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <div className="p-4 text-sm text-slate-500">Chargement du volet…</div>;
  }

  if (!userEmail) {
    return (
      <div className="p-4">
        <h1 className="mb-1 text-lg font-bold text-slate-900">Chantier App</h1>
        <p className="mb-4 text-sm text-slate-500">
          Connectez-vous pour insérer et remplir les étiquettes dans votre document Word.
        </p>
        <AuthForm redirectTo="/word/taskpane" />
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-slate-100 bg-blue-600 px-4 py-3 text-white">
        <p className="text-sm font-bold">Chantier App</p>
        <p className="text-xs text-blue-100">
          Étiquettes documents · {userEmail}
        </p>
      </div>
      {error ? (
        <p className="p-4 text-sm text-red-700">{error}</p>
      ) : (
        <WordLabelsPane projects={projects} labels={labels} />
      )}
    </div>
  );
}
