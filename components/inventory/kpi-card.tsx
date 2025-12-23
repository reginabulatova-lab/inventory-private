import * as React from "react"
import { cn } from "@/lib/utils"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

type KpiSize = "s" | "m" | "l"

type KpiCardProps = {
    title: string
    value: string
    description?: string
    tooltip?: string
    icon?: React.ReactNode
    size?: KpiSize
}

export function KpiCard({
    title,
    value,
    description,
    tooltip,
    icon,
    size = "s",
}: KpiCardProps) {
    return (
        <div
            className={cn(
                "rounded-xl border border-border bg-white p-5 shadow-sm",
                size === "s" && "col-span-3",
                size === "m" && "col-span-6",
                size === "l" && "col-span-12"
            )}
        >
            <div className="flex items-center gap-2">
                {icon ? <div className="text-muted-foreground">{icon}</div> : null}

                <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold">{title}</div>
                    {tooltip ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-muted-foreground hover:bg-accent"
                                    >
                                        i
                                    </button>
                                </TooltipTrigger>

                                <TooltipContent side="top">
                                    <p>{tooltip}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : null}
                </div>
            </div>

            <div className="mt-3 text-4xl font-medium tracking-tight">
                {value}
            </div>

            {description ? (
                <div className="mt-1 text-sm text-muted-foreground">
                    {description}
                </div>
            ) : null}
        </div>
    )
}

