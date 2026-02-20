/**
 * Shared group-by and stack-by options for inventory charts (projection + by-status).
 */

export const PLANTS = ["1123", "3535", "2041", "8810"] as const

export const WAREHOUSES = ["warehouse-1", "warehouse-2", "warehouse-3", "warehouse-4"] as const

/** Data keys for warehouse segments (valid identifiers). */
export const WAREHOUSE_KEYS = ["warehouse_1K", "warehouse_2K", "warehouse_3K", "warehouse_4K"] as const

export const GROUP_BY_OPTIONS = [
  { key: "type" as const, label: "Type" },
  { key: "rotables" as const, label: "Rotables" },
  { key: "storageLocation" as const, label: "Storage location" },
  { key: "plant" as const, label: "Plant" },
  { key: "status" as const, label: "Status" },
  { key: "customField" as const, label: "Custom Field" },
] as const

export type GroupByKey = (typeof GROUP_BY_OPTIONS)[number]["key"]

/** Stack-by uses the same options as group-by. */
export const STACK_BY_OPTIONS = GROUP_BY_OPTIONS
export type StackByKey = GroupByKey

export const STATUS_OPTIONS = [
  { key: "blockedK" as const, label: "Blocked" },
  { key: "availableK" as const, label: "Available" },
  { key: "qualityInspectionK" as const, label: "Quality inspection" },
  { key: "onHandK" as const, label: "On hand" },
] as const

export const CUSTOM_FIELD_OPTIONS = [
  { key: "customField1K" as const, label: "CF 1" },
  { key: "customField2K" as const, label: "CF 2" },
  { key: "customField3K" as const, label: "CF 3" },
] as const

export type SegmentOption = { key: string; label: string }

/** Segment dataKeys and labels for each group/stack dimension. */
export function getSegmentOptions(dimension: GroupByKey): SegmentOption[] {
  switch (dimension) {
    case "type":
      return [
        { key: "rawMaterialK", label: "Raw Material" },
        { key: "wipK", label: "WIP" },
        { key: "finishedGoodsK", label: "Finished Goods" },
      ]
    case "rotables":
      return [{ key: "rotablesK", label: "Rotables" }]
    case "storageLocation":
      return WAREHOUSES.map((w, i) => ({ key: WAREHOUSE_KEYS[i], label: w }))
    case "plant":
      return PLANTS.map((p) => ({ key: `plant_${p}K`, label: p }))
    case "status":
      return STATUS_OPTIONS.map((o) => ({ key: o.key, label: o.label }))
    case "customField":
      return CUSTOM_FIELD_OPTIONS.map((o) => ({ key: o.key, label: o.label }))
    default:
      return []
  }
}
