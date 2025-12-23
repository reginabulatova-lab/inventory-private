"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Menu, Search, Plus, BarChart2, Clipboard } from "lucide-react";
import Image from "next/image";

export function InventoryHeader() {
  // ERP / Production segmented control
  const [planMode, setPlanMode] = React.useState<"erp" | "production">("erp");

  return (
    <header className="w-full border-b bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left aligned container */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>

          <div
            aria-hidden="true"
            className="h-4 w-px bg-gray-200 dark:bg-gray-700"
          />

          {/* Logo */}
          <Image
            src="/logo.svg"
            alt="Company logo"
            width={24}
            height={24}
            className="ml-1"
          />

          <h1 className="text-lg font-semibold leading-none">Inventory</h1>

          {/* Scope button with plus icon */}
          <Button variant="outline" className="h-7 gap-2">
            <Plus className="h-4 w-4" />
            Scope
          </Button>
        </div>

        {/* Right aligned container */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Search">
            <Search className="h-5 w-5" />
          </Button>

          <div
            aria-hidden="true"
            className="h-4 w-px bg-muted-foreground/20"
          />

          {/* ERP / Production segmented control */}
          <Tabs
            value={planMode}
            onValueChange={(v) => setPlanMode(v as "erp" | "production")}
          >
            <TabsList className="h-9">
              <TabsTrigger value="erp">ERP Plan</TabsTrigger>
              <TabsTrigger value="production">Production Plan</TabsTrigger>
            </TabsList>
          </Tabs>

          <div
            aria-hidden="true"
            className="h-4 w-px bg-muted-foreground/20"
          />

          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Nav tabs – Control Tower / Analytics */}
      <div className="px-4">
        <Tabs value="control-tower">
                <TabsList
                  className="
                  relative h-12 w-full
                  !inline-flex !items-end !justify-start !gap-4
                  !bg-transparent !p-0 !grid-cols-none !grid !flex
                  "
                >

            {/* full-width bottom divider */}
            <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-border" />

            <TabsTrigger
              value="control-tower"
              className="
                group
                !flex-none !w-auto !grow-0
                relative h-12 gap-2 px-2
                !rounded-none !bg-transparent !shadow-none
                text-base font-medium text-muted-foreground
                data-[state=active]:text-foreground data-[state=active]:font-semibold
              "
            >
              <BarChart2 className="h-6 w-6" />
              Control Tower

              {/* underline (shows only when trigger is active) */}
              <span className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 opacity-0 group-data-[state=active]:opacity-100" />
            </TabsTrigger>

            <TabsTrigger
              value="analytics"
              className="
                group
                !flex-none !w-auto !grow-0
                relative h-12 gap-2 px-2
                !rounded-none !bg-transparent !shadow-none
                text-base font-medium text-muted-foreground
                data-[state=active]:text-foreground data-[state=active]:font-semibold
              "
            >
              <Clipboard className="h-6 w-6" />
              Analytics

              <span className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 opacity-0 group-data-[state=active]:opacity-100" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

    </header>
  );
}

