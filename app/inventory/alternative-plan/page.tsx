import { InventoryHeader } from "@/components/inventory/inventory-header"
import { InventorySubnav } from "@/components/inventory/inventory-subnav"
import { ActionBar } from "@/components/inventory/action-bar"
import { HealthRiskSection } from "@/components/inventory/health-risk-section"
import { InventoryBreakdownSection } from "@/components/inventory/inventory-breakdown-section"
import { FloatingAIChat } from "@/components/ai/floating-ai-chat"

export default function AlternativePlanPage() {
    return (
      <div className="min-h-screen bg-[#F8F9FC]">
        <InventoryHeader />
        <InventorySubnav />
  
        <div className="px-6 pb-6">
          <HealthRiskSection />
          <InventoryBreakdownSection />
        </div>
      </div>
    )
  }  