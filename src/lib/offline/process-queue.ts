import type { OfflineQueueItem } from "@/lib/offline/sync-store";
import {
  completeVisit,
  createMarker,
  deleteMarker,
  updateMarker,
  uploadMarkerPhoto,
  uploadMarkerPhotoAndResolve,
} from "@/lib/actions/visits";
import { savePlanDrawings } from "@/lib/actions/checklist";

type QueuePayload = Record<string, unknown>;

export async function processOfflineQueueItem(item: OfflineQueueItem): Promise<void> {
  const payload = item.payload as QueuePayload;

  switch (item.action) {
    case "updateMarker": {
      const { visitId, projectId, markerId, data } = payload as {
        visitId: string;
        projectId: string;
        markerId: string;
        data: Parameters<typeof updateMarker>[3];
      };
      await updateMarker(visitId, projectId, markerId, data);
      break;
    }
    case "createMarker": {
      const { visitId, projectId, planId, x, y, initial } = payload as {
        visitId: string;
        projectId: string;
        planId: string;
        x: number;
        y: number;
        initial?: Parameters<typeof createMarker>[5];
      };
      await createMarker(visitId, projectId, planId, x, y, initial);
      break;
    }
    case "deleteMarker": {
      const { visitId, projectId, markerId } = payload as {
        visitId: string;
        projectId: string;
        markerId: string;
      };
      await deleteMarker(visitId, projectId, markerId);
      break;
    }
    case "savePlanDrawings": {
      const { visitId, projectId, planId, strokes } = payload as {
        visitId: string;
        projectId: string;
        planId: string;
        strokes: Parameters<typeof savePlanDrawings>[3];
      };
      await savePlanDrawings(visitId, projectId, planId, strokes);
      break;
    }
    case "completeVisit": {
      const { projectId, visitId } = payload as { projectId: string; visitId: string };
      await completeVisit(projectId, visitId);
      break;
    }
    case "uploadMarkerPhoto": {
      const { visitId, projectId, markerId, formDataEntries } = payload as {
        visitId: string;
        projectId: string;
        markerId: string;
        formDataEntries: { name: string; blob: Blob; fileName: string }[];
      };
      const formData = new FormData();
      for (const entry of formDataEntries) {
        formData.append(entry.name, entry.blob, entry.fileName);
      }
      await uploadMarkerPhoto(visitId, projectId, markerId, formData);
      break;
    }
    case "uploadMarkerPhotoAndResolve": {
      const { visitId, projectId, markerId, formDataEntries } = payload as {
        visitId: string;
        projectId: string;
        markerId: string;
        formDataEntries: { name: string; blob: Blob; fileName: string }[];
      };
      const formData = new FormData();
      for (const entry of formDataEntries) {
        formData.append(entry.name, entry.blob, entry.fileName);
      }
      await uploadMarkerPhotoAndResolve(visitId, projectId, markerId, formData);
      break;
    }
    default:
      throw new Error(`Action offline inconnue : ${item.action}`);
  }
}

export async function blobToOfflineEntries(
  formData: FormData
): Promise<{ name: string; blob: Blob; fileName: string }[]> {
  const entries: { name: string; blob: Blob; fileName: string }[] = [];
  for (const [name, value] of formData.entries()) {
    if (value instanceof File) {
      entries.push({ name, blob: value, fileName: value.name });
    } else if (value instanceof Blob) {
      entries.push({ name, blob: value, fileName: "photo.jpg" });
    }
  }
  return entries;
}
