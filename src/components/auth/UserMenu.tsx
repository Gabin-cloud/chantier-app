"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "@/lib/actions/auth";

type UserMenuProps = {
  email: string;
  fullName?: string | null;
  basePath: "pc" | "tablette";
};

export function UserMenu({ email, fullName, basePath }: UserMenuProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await signOut();
      router.refresh();
    });
  }

  const profileLinkClass =
    basePath === "pc"
      ? "text-slate-600 hover:bg-slate-100"
      : "text-emerald-700 hover:bg-emerald-50";

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-zinc-900">
          {fullName || email}
        </p>
        {fullName && <p className="truncate text-xs text-zinc-500">{email}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/${basePath}/profil`}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${profileLinkClass}`}
        >
          Profil
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isPending}
          className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
        >
          Déconnexion
        </button>
      </div>
    </div>
  );
}
