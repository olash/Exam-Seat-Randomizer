import { getSupabaseClient } from "./supabaseClient";
import { SeatingAllocation } from "./randomization";

export interface SessionRecord {
  id: string;
  session_name: string;
  batch_description: string | null;
  created_at: string;
  allocation_count?: number;
}

/**
 * Save a complete seating session to Supabase.
 * Inserts session first, then batch-inserts all allocations.
 */
export async function saveSession(
  sessionName: string,
  batchDescription: string,
  allocations: SeatingAllocation[]
): Promise<{ sessionId: string }> {
  const supabase = getSupabaseClient();

  // Insert session record
  const { data: session, error: sessionError } = await supabase
    .from("seating_sessions")
    .insert({
      session_name: sessionName,
      batch_description: batchDescription,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    throw new Error(`Failed to create session: ${sessionError?.message}`);
  }

  const sessionId = session.id;

  // Batch insert allocations in chunks of 500
  const CHUNK_SIZE = 500;
  for (let i = 0; i < allocations.length; i += CHUNK_SIZE) {
    const chunk = allocations.slice(i, i + CHUNK_SIZE);
    const rows = chunk.map((a) => ({
      session_id: sessionId,
      student_name: a.studentName,
      matric_no: a.matricNo,
      course_code: a.courseCode,
      venue_name: a.venueName,
      seat_number: a.seatNumber,
    }));

    const { error: insertError } = await supabase
      .from("seating_allocations")
      .insert(rows);

    if (insertError) {
      throw new Error(`Failed to insert allocations: ${insertError.message}`);
    }
  }

  return { sessionId };
}

/**
 * List all seating sessions (most recent first).
 */
export async function listSessions(): Promise<SessionRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("seating_sessions")
    .select("id, session_name, batch_description, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list sessions: ${error.message}`);
  return data ?? [];
}

/**
 * Fetch all allocations for a specific session.
 */
export async function getSessionAllocations(sessionId: string): Promise<
  {
    student_name: string;
    matric_no: string;
    course_code: string;
    venue_name: string;
    seat_number: number;
  }[]
> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("seating_allocations")
    .select("student_name, matric_no, course_code, venue_name, seat_number")
    .eq("session_id", sessionId)
    .order("venue_name")
    .order("seat_number");

  if (error) throw new Error(`Failed to fetch allocations: ${error.message}`);
  return data ?? [];
}
