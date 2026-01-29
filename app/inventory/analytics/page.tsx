"use client"

import { InventoryHeader } from "@/components/inventory/inventory-header"
import { InventorySubnav } from "@/components/inventory/inventory-subnav"
import { ActionBar } from "@/components/inventory/action-bar"
import { HealthRiskSection } from "@/components/inventory/health-risk-section"
import { InventoryBreakdownSection } from "@/components/inventory/inventory-breakdown-section"
import { FloatingAIChat } from "@/components/ai/floating-ai-chat"

// ✅ IMPORTANT: update this path to wherever your PartbookTable file lives
import { PartbookTable } from "@/components/inventory/partbook-table"

export default function InventoryAnalyticsPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      <InventoryHeader />
      <InventorySubnav />

      <div className="px-6 pb-6 pt-4">
        {/* ✅ This is the same table from Control Tower, with NO filters */}
        <PartbookTable filter={null} fullHeight />

        {/* Keep AI chat on this page */}
        <FloatingAIChat />

        {/* Keep your existing imports "used" without rendering the dashboard */}
        <div className="hidden">
          <ActionBar />
          <HealthRiskSection />
          <InventoryBreakdownSection />
        </div>
      </div>
    </div>
  )
}

