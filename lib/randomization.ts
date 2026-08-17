import {
  VENUE_CAPACITIES,
  COURSE_VENUE_MAP,
  DEFAULT_VENUE_ORDER,
} from "./timetableMap";
import { ParsedCourse } from "./excelParser";

export interface SeatingAllocation {
  studentName: string;
  matricNo: string;
  courseCode: string;
  venueName: string;
  seatNumber: number;
  isOverflow: boolean; // true when seatNumber > VENUE_CAPACITIES[venueName]
}

// ---------------------------------------------------------------------------
// Fisher-Yates in-place shuffle
// ---------------------------------------------------------------------------
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Main allocation engine
// ---------------------------------------------------------------------------
/**
 * Generates interleaved seating allocations for all supplied courses.
 *
 * Algorithm:
 *  1. Shuffle each course's student list independently (Fisher-Yates).
 *  2. Look up the ORDERED venue list for the course from COURSE_VENUE_MAP.
 *     venueOverrides take precedence (set via the UI for unmapped courses).
 *     If a course is genuinely absent from both, fall back to DEFAULT_VENUE_ORDER
 *     and log a warning.
 *  3. Fill each venue sequentially, respecting its remaining capacity.
 *     The LAST venue in the list absorbs any remaining students (overflow).
 *  4. Within each venue, perform a round-robin interleave across all
 *     course queues assigned to that venue — preventing same-course adjacency.
 */
export function generateSeating(
  parsedCourses: ParsedCourse[],
  venueOverrides: Record<string, string[]> = {}
): SeatingAllocation[] {

  // Step 1 — shuffle each course independently
  const shuffled = new Map<string, { name: string; matricNo: string }[]>();
  for (const course of parsedCourses) {
    shuffled.set(course.courseCode, shuffle(course.students));
  }

  // Step 2 — distribute students into per-venue course queues
  // Structure: venueName → Map<courseCode, student[]>
  const venuePools = new Map<
    string,
    Map<string, { name: string; matricNo: string }[]>
  >();

  // Pre-initialise a pool entry for every known venue
  for (const venue of Object.keys(VENUE_CAPACITIES)) {
    venuePools.set(venue, new Map());
  }

  for (const course of parsedCourses) {
    const code = course.courseCode;
    const students = [...(shuffled.get(code) ?? [])];

    // Strict venue lookup — overrides first, then COURSE_VENUE_MAP, then warn+fallback
    let venues: string[];
    if (venueOverrides[code] && venueOverrides[code].length > 0) {
      venues = venueOverrides[code];
    } else if (COURSE_VENUE_MAP[code]) {
      venues = COURSE_VENUE_MAP[code]; // <-- strict: only the defined rooms
    } else {
      console.warn(
        `[Randomization] Course "${code}" not found in COURSE_VENUE_MAP. ` +
        `Using DEFAULT_VENUE_ORDER as fallback. Add it to timetableMap.ts to fix this.`
      );
      venues = DEFAULT_VENUE_ORDER;
    }

    let remaining = [...students];

    for (let vi = 0; vi < venues.length; vi++) {
      if (remaining.length === 0) break;

      const venueName = venues[vi];
      const cap = VENUE_CAPACITIES[venueName] ?? 90;

      // Ensure a pool entry exists (handles Tayo aderinoku Hall etc.)
      if (!venuePools.has(venueName)) {
        venuePools.set(venueName, new Map());
      }

      const pool = venuePools.get(venueName)!;

      // Count how many seats are already claimed in this venue across all courses
      let alreadyClaimed = 0;
      for (const q of pool.values()) alreadyClaimed += q.length;
      const available = cap - alreadyClaimed;

      const isLastVenue = vi === venues.length - 1;

      if (isLastVenue) {
        // Last room: absorb all remaining students (overflow is allowed)
        if (!pool.has(code)) pool.set(code, []);
        pool.get(code)!.push(...remaining);
        remaining = [];
      } else if (available > 0) {
        // Take as many as will fit
        const toPlace = remaining.splice(0, available);
        if (!pool.has(code)) pool.set(code, []);
        pool.get(code)!.push(...toPlace);
      }
      // If available === 0 and not last venue, skip to next venue
    }

    // Safety: if students are still unplaced after the loop (shouldn't happen
    // with last-venue overflow, but guards against an empty venues array)
    if (remaining.length > 0) {
      const lastVenue = venues[venues.length - 1] ?? DEFAULT_VENUE_ORDER[0];
      if (!venuePools.has(lastVenue)) venuePools.set(lastVenue, new Map());
      const pool = venuePools.get(lastVenue)!;
      if (!pool.has(code)) pool.set(code, []);
      pool.get(code)!.push(...remaining);
    }
  }

  // Step 3 — interleaved round-robin fill within each venue
  const allocations: SeatingAllocation[] = [];

  for (const [venueName, courseQueues] of venuePools) {
    if (courseQueues.size === 0) continue;

    const cap = VENUE_CAPACITIES[venueName] ?? 90;

    // Build mutable queues for round-robin
    const queues = Array.from(courseQueues.entries()).map(([cc, students]) => ({
      courseCode: cc,
      students: [...students],
    }));

    let seatNumber = 0;
    let anyProgress = true;

    while (anyProgress) {
      anyProgress = false;
      for (const queue of queues) {
        if (queue.students.length === 0) continue;
        anyProgress = true;
        seatNumber++;
        const student = queue.students.shift()!;
        allocations.push({
          studentName: student.name,
          matricNo: student.matricNo,
          courseCode: queue.courseCode,
          venueName,
          seatNumber,
          isOverflow: seatNumber > cap,
        });
      }
    }
  }

  return allocations;
}
