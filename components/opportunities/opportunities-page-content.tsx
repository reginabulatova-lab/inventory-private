"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  OpportunitiesTable,
  type OpportunitiesTableFilter,
} from "@/components/opportunities/opportunities-table"

const FILTER_KINDS = ["type", "status", "concentration"] as const
type FilterKind = (typeof FILTER_KINDS)[number]

export function OpportunitiesPageContent() {
  const searchParams = useSearchParams()
  const filterKind = searchParams.get("oppFilterKind")
  const filterCategory = searchParams.get("oppFilter")

  const filter = React.useMemo<OpportunitiesTableFilter | undefined>(() => {
    if (!filterKind || !filterCategory) return undefined
    if (!FILTER_KINDS.includes(filterKind as FilterKind)) return undefined
    return { kind: filterKind as FilterKind, category: filterCategory }
  }, [filterKind, filterCategory])

  return <OpportunitiesTable filter={filter} />
}
