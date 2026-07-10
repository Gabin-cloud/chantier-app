import type { ReactNode } from "react";

export const financeInputClass =
  "w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-800 focus:border-slate-400 focus:bg-white focus:outline-none";

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
};

export function FormField({
  label,
  htmlFor,
  hint,
  children,
  className = "",
}: FormFieldProps) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-semibold text-slate-700"
      >
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
