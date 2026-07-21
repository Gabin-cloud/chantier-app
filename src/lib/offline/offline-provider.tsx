"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  enqueueOfflineItem,
  isNetworkError,
  listOfflineQueue,
  removeOfflineItem,
  type OfflineQueueItem,
} from "@/lib/offline/sync-store";

type OfflineContextValue = {
  pendingCount: number;
  isOnline: boolean;
  isSyncing: boolean;
  runWithOfflineQueue: <T>(
    label: string,
    action: string,
    payload: unknown,
    fn: () => Promise<T>
  ) => Promise<T>;
  flushQueue: (processor: (item: OfflineQueueItem) => Promise<void>) => Promise<void>;
  refreshPending: () => Promise<void>;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshPending = useCallback(async () => {
    const items = await listOfflineQueue();
    setPendingCount(items.length);
  }, []);

  useEffect(() => {
    void refreshPending();
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [refreshPending]);

  const runWithOfflineQueue = useCallback(
    async <T,>(
      label: string,
      action: string,
      payload: unknown,
      fn: () => Promise<T>
    ): Promise<T> => {
      try {
        const result = await fn();
        return result;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        await enqueueOfflineItem({ label, action, payload });
        await refreshPending();
        throw new Error(
          `${label} enregistré localement — synchronisation à la reconnexion.`
        );
      }
    },
    [refreshPending]
  );

  const flushQueue = useCallback(
    async (processor: (item: OfflineQueueItem) => Promise<void>) => {
      if (isSyncing) return;
      setIsSyncing(true);
      try {
        const items = await listOfflineQueue();
        for (const item of items) {
          try {
            await processor(item);
            await removeOfflineItem(item.id);
          } catch {
            break;
          }
        }
      } finally {
        setIsSyncing(false);
        await refreshPending();
      }
    },
    [isSyncing, refreshPending]
  );

  const value = useMemo(
    () => ({
      pendingCount,
      isOnline,
      isSyncing,
      runWithOfflineQueue,
      flushQueue,
      refreshPending,
    }),
    [pendingCount, isOnline, isSyncing, runWithOfflineQueue, flushQueue, refreshPending]
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOfflineSync() {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error("useOfflineSync must be used within OfflineProvider");
  }
  return ctx;
}

export function useOfflineSyncOptional() {
  return useContext(OfflineContext);
}
