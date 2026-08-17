// Venue capacities — hard limits enforced by the faculty
export const VENUE_CAPACITIES: Record<string, number> = {
  "Room 1 & 2": 128,
  "Room 3": 68,
  "Room 4 & 5": 128,
  "Room 7": 69,
  "Room 8": 108,
  "Room 9": 115,
  "Room 11": 90,
  "Room 12": 90,
  "Room 13": 90,
  "Room 14": 90,
  "Tayo aderinoku Hall": 100,
};

// All known venues in display order (matches sort_order in Supabase)
export const ALL_VENUES = Object.keys(VENUE_CAPACITIES);

// Total available seats
export const TOTAL_CAPACITY = Object.values(VENUE_CAPACITIES).reduce(
  (acc, cap) => acc + cap,
  0
);

// Course → ordered list of venues (fill left-to-right until capacity)
export const COURSE_VENUE_MAP: Record<string, string[]> = {
  INS421: ["Room 3", "Room 1 & 2"],
  BUS322: ["Room 1 & 2", "Room 4 & 5"],
  ACC102: [
    "Room 11",
    "Room 13",
    "Room 1 & 2",
    "Room 14",
    "Room 4 & 5",
    "Room 12",
  ],
  FBA420: [
    "Room 11",
    "Room 3",
    "Room 13",
    "Room 1 & 2",
    "Room 14",
    "Room 4 & 5",
    "Room 9",
    "Room 7",
    "Tayo aderinoku Hall",
    "Room 8",
    "Room 12",
  ],
  EHR102: ["Room 11", "Room 12", "Room 13", "Room 14", "Room 4 & 5"],
  BUS441: ["Room 11", "Room 12", "Room 13", "Room 14"],
  BUS401: ["Room 8", "Room 9", "Room 4 & 5"],
  ACC301: ["Room 11", "Room 12", "Room 13", "Room 14"],
  INS301: ["Room 3", "Room 7"],
  MKT301: ["Room 9", "Room 8"],
  ECO301: ["Room 9", "Room 4 & 5"],
  HRM301: ["Room 12", "Room 13"],
};

// Default fallback venue order (used for unmapped courses)
export const DEFAULT_VENUE_ORDER: string[] = [
  "Room 1 & 2",
  "Room 4 & 5",
  "Room 9",
  "Room 8",
  "Room 11",
  "Room 12",
  "Room 13",
  "Room 14",
  "Room 3",
  "Room 7",
  "Tayo aderinoku Hall",
];
