import Script from "next/script";
import type { ReactNode } from "react";

export const metadata = {
  title: "Chantier App — Outlook",
};

export default function OutlookLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Script
        src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"
        strategy="afterInteractive"
      />
      <div className="min-h-full bg-white text-slate-900">{children}</div>
    </>
  );
}
