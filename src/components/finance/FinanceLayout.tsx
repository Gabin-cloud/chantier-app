import type { ReactNode } from "react";

type FinanceLayoutProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
};

export function FinanceLayout({
  title,
  subtitle,
  children,
  wide = true,
}: FinanceLayoutProps) {
  return (
    <div
      className={`mx-auto w-full px-4 py-6 sm:px-8 sm:py-8 ${wide ? "max-w-[96rem]" : "max-w-5xl"}`}
    >
      {(title || subtitle) && (
        <header className="mb-6">
          {title && (
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              {title}
            </h1>
          )}
          {subtitle && <p className="mt-1 text-slate-500">{subtitle}</p>}
        </header>
      )}
      {children}
    </div>
  );
}
