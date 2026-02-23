import { Suspense } from "react"
import { InventoryHeader } from "@/components/inventory/inventory-header"
import { InventorySubnav } from "@/components/inventory/inventory-subnav"
import { HealthRiskSection } from "@/components/inventory/health-risk-section"

function ControlTowerContent() {
  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      <InventoryHeader />
      <InventorySubnav />
      <div className="px-6 pb-6">
        <HealthRiskSection />
      </div>
    </div>
  )
}

export default function InventoryControlTowerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8F9FC]" />}>
      <ControlTowerContent />
    </Suspense>
  )
}  
