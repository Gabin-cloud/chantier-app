import { UserMenu } from "@/components/auth/UserMenu";

export default function TabletteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="tablette-shell flex min-h-full flex-col bg-zinc-100">
      {children}
    </div>
  );
}
