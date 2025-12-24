import { InventoryHeader } from "@/components/inventory/inventory-header"
import { InventorySubnav } from "@/components/inventory/inventory-subnav"
import { OpportunitiesTable } from "@/components/opportunities/opportunities-table"
import { FloatingAIChat } from "@/components/ai/floating-ai-chat"

export default function OpportunitiesPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      {/* keep your existing header */}
      <InventoryHeader />
      <InventorySubnav />
      {/* “somewhere below the title” — if InventoryHeader already contains a title,
         this section sits just beneath it */}
      <div className="px-6 pt-4 pb-6">

        <OpportunitiesTable />
      </div>

      <FloatingAIChat />
    </div>
  )
}