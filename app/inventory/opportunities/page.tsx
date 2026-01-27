import { InventoryHeader } from "@/components/inventory/inventory-header"
import { InventorySubnav } from "@/components/inventory/inventory-subnav"
import { OpportunitiesPageContent } from "@/components/opportunities/opportunities-page-content"
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

        <OpportunitiesPageContent />
      </div>

      <FloatingAIChat />
    </div>
  )
}