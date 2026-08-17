import * as XLSX from "xlsx";

/**
 * Extracts the canonical base course code from a raw string.
 *
 * Handles:
 *  - Plain codes:       "EHR102-UG"     → "EHR102"
 *  - Hyphenated codes:  "LAG-BUA122-PG" → "LAG-BUA122"
 *  - Spaced variants:   " ACC 102 "     → "ACC102"
 *  - Filename noise:    "EHR102-UG.xlsx"→ "EHR102"  (strip .xlsx before calling)
 *
 * Strategy:
 *  1. Strip all whitespace and uppercase.
 *  2. Try hyphenated prefix pattern first: e.g. LAG-TAX124, ACC-CM202
 *  3. Fall back to plain 3-4 letter + 3 digit pattern: e.g. EHR102
 *  4. If nothing matches, return the cleaned string as-is (max 15 chars).
 */
function extractBaseCourseCode(raw: string): string {
  // Step 1 — strip spaces, uppercase
  const clean = raw.replace(/\s+/g, "").toUpperCase();

  // Step 2 — try hyphenated pattern first (e.g. LAG-BUA122, ACC-CM202, FIN-CM216)
  const hyphenMatch = clean.match(/^([A-Z]{2,4}-[A-Z]{2,4}\d{3})/);
  if (hyphenMatch) return hyphenMatch[1];

  // Step 3 — plain base code: 3–4 uppercase letters followed by exactly 3 digits
  const plainMatch = clean.match(/[A-Z]{3,4}\d{3}/);
  if (plainMatch) return plainMatch[0];

  // Step 4 — no recognisable pattern; return cleaned string (trimmed to 15 chars)
  return clean.slice(0, 15);
}

export interface ParsedStudent {
  name: string;
  matricNo: string;
  /** Sheet name the student came from — used for class-isolated shuffling */
  class_group: string;
}

export interface ParsedCourse {
  courseCode: string;
  students: ParsedStudent[];
  fileName: string;
  rawStudentCount: number;
}


/**
 * Scans one sheet for the course code (first 15 rows) and then extracts
 * all student rows. Returns the course code found (or null) and the
 * student records tagged with the sheet name as their class_group.
 */
function extractStudentsFromSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  fileNameFallback: string
): { courseCode: string | null; students: ParsedStudent[] } {
  const raw: (string | number | null | undefined)[][] =
    XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (raw.length === 0) return { courseCode: null, students: [] };

  // --- Course code extraction (first 15 rows) ---
  let courseCode: string | null = null;
  const scanRows = Math.min(15, raw.length);

  for (let r = 0; r < scanRows; r++) {
    const row = raw[r];
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "");
      if (/course\s*code/i.test(cell)) {
        const nextColVal = row[c + 1];
        const nextRowVal = raw[r + 1]?.[c];
        const candidate = nextColVal ?? nextRowVal;
        if (candidate != null && String(candidate).trim() !== "") {
          courseCode = extractBaseCourseCode(String(candidate));
          break;
        }
      }
    }
    if (courseCode) break;
  }

  // Fallback to filename if no code found in this sheet
  if (!courseCode) {
    courseCode = extractBaseCourseCode(fileNameFallback.replace(/\.xlsx$/i, ""));
  }

  // --- Dynamic header boundary detection ---
  let headerRowIndex = -1;
  let nameColIndex = -1;
  let matricColIndex = -1;

  for (let r = 0; r < raw.length; r++) {
    const row = raw[r];
    let foundMatric = -1;
    let foundName = -1;
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "").toLowerCase().trim();
      if (/matric\s*(no\.?|number)/i.test(cell)) foundMatric = c;
      if (/student\s*name/i.test(cell) || cell === "name") foundName = c;
    }
    if (foundMatric !== -1 && foundName !== -1) {
      headerRowIndex = r;
      matricColIndex = foundMatric;
      nameColIndex = foundName;
      break;
    }
  }

  // Looser fallback: just find the matric column
  if (headerRowIndex === -1) {
    for (let r = 0; r < raw.length; r++) {
      const row = raw[r];
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] ?? "").toLowerCase().trim();
        if (/matric/i.test(cell)) {
          headerRowIndex = r;
          matricColIndex = c;
          nameColIndex = c === 0 ? 1 : 0;
          break;
        }
      }
      if (headerRowIndex !== -1) break;
    }
  }

  // --- Student record extraction, tagged with class_group = sheetName ---
  const students: ParsedStudent[] = [];

  if (headerRowIndex !== -1) {
    for (let r = headerRowIndex + 1; r < raw.length; r++) {
      const row = raw[r];
      if (!row || row.length === 0) continue;

      const matricRaw = row[matricColIndex];
      const nameRaw = row[nameColIndex];
      if (!matricRaw && !nameRaw) continue;

      const matricNo = String(matricRaw ?? "").trim();
      const name = String(nameRaw ?? "").trim();

      if (matricNo || name) {
        students.push({
          name: name || "Unknown",
          matricNo: matricNo || "N/A",
          class_group: sheetName, // <-- sheet-level class identity
        });
      }
    }
  }

  return { courseCode, students };
}

/**
 * Parse multiple .xlsx File objects.
 *
 * For each file, ALL sheets are processed. Students from every sheet are
 * consolidated into a single ParsedCourse entry for the file, with each
 * student tagged with class_group = sheetName so the randomization engine
 * can shuffle class groups independently.
 *
 * The course code is taken from the FIRST sheet that yields one; subsequent
 * sheets in the same file inherit that code (they are different class groups
 * of the same course).
 */
export async function parseExcelFiles(files: File[]): Promise<ParsedCourse[]> {
  const results: ParsedCourse[] = [];

  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    if (workbook.SheetNames.length === 0) continue;

    let resolvedCourseCode: string | null = null;
    const allStudents: ParsedStudent[] = [];

    // Iterate every sheet — each sheet = one class group
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const { courseCode, students } = extractStudentsFromSheet(
        sheet,
        sheetName,
        file.name
      );

      // Lock in the course code from the first sheet that provides one
      if (!resolvedCourseCode && courseCode) {
        resolvedCourseCode = courseCode;
      }

      // Tag every student with the resolved code and append
      allStudents.push(...students);
    }

    if (!resolvedCourseCode) {
      // Last resort: derive purely from filename
      resolvedCourseCode = extractBaseCourseCode(
        file.name.replace(/\.xlsx$/i, "")
      );
    }

    if (allStudents.length > 0 || resolvedCourseCode) {
      // Deduplicate by matricNo across all sheets to prevent double-parsing summary sheets
      const uniqueStudents = Array.from(
        new Map(allStudents.map((s) => [s.matricNo, s])).values()
      );

      results.push({
        courseCode: resolvedCourseCode,
        students: uniqueStudents,
        fileName: file.name,
        rawStudentCount: uniqueStudents.length,
      });
    }

  }

  return results;
}
