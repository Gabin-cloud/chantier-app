import type { ReactNode } from "react";
import { AppField, type AppFieldProps } from "@/components/ui/AppField";

type AppFormFieldProps = Omit<AppFieldProps, "label" | "className"> & {
  label?: string;
  hint?: string;
  children?: ReactNode;
  className?: string;
  inputClassName?: string;
};

export function AppFormField({
  label,
  hint,
  children,
  className,
  inputClassName,
  ...fieldProps
}: AppFormFieldProps) {
  if (children) {
    return (
      <div className={className}>
        {label && (
          <label
            htmlFor={fieldProps.id}
            className="mb-1.5 block text-sm font-semibold text-slate-700"
          >
            {label}
          </label>
        )}
        {children}
        {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      </div>
    );
  }

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={fieldProps.id}
          className="mb-1.5 block text-sm font-semibold text-slate-700"
        >
          {label}
          {fieldProps.required ? " *" : ""}
        </label>
      )}
      <AppField {...fieldProps} inputClassName={inputClassName} />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
