import { OfflineProvider } from "@/lib/offline/offline-provider";
import { OfflineSyncBanner } from "@/components/tablette/OfflineSyncBanner";

export default function TabletteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OfflineProvider>
      <div className="tablette-shell flex min-h-full flex-col bg-zinc-100">
        <OfflineSyncBanner />
        {children}
      </div>
    </OfflineProvider>
  );
}
