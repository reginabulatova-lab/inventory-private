import { KpiCard } from "@/components/inventory/kpi-card"
import { Box, TrendingUp, TrendingDown } from "lucide-react"

export function HealthRiskSection() {
  return (
    <section className="mt-8">
      <h2 className="text-2xl font-semibold tracking-tight">
        Health &amp; Risk
      </h2>

      <div className="mt-5 grid grid-cols-12 gap-6">
        <KpiCard
          title="Inventory"
          value="2,3 M€"
          icon={<Box className="h-4 w-4" />}
          size="s"
        />

        <KpiCard
          title="Overstock"
          value="1,2 M€"
          description="25K parts"
          tooltip="Value of stock above target levels."
          icon={<TrendingUp className="h-4 w-4" />}
          size="s"
        />

        <KpiCard
          title="Understock"
          value="0,3 M€"
          description="5K parts"
          tooltip="Value of shortages vs. target levels."
          icon={<TrendingDown className="h-4 w-4" />}
          size="s"
        />
      </div>
    </section>
  )
}

