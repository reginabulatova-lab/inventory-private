export const TOP_10_PROGRAMS = [
    "Airbus A350",
    "Boeing 787",
    "Boeing 737",
    "ATR 72",
    "Rafale Marine",
    "Other",
  ] as const
  
  export const STOCK_STATUS_CATEGORIES = [
    "Quality Inspection",
    "At Vendor",
    "Excluded",
    "Blocked",
  ] as const
  
  export const WIP_CATEGORIES = [
    "Blocked",
    "Conditionally covered",
    "Covered",
  ] as const
  
  // Programs that are NOT in the Top 10 list (used for "Other" bucket)
  export const OTHER_PROGRAMS = [
    "Embraer E2",
    "A320 Family",
    "A220",
    "Falcon",
    "NH90",
  ] as const
  