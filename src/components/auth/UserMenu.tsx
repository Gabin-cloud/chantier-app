"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "@/lib/actions/auth";

type UserMenuProps = {
  email: string;
  fullName?: string | null;
};

export function UserMenu({ email, fullName }: UserMenuProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await signOut();
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-zinc-900">
          {fullName || email}
        </p>
        {fullName && <p className="truncate text-xs text-zinc-500">{email}</p>}
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isPending}
        className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
      >
        Déconnexion
      </button>
    </div>
  );
}
