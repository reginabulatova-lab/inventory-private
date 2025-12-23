import { InventoryHeader } from "@/components/inventory/inventory-header"
import { ActionBar } from "@/components/inventory/action-bar"
import { HealthRiskSection } from "@/components/inventory/health-risk-section"
import { InventoryBreakdownSection } from "@/components/inventory/inventory-breakdown-section"

export default function InventoryControlTowerPage() {
    return (
      <div className="min-h-screen bg-[#F8F9FC]">
        <InventoryHeader />
  
        <div className="mt-4 px-6">
          <ActionBar />
        </div>
  
        <div className="px-6 pb-6">
          <HealthRiskSection />
          <InventoryBreakdownSection />
        </div>
      </div>
    )
  }  
