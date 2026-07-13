export default function EntrepriseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col bg-amber-50/40">{children}</div>
  );
}
