"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavTabItem = { href: string; label: string };

type Variant = "primary" | "secondary" | "tertiary";

const VARIANTS: Record<
  Variant,
  { wrap: string; base: string; active: string; idle: string }
> = {
  primary: {
    wrap: "flex flex-wrap items-center gap-1",
    base: "-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
    active: "border-slate-900 text-slate-900",
    idle: "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
  },
  secondary: {
    wrap: "flex flex-wrap items-center gap-1",
    base: "-mb-px border-b-2 px-2.5 py-1.5 text-[13px] font-medium transition-colors",
    active: "border-blue-600 text-blue-700",
    idle: "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
  },
  tertiary: {
    wrap: "flex flex-wrap items-center gap-1",
    base: "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
    active: "bg-slate-800 text-white",
    idle: "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900",
  },
};

export function NavTabs({
  items,
  variant = "primary",
}: {
  items: NavTabItem[];
  variant?: Variant;
}) {
  const pathname = usePathname();
  const style = VARIANTS[variant];

  return (
    <nav className={style.wrap}>
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${style.base} ${active ? style.active : style.idle}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
