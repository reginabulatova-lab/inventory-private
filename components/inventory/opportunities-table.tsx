"use client"

import * as React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

type Filter =
  | { kind: "type"; category: string }
  | { kind: "status"; category: string }
  | { kind: "concentration"; category: string }
  | null

type Row = {
  id: string
  supplyType: "PO" | "PR"
  event: string
  supplier: string
  status: "Confirmed" | "In Transit" | "Shipped" | "Pending"
  deliveryStatus: "On time" | "Late" | "At risk"
  partNumberAndName: string
  plant: string
  suggestedAction: string // e.g. "+ 45d"
  cashImpact: string // e.g. "350k €"
  deliveryDate: string
  price: string
  quantity: string
  processingTime: string
}

function buildMockRows(): Row[] {
  return [
    {
      id: "1",
      supplyType: "PO",
      event: "PO 786217…",
      supplier: "LunaCraft",
      status: "Confirmed",
      deliveryStatus: "On time",
      partNumberAndName: "36472918 - AeroGlide…",
      plant: "1123",
      suggestedAction: "+ 45d",
      cashImpact: "350k €",
      deliveryDate: "25/12/2024",
      price: "5416.99",
      quantity: "10",
      processingTime: "—",
    },
    {
      id: "2",
      supplyType: "PO",
      event: "PO 786217…",
      supplier: "Celestial Dynamics",
      status: "Confirmed",
      deliveryStatus: "At risk",
      partNumberAndName: "21963847 - AeroLink…",
      plant: "3535",
      suggestedAction: "+ 56d",
      cashImpact: "290k €",
      deliveryDate: "20/12/2024",
      price: "66000.38",
      quantity: "88",
      processingTime: "1",
    },
  ]
}

function StatusPill({ v }: { v: Row["status"] }) {
  const variant =
    v === "Confirmed" ? "secondary" : v === "Pending" ? "destructive" : "outline"
  return <Badge variant={variant}>{v}</Badge>
}

export function OpportunitiesTable({ filter }: { filter: Filter }) {
  const rows = React.useMemo(() => buildMockRows(), [])

  // later you’ll filter rows based on filter.kind/category; for now keep mock
  return (
    <div className="rounded-xl bg-white">
      <Table>
        <TableHeader>
          {/* GROUP HEADER ROW */}
          <TableRow className="bg-muted/30">
            <TableHead className="w-10" rowSpan={2}>
              <Checkbox />
            </TableHead>

            <TableHead colSpan={3}>Supply Event</TableHead>
            <TableHead colSpan={2}>Status</TableHead>
            <TableHead colSpan={4}>Part</TableHead>

            <TableHead rowSpan={2}>Delivery Date</TableHead>
            <TableHead rowSpan={2}>Price</TableHead>
            <TableHead rowSpan={2}>Quantity</TableHead>
            <TableHead rowSpan={2}>Processing Time</TableHead>
          </TableRow>

          {/* COLUMN HEADER ROW */}
          <TableRow className="bg-muted/30">
            <TableHead>Type</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Supplier</TableHead>

            <TableHead>Status</TableHead>
            <TableHead>Delivery Status</TableHead>

            <TableHead>…</TableHead>
            <TableHead>Part Number and Name</TableHead>
            <TableHead>Plant</TableHead>
            <TableHead>Sug. Action</TableHead>

            <TableHead>Cash impact</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Checkbox />
              </TableCell>

              <TableCell className="font-medium text-muted-foreground">{r.supplyType}</TableCell>
              <TableCell className="text-blue-600 underline underline-offset-2">{r.event}</TableCell>
              <TableCell className="text-muted-foreground">{r.supplier}</TableCell>

              <TableCell>
                <StatusPill v={r.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">{r.deliveryStatus}</TableCell>

              <TableCell className="text-muted-foreground">•</TableCell>
              <TableCell className="text-blue-600 underline underline-offset-2">
                {r.partNumberAndName}
              </TableCell>
              <TableCell className="text-muted-foreground">{r.plant}</TableCell>
              <TableCell>
                <span className="inline-flex items-center rounded-md bg-[#E6F7F8] px-2 py-1 text-sm font-semibold text-[#0F6E74]">
                  {r.suggestedAction}
                </span>
              </TableCell>

              <TableCell className="text-muted-foreground">{r.cashImpact}</TableCell>

              <TableCell className="text-muted-foreground">{r.deliveryDate}</TableCell>
              <TableCell className="text-muted-foreground">{r.price}</TableCell>
              <TableCell className="text-muted-foreground">{r.quantity}</TableCell>
              <TableCell className="text-muted-foreground">{r.processingTime}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

