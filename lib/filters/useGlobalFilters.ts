"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  type GlobalFilterDefaults,
  type GlobalFilterState,
  dateOffset,
  readGlobalFilters,
  writeGlobalFilters,
} from "@/lib/filters/serialize";

function getDefaultFilters(defaults: GlobalFilterDefaults): GlobalFilterState {
  return {
    warehouse: defaults.warehouse,
    from: dateOffset(defaults.fromOffsetDays),
    to: dateOffset(defaults.toOffsetDays ?? 0),
  };
}

export function useGlobalFilters(defaults: GlobalFilterDefaults, preserveKeys: string[] = []) {
  const pathname = usePathname();
  const router = useRouter();

  const initial = (() => {
    if (typeof window === "undefined") return getDefaultFilters(defaults);
    return readGlobalFilters(new URLSearchParams(window.location.search), defaults);
  })();

  const [filters, setFilters] = useState<GlobalFilterState>(initial);
  const [appliedFilters, setAppliedFilters] = useState<GlobalFilterState>(initial);

  const applyFilters = (nextFilters = filters) => {
    setAppliedFilters(nextFilters);
    const current = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
    const nextParams = writeGlobalFilters(current, nextFilters, preserveKeys);
    router.replace(`${pathname}?${nextParams.toString()}`);
  };

  return { filters, setFilters, appliedFilters, applyFilters };
}
