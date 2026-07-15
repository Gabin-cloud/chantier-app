"use client";

import { useState, useTransition } from "react";
import {
  sendPlatformInvitation,
  type InvitationContext,
} from "@/lib/actions/invitations";

type EmailFieldWithInviteProps = {
  value: string;
  onChange: (value: string) => void;
  projectId: string;
  inviteContext: InvitationContext;
  disabled?: boolean;
  inputClassName: string;
  placeholder?: string;
};

export function EmailFieldWithInvite({
  value,
  onChange,
  projectId,
  inviteContext,
  disabled,
  inputClassName,
  placeholder,
}: EmailFieldWithInviteProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleInvite() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        await sendPlatformInvitation(projectId, value, inviteContext);
        setMessage("Invitation envoyée.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur d'invitation.");
      }
    });
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="email"
          className={inputClassName}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        {value.trim().includes("@") && !disabled && (
          <button
            type="button"
            onClick={handleInvite}
            disabled={isPending}
            className="shrink-0 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {isPending ? "…" : "Envoyer invitation"}
          </button>
        )}
      </div>
      {message && <p className="mt-1 text-xs text-emerald-600">{message}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
