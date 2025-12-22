"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Menu, Search } from "lucide-react";

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

          <Separator orientation="vertical" className="h-6" />

          <h1 className="text-lg font-semibold leading-none">Inventory</h1>

          <Separator orientation="vertical" className="h-6" />

          {/* Scope button */}
          <Button variant="outline" className="h-9">
            Scope
          </Button>
        </div>

        {/* Right aligned container */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Search">
            <Search className="h-5 w-5" />
          </Button>

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

          <Separator orientation="vertical" className="h-6" />

          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Action bar – Control Tower only (for now) */}
      <div className="px-4 pb-3">
        <Tabs value="control-tower">
          <TabsList>
            <TabsTrigger value="control-tower">
              Control Tower
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </header>
  );
}

