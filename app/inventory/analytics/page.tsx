"use client"

import { Suspense } from "react"
import { InventoryHeader } from "@/components/inventory/inventory-header"
import { InventorySubnav } from "@/components/inventory/inventory-subnav"
import { ActionBar } from "@/components/inventory/action-bar"
import { HealthRiskSection } from "@/components/inventory/health-risk-section"
import { InventoryBreakdownSection } from "@/components/inventory/inventory-breakdown-section"
import { FloatingAIChat } from "@/components/ai/floating-ai-chat"
import { PartbookTable } from "@/components/inventory/partbook-table"

function AnalyticsContent() {
  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      <InventoryHeader />
      <InventorySubnav />

      <div className="px-6 pb-6 pt-4">
        <PartbookTable filter={null} fullHeight />
        <FloatingAIChat />
        <div className="hidden">
          <ActionBar />
          <HealthRiskSection />
          <InventoryBreakdownSection />
        </div>
      </div>
    </div>
  )
}

export default function InventoryAnalyticsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8F9FC]" />}>
      <AnalyticsContent />
    </Suspense>
  )
}

