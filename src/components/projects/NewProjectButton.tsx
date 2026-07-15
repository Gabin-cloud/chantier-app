"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createQuickProject } from "@/lib/actions/projects";

type NewProjectButtonProps = {
  basePath: "tablette" | "pc";
  className?: string;
  children: React.ReactNode;
};

export function NewProjectButton({
  basePath,
  className,
  children,
}: NewProjectButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      try {
        const projectId = await createQuickProject();
        router.push(`/${basePath}/projets/${projectId}/parametres`);
        router.refresh();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Impossible de créer le projet."
        );
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleCreate}
        disabled={isPending}
        className={className}
      >
        {isPending ? "Création…" : children}
      </button>
      {error && (
        <p className="max-w-xs rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
