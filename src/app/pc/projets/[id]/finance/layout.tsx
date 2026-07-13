import type { ReactNode } from "react";
import { FinanceNavBandeau } from "@/components/finance/FinanceNavBandeau";
import { QuickFileSortFab } from "@/components/finance/QuickFileSortFab";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getProject } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type FinanceRootLayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export default async function FinanceRootLayout({
  children,
  params,
}: FinanceRootLayoutProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const project = await getProject(id);

    return (
      <div className="min-h-full bg-slate-50">
        <FinanceNavBandeau projectId={id} projectName={project.name} />
        {children}
        <QuickFileSortFab projectId={id} />
      </div>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Projet introuvable."
        }
      />
    );
  }
}
