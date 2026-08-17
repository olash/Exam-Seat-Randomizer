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
  isOverflow: boolean; // seatNumber > VENUE_CAPACITIES[venueName]
}

/**
 * Fisher-Yates in-place shuffle
 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface VenueBucket {
  venueName: string;
  capacity: number;
  // Map: courseCode → queue of students still to seat here
  queues: Map<string, { name: string; matricNo: string }[]>;
  seatCounter: number;
}

/**
 * Build venue buckets for all courses based on their venue maps.
 * Each bucket tracks per-course student queues and a running seat counter.
 */
function buildVenueBuckets(
  shuffledCourses: Map<
    string,
    { name: string; matricNo: string; venueList: string[] }[]
  >,
  venueOverrides: Record<string, string[]>
): Map<string, VenueBucket> {
  const buckets = new Map<string, VenueBucket>();

  // Initialize buckets for every venue
  for (const [venue, cap] of Object.entries(VENUE_CAPACITIES)) {
    buckets.set(venue, {
      venueName: venue,
      capacity: cap,
      queues: new Map(),
      seatCounter: 0,
    });
  }

  return buckets;
}

/**
 * Main seating allocation engine.
 *
 * For each course:
 *   1. Shuffle students (Fisher-Yates)
 *   2. Distribute students across their venue list, filling each room sequentially
 *   3. After initial distribution, do interleaved round-robin fill within each venue
 *
 * The interleaving step ensures students of the same course don't sit consecutively.
 * Overflow: if all venues full, continue incrementing seat_number in last venue.
 */
export function generateSeating(
  parsedCourses: ParsedCourse[],
  venueOverrides: Record<string, string[]> = {}
): SeatingAllocation[] {
  // Step 1: Shuffle each course independently
  const shuffledMap = new Map<
    string,
    { name: string; matricNo: string }[]
  >();

  for (const course of parsedCourses) {
    shuffledMap.set(course.courseCode, shuffle(course.students));
  }

  // Step 2: Assign students to venue buckets per course
  // venue → { courseCode → student[] }
  const venuePools: Map<
    string,
    Map<string, { name: string; matricNo: string }[]>
  > = new Map();

  for (const [venue] of Object.entries(VENUE_CAPACITIES)) {
    venuePools.set(venue, new Map());
  }

  for (const course of parsedCourses) {
    const courseCode = course.courseCode;
    const students = [...(shuffledMap.get(courseCode) ?? [])];
    const venues =
      venueOverrides[courseCode] ??
      COURSE_VENUE_MAP[courseCode] ??
      DEFAULT_VENUE_ORDER;

    let remaining = students;

    for (let vi = 0; vi < venues.length; vi++) {
      if (remaining.length === 0) break;

      const venueName = venues[vi];
      const cap = VENUE_CAPACITIES[venueName] ?? 90;

      // Calculate how many seats are still available in this venue for all courses
      const pool = venuePools.get(venueName);
      if (!pool) continue;

      // Total already allocated to this venue
      let alreadyAllocated = 0;
      for (const [, queue] of pool) {
        alreadyAllocated += queue.length;
      }
      const available = cap - alreadyAllocated;

      if (available <= 0) {
        // Venue full, try next
        continue;
      }

      // Is this the last venue for this course?
      const isLastVenue = vi === venues.length - 1;

      if (isLastVenue) {
        // Dump all remaining (overflow allowed)
        if (!pool.has(courseCode)) pool.set(courseCode, []);
        pool.get(courseCode)!.push(...remaining);
        remaining = [];
      } else {
        const toPlace = remaining.splice(0, available);
        if (!pool.has(courseCode)) pool.set(courseCode, []);
        pool.get(courseCode)!.push(...toPlace);
      }
    }

    // If still remaining after all venues (shouldn't happen with overflow, but safety)
    if (remaining.length > 0) {
      const lastVenue = venues[venues.length - 1] ?? DEFAULT_VENUE_ORDER[0];
      const pool = venuePools.get(lastVenue);
      if (pool) {
        if (!pool.has(courseCode)) pool.set(courseCode, []);
        pool.get(courseCode)!.push(...remaining);
      }
    }
  }

  // Step 3: Interleaved round-robin fill within each venue
  const allocations: SeatingAllocation[] = [];

  for (const [venueName, courseQueues] of venuePools) {
    if (courseQueues.size === 0) continue;

    const cap = VENUE_CAPACITIES[venueName] ?? 90;

    // Build rotating queues
    const courseCodes = Array.from(courseQueues.keys());
    const queues = courseCodes.map((cc) => ({
      courseCode: cc,
      students: [...(courseQueues.get(cc) ?? [])],
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
        const isOverflow = seatNumber > cap;
        allocations.push({
          studentName: student.name,
          matricNo: student.matricNo,
          courseCode: queue.courseCode,
          venueName,
          seatNumber,
          isOverflow,
        });
      }
    }
  }

  return allocations;
}
