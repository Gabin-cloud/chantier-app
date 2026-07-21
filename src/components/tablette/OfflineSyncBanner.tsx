"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useOfflineSync } from "@/lib/offline/offline-provider";
import { processOfflineQueueItem } from "@/lib/offline/process-queue";

export function OfflineSyncBanner() {
  const router = useRouter();
  const { pendingCount, isOnline, isSyncing, flushQueue } = useOfflineSync();

  const syncNow = useCallback(async () => {
    await flushQueue(processOfflineQueueItem);
    router.refresh();
  }, [flushQueue, router]);

  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      void syncNow();
    }
  }, [isOnline, pendingCount, isSyncing, syncNow]);

  if (pendingCount === 0 && isOnline) return null;

  return (
    <div
      className={`flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2 text-sm ${
        pendingCount > 0
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-zinc-200 bg-zinc-50 text-zinc-700"
      }`}
      role="status"
    >
      <div className="min-w-0">
        {pendingCount > 0 ? (
          <>
            <p className="font-semibold">Synchronisation en attente</p>
            <p className="text-xs opacity-90">
              {pendingCount} modification{pendingCount > 1 ? "s" : ""} locale
              {pendingCount > 1 ? "s" : ""}
              {!isOnline ? " — hors connexion" : ""}
            </p>
          </>
        ) : (
          <p className="font-medium">Hors connexion — les modifications sont enregistrées localement</p>
        )}
      </div>
      {pendingCount > 0 && (
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={!isOnline || isSyncing}
          className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
        >
          {isSyncing ? "Sync…" : "Forcer la sync"}
        </button>
      )}
    </div>
  );
}
