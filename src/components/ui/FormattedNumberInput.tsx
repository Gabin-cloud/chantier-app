"use client";

import { useEffect, useId, useState } from "react";
import { AppField, type AppFieldProps } from "@/components/ui/AppField";

/** @deprecated Préférer AppField avec format="number" | "money" | "percent". */
export function FormattedNumberInput(props: AppFieldProps) {
  const { format = "number", ...rest } = props;
  return <AppField format={format} {...rest} />;
}
