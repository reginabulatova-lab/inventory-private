import * as React from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type NavTabsProps = React.ComponentProps<typeof Tabs>

export function NavTabs({ className, ...props }: NavTabsProps) {
  return <Tabs {...props} className={cn("w-full", className)} />
}

export function NavTabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      {...props}
      className={cn(
        "relative h-16 w-full justify-start gap-8 bg-transparent p-0",
        className
      )}
    />
  )
}

export function NavTabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      {...props}
      className={cn(
        `
        relative h-16 gap-3 rounded-none bg-transparent px-3
        text-xl font-medium text-muted-foreground
        data-[state=active]:text-foreground
        data-[state=active]:font-semibold

        data-[state=active]:rounded-xl
        data-[state=active]:border
        data-[state=active]:border-border
        data-[state=active]:bg-white
        data-[state=active]:-mb-px
        `,
        className
      )}
    />
  )
}
