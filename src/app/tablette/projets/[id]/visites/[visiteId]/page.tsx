import Link from "next/link";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { VisitEditor } from "@/components/visits/VisitEditor";
import { getPlanDrawings } from "@/lib/actions/drawings";
import {
  getProjectChecklistItems,
  getVisitChecklistResponses,
} from "@/lib/actions/checklist";
import { getProjectLocations } from "@/lib/actions/locations";
import { getPlanFolders, getPlansWithUrls } from "@/lib/actions/plans";
import { getProjectPhases } from "@/lib/actions/phases";
import { getProject } from "@/lib/actions/projects";
import { getMarkerPhotoUrl, getVisit } from "@/lib/actions/visits";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string; visiteId: string }>;
};

export default async function VisitePage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id, visiteId } = await params;

  try {
    const [{ visit, markers }, plans, planFolders, phases, project, allChecklistItems] =
      await Promise.all([
      getVisit(visiteId),
      getPlansWithUrls(id),
      getPlanFolders(id),
      getProjectPhases(id),
      getProject(id),
      getProjectChecklistItems(id),
    ]);

    const phaseName = phases.find((p) => p.id === visit.phase_id)?.name ?? null;
    const checklistItems = allChecklistItems.filter((item) => item.phase_id === visit.phase_id);

    const [locations, drawings, checklistResponses] = await Promise.all([
      getProjectLocations(id).catch(() => []),
      getPlanDrawings(visiteId).catch(() => []),
      getVisitChecklistResponses(visiteId).catch(() => []),
    ]);

    const markersWithPhotos = await Promise.all(
      markers.map(async (marker) => ({
        ...marker,
        photo_public_url: marker.photo_path
          ? await getMarkerPhotoUrl(marker.photo_path)
          : null,
      }))
    );

    const visitDate = new Date(visit.visit_date).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return (
      <main className="tablette-page flex min-h-0 flex-col bg-zinc-100">
        <header className="flex shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3 py-2.5 sm:px-4">
          <Link
            href={`/tablette/projets/${id}/visites`}
            className="shrink-0 rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
          >
            ← Visites
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-zinc-900 sm:text-lg">
              {visit.title}
            </h1>
            <p className="truncate text-xs text-zinc-500 sm:text-sm">
              {visitDate}
              {phaseName ? ` · ${phaseName}` : ""}
            </p>
          </div>
        </header>

        <VisitEditor
          projectId={id}
          visit={visit}
          phaseName={phaseName}
          plans={plans}
          planFolders={planFolders}
          checklistItems={checklistItems}
          checklistResponses={checklistResponses}
          enterprises={project.enterprises}
          locations={locations}
          initialMarkers={markersWithPhotos}
          initialDrawings={drawings}
        />
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Visite introuvable."
        }
      />
    );
  }
}
