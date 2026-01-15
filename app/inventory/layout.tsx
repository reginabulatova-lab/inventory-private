import type { ReactNode } from "react"
import { InventoryDataProvider } from "@/components/inventory/inventory-data-provider"

export default function InventoryLayout({ children }: { children: ReactNode }) {
  return <InventoryDataProvider>{children}</InventoryDataProvider>
}

