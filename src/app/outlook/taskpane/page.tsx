import { AuthForm } from "@/components/auth/AuthForm";
import { OutlookFileSortPane } from "@/components/outlook/OutlookFileSortPane";
import { getFinanceProjects } from "@/lib/actions/incoming-files";
import { getSessionUser } from "@/lib/auth/permissions";

export default async function OutlookTaskpanePage() {
  const user = await getSessionUser();

  if (!user) {
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

  const projects = await getFinanceProjects();

  return (
    <div>
      <div className="border-b border-slate-100 bg-blue-600 px-4 py-3 text-white">
        <p className="text-sm font-bold">Chantier App</p>
        <p className="text-xs text-blue-100">Tri des pièces jointes</p>
      </div>
      <OutlookFileSortPane projects={projects} />
    </div>
  );
}
