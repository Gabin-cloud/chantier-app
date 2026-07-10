import Link from "next/link";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { VisitEditor } from "@/components/visits/VisitEditor";
import { getPlansWithUrls } from "@/lib/actions/plans";
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
    const [{ visit, markers }, plans] = await Promise.all([
      getVisit(visiteId),
      getPlansWithUrls(id),
    ]);

    const markersWithPhotos = await Promise.all(
      markers.map(async (marker) => ({
        ...marker,
        photo_public_url: marker.photo_path
          ? await getMarkerPhotoUrl(marker.photo_path)
          : null,
      }))
    );

    return (
      <main className="min-h-full bg-zinc-100 px-4 py-4 sm:px-4">
        <div className="mx-auto w-full max-w-7xl">
          <Link
            href={`/tablette/projets/${id}/visites`}
            className="text-sm font-medium text-zinc-400 hover:text-zinc-600"
          >
            ← Visites
          </Link>
          <header className="mb-4 mt-3 rounded-2xl bg-white px-5 py-4 shadow-sm">
            <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl">
              {visit.title}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {new Date(visit.visit_date).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </header>
          <VisitEditor
            projectId={id}
            visit={visit}
            plans={plans}
            initialMarkers={markersWithPhotos}
          />
        </div>
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
