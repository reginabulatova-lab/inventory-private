"use client";

import * as React from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Bell, ChevronDown, Database, Menu, Search } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function VDivider() {
  return (
    <div
      aria-hidden="true"
      className="h-4 w-px bg-gray-200 dark:bg-gray-700 self-center"
    />
  );
}

export function InventoryHeader() {
  const router = useRouter();
  const pathname = usePathname();

  const isAlternativePlan = pathname?.startsWith("/inventory/alternative-plan");

  const planTitle = isAlternativePlan ? "Alternative plan" : "ERP plan";

  const primarySwitchLabel = isAlternativePlan ? "ERP plan" : "Alternative plan";
  const primarySwitchHref = isAlternativePlan
    ? "/inventory/control-tower"
    : "/inventory/alternative-plan";

  const simulationItem = isAlternativePlan ? "Simulation 1" : "Ramp Up Optimization";

  return (
    <header className="sticky top-0 z-50 w-full h-[48px] border-b bg-background">
      <div className="flex h-full items-center justify-between px-6">
        {/* Left aligned container */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>

            {/* Keep your logo if you have it in /public/logo.svg */}
            <Image
              src="/logo.svg"
              alt="Company logo"
              width={24}
              height={24}
              className="shrink-0"
              priority
            />
          </div>

          <VDivider />

          {/* Database icon + plan title + Plans dropdown */}
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-3">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{planTitle}</span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 px-2 gap-1 text-sm">
                  Plans
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="min-w-64">
                <DropdownMenuItem onClick={() => router.push(primarySwitchHref)}>
                  {primarySwitchLabel}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  SAVED SIMULATIONS
                </DropdownMenuLabel>

                <DropdownMenuItem>{simulationItem}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Right aligned container (no segmented control, one separator removed) */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Search">
            <Search className="h-5 w-5" />
          </Button>

          <VDivider />

          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

