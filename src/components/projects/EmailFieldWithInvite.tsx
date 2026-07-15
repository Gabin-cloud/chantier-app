"use client";

import { useState, useTransition } from "react";
import { sendEnterpriseInvitation } from "@/lib/actions/invitations";
import { validateEmail } from "@/lib/validation/fields";

type EmailFieldWithInviteProps = {
  value: string;
  onChange: (value: string) => void;
  projectId: string;
  enterpriseId: string;
  disabled?: boolean;
  inputClassName: string;
  savedValue: string;
  placeholder?: string;
};

export function EmailFieldWithInvite({
  value,
  onChange,
  projectId,
  enterpriseId,
  disabled,
  inputClassName,
  savedValue,
  placeholder,
}: EmailFieldWithInviteProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const dirtyClass =
    value.trim() !== savedValue.trim()
      ? "text-[#1a4b8c]"
      : "text-slate-900";

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
      setMessage(result.message);
    });
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="email"
          className={`${inputClassName} ${dirtyClass}`}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setValidationError(validateEmail(e.target.value));
          }}
          onBlur={() => setValidationError(validateEmail(value))}
          disabled={disabled}
        />
        {value.trim().includes("@") && !disabled && (
          <button
            type="button"
            onClick={handleInvite}
            disabled={isPending || !!validateEmail(value)}
            className="shrink-0 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {isPending ? "…" : "Envoyer invitation"}
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
