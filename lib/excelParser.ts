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
}

export interface ParsedCourse {
  courseCode: string;
  students: ParsedStudent[];
  fileName: string;
  rawStudentCount: number;
}


/**
 * Deeply scans the first 15 rows of a sheet to extract the course code,
 * then finds the header row with "Matric No." and "Student Name" to slice records.
 */
function parseSheet(
  sheet: XLSX.WorkSheet,
  fileName: string
): ParsedCourse | null {
  // Convert entire sheet to 2D array for flexible scanning
  const raw: (string | number | null | undefined)[][] =
    XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  if (raw.length === 0) return null;

  // Step 1: Scan first 15 rows for "Course Code" cell → extract the value
  let courseCode: string | null = null;
  const scanRows = Math.min(15, raw.length);

  for (let r = 0; r < scanRows; r++) {
    const row = raw[r];
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "");
      if (/course\s*code/i.test(cell)) {
        // Value is usually in the next column or the next row
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

  if (!courseCode) {
    // Fallback: derive from filename, stripping extension and suffixes
    courseCode = extractBaseCourseCode(fileName.replace(/\.xlsx$/i, ""));
  }

  // Step 2: Find the data header row with both "Matric No." and "Student Name"
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

  if (headerRowIndex === -1) {
    // Try looser header detection (just matric no)
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

  // Extract student rows
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
        students.push({ name: name || "Unknown", matricNo: matricNo || "N/A" });
      }
    }
  }

  return {
    courseCode,
    students,
    fileName,
    rawStudentCount: students.length,
  };
}

/**
 * Parse multiple .xlsx File objects. Returns an array of ParsedCourse.
 */
export async function parseExcelFiles(files: File[]): Promise<ParsedCourse[]> {
  const results: ParsedCourse[] = [];

  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    // Process the first sheet of each file
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) continue;

    const sheet = workbook.Sheets[firstSheetName];
    const parsed = parseSheet(sheet, file.name);
    if (parsed) {
      results.push(parsed);
    }
  }

  return results;
}
