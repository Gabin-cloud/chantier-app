"use client";

import { useState, useTransition } from "react";
import { sendEnterpriseInvitation } from "@/lib/actions/invitations";
import { DANOBAT_DIRTY_TEXT, SAVED_TEXT, validateEmail } from "@/lib/validation/fields";

type EmailFieldWithInviteProps = {
  value: string;
  onChange: (value: string) => void;
  projectId: string;
  enterpriseId: string;
  disabled?: boolean;
  inputClassName: string;
  savedValue: string;
  placeholder?: string;
  invitationSentAt?: string | null;
  onInvitationSent?: (email: string, sentAt: string) => void;
};

function formatInvitationDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EmailFieldWithInvite({
  value,
  onChange,
  projectId,
  enterpriseId,
  disabled,
  inputClassName,
  savedValue,
  placeholder,
  invitationSentAt,
  onInvitationSent,
}: EmailFieldWithInviteProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [localSentAt, setLocalSentAt] = useState<string | null>(invitationSentAt ?? null);

  const dirtyClass =
    value.trim() !== savedValue.trim() ? DANOBAT_DIRTY_TEXT : SAVED_TEXT;

  const sentAt = localSentAt;
  const tooltip = sentAt
    ? `Invitation envoyée le ${formatInvitationDate(sentAt)}`
    : "Envoyer une invitation par e-mail depuis votre compte Microsoft 365";

  function handleInvite() {
    setMessage(null);
    setError(null);
    const vErr = validateEmail(value);
    if (vErr) {
      setValidationError(vErr);
      return;
    }
    startTransition(async () => {
      const result = await sendEnterpriseInvitation(projectId, value, enterpriseId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const now = new Date().toISOString();
      setLocalSentAt(now);
      onInvitationSent?.(value.trim().toLowerCase(), now);
      setMessage(result.message);
    });
  }

  return (
    <div>
      <div className="flex items-start gap-2">
        <div className="relative min-w-0 flex-1" title={tooltip}>
          <input
            type="email"
            className={`${inputClassName} ${dirtyClass} ${sentAt ? "pr-20" : ""}`}
            value={value}
            placeholder={placeholder}
            onChange={(e) => {
              onChange(e.target.value);
              setValidationError(validateEmail(e.target.value));
            }}
            onBlur={() => setValidationError(validateEmail(value))}
            disabled={disabled}
            title={tooltip}
          />
          {sentAt && (
            <span
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700"
              title={tooltip}
            >
              Invité
            </span>
          )}
        </div>
        {value.trim().includes("@") && !disabled && (
          <button
            type="button"
            onClick={handleInvite}
            disabled={isPending || !!validateEmail(value)}
            title={sentAt ? `Renvoyer l'invitation — ${tooltip}` : tooltip}
            className="shrink-0 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
          >
            {isPending ? "…" : sentAt ? "Renvoyer" : "Envoyer invitation"}
          </button>
        )}
      </div>
      {validationError && (
        <p className="mt-1 text-xs text-red-600">{validationError}</p>
      )}
      {message && <p className="mt-1 text-xs text-emerald-600">{message}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
