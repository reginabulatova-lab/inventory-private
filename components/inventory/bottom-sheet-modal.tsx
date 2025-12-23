"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type BottomSheetModalProps = {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children?: React.ReactNode
}

export function BottomSheetModal({
  open,
  title,
  subtitle,
  onClose,
  children,
}: BottomSheetModalProps) {
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/20" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50",
          "rounded-t-2xl border-t border-border bg-white shadow-2xl"
        )}
      >
        <div className="w-full px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-base font-semibold text-foreground">{title}</div>
              {subtitle ? (
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {subtitle}
                </div>
              ) : null}
            </div>

            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="mt-4 rounded-xl bg-background p-0">
            {children ?? <div className="min-h-[180px]" />}
          </div>

          <div className="h-4" />
        </div>
      </div>
    </>
  )
}
