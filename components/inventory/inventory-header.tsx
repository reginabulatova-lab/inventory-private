"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Bell, ChevronDown, Database, Menu, Search } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useInventoryData, type InventoryUserId } from "@/components/inventory/inventory-data-provider";

const USERS = [
  { id: "leader", label: "Inventory Leader" },
  { id: "manager", label: "Inventory Manager" },
  { id: "supplyOfficer", label: "Supply Officer" },
] as const;

function VDivider() {
  return (
    <div
      aria-hidden="true"
      className="h-4 w-px bg-gray-200 dark:bg-gray-700 self-center"
    />
  );
}

function getInitials(userId: InventoryUserId) {
  if (userId === "leader") return "IL";
  if (userId === "manager") return "IM";
  if (userId === "supplyOfficer") return "SO";
  return "IL";
}

export function InventoryHeader() {
  const router = useRouter();
  const planTitle = "ERP plan";
  const { currentUser, setCurrentUser } = useInventoryData();

  return (
    <header className="sticky top-0 z-50 w-full h-[48px] border-b bg-background">
      <div className="flex h-full items-center justify-between px-6">
        {/* Left aligned container */}
        <div className="flex items-center gap-5">
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

          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">Inventory</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild id="inventory-plan-menu-trigger">
                <Button
                  variant="ghost"
                  id="inventory-plan-menu-trigger"
                  className="h-8 px-2 gap-2 text-sm font-medium"
                >
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span>{planTitle}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="min-w-64">
                <DropdownMenuLabel className="text-xs text-muted-foreground">PLANS</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => router.push("/inventory/control-tower")}>
                  ERP plan
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

        </div>

        {/* Right aligned container */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Search">
            <Search className="h-5 w-5" />
          </Button>

          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </Button>

          <VDivider />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-700 ring-1 ring-teal-200 transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                aria-label="Current user"
              >
                <span className="text-xs font-semibold">{getInitials(currentUser)}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Switch user
              </DropdownMenuLabel>
              {USERS.map((user) => (
                <DropdownMenuItem
                  key={user.id}
                  onClick={() => setCurrentUser(user.id)}
                  className={cn(
                    "gap-2",
                    currentUser === user.id && "bg-accent font-medium"
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
                    {getInitials(user.id)}
                  </span>
                  {user.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

