"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  X,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { parseExcelFiles, ParsedCourse } from "@/lib/excelParser";
import {
  COURSE_VENUE_MAP,
  VENUE_CAPACITIES,
  ALL_VENUES,
  TOTAL_CAPACITY,
} from "@/lib/timetableMap";

interface FileUploadZoneProps {
  onCoursesReady: (
    courses: ParsedCourse[],
    overrides: Record<string, string[]>
  ) => void;
}

interface DropdownState {
  [courseCode: string]: boolean;
}

export default function FileUploadZone({ onCoursesReady }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [parsedCourses, setParsedCourses] = useState<ParsedCourse[]>([]);
  const [venueOverrides, setVenueOverrides] = useState<
    Record<string, string[]>
  >({});
  const [dropdownOpen, setDropdownOpen] = useState<DropdownState>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalStudents = parsedCourses.reduce(
    (sum, c) => sum + c.students.length,
    0
  );
  const capacityPercent = Math.min(
    100,
    Math.round((totalStudents / TOTAL_CAPACITY) * 100)
  );

  const unmappedCourses = parsedCourses.filter(
    (c) => !COURSE_VENUE_MAP[c.courseCode]
  );

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const xlsxFiles = Array.from(files).filter((f) =>
      f.name.toLowerCase().endsWith(".xlsx")
    );
    if (xlsxFiles.length === 0) {
      setError("Please upload .xlsx files only.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const courses = await parseExcelFiles(xlsxFiles);
      setParsedCourses((prev) => {
        // Merge: deduplicate by courseCode, later files win
        const map = new Map(prev.map((c) => [c.courseCode, c]));
        for (const c of courses) map.set(c.courseCode, c);
        return Array.from(map.values());
      });
    } catch (e) {
      setError(`Parse error: ${(e as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const removeCourse = (courseCode: string) => {
    setParsedCourses((prev) => prev.filter((c) => c.courseCode !== courseCode));
    setVenueOverrides((prev) => {
      const next = { ...prev };
      delete next[courseCode];
      return next;
    });
  };

  const toggleVenue = (courseCode: string, venue: string) => {
    setVenueOverrides((prev) => {
      const current = prev[courseCode] ?? [];
      const exists = current.includes(venue);
      return {
        ...prev,
        [courseCode]: exists
          ? current.filter((v) => v !== venue)
          : [...current, venue],
      };
    });
  };

  const handleGenerate = () => {
    // Build final overrides: only include if user picked venues for unmapped
    const finalOverrides: Record<string, string[]> = {};
    for (const c of unmappedCourses) {
      const picked = venueOverrides[c.courseCode];
      if (picked && picked.length > 0) {
        finalOverrides[c.courseCode] = picked;
      }
    }
    onCoursesReady(parsedCourses, finalOverrides);
  };

  const canGenerate =
    parsedCourses.length > 0 &&
    unmappedCourses.every(
      (c) =>
        COURSE_VENUE_MAP[c.courseCode] ||
        (venueOverrides[c.courseCode] ?? []).length > 0
    );

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 py-10 text-center transition-all duration-200 ${
          isDragging
            ? "border-zinc-700 bg-zinc-100"
            : "border-zinc-300 bg-zinc-50 hover:border-zinc-500 hover:bg-zinc-100/60"
        }`}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        aria-label="Upload XLSX files"
      >
        <input
          ref={fileInputRef}
          id="file-upload-input"
          type="file"
          accept=".xlsx"
          multiple
          className="sr-only"
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm transition group-hover:border-zinc-300 group-hover:shadow">
          {isLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
          ) : (
            <Upload className="h-5 w-5 text-zinc-600" />
          )}
        </div>
        <p className="mt-4 text-sm font-semibold text-zinc-800">
          {isLoading ? "Parsing files…" : "Drop registration files here"}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Multiple .xlsx files · One course per file · Max 25 MB each
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Parsed files list */}
      {parsedCourses.length > 0 && (
        <div className="space-y-3">
          {/* Capacity bar */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
              <span className="font-medium text-zinc-700">
                {totalStudents.toLocaleString()} students imported
              </span>
              <span>
                {TOTAL_CAPACITY.toLocaleString()} total seats available
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  capacityPercent > 90
                    ? "bg-red-500"
                    : capacityPercent > 70
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${capacityPercent}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              {capacityPercent}% of total venue capacity
            </p>
          </div>

          {/* Course cards */}
          {parsedCourses.map((course) => {
            const isMapped = !!COURSE_VENUE_MAP[course.courseCode];
            const pickedVenues = venueOverrides[course.courseCode] ?? [];
            const isOpen = dropdownOpen[course.courseCode] ?? false;

            return (
              <div
                key={course.courseCode}
                className={`rounded-lg border bg-white transition ${
                  isMapped ? "border-zinc-200" : "border-amber-300"
                }`}
              >
                <div className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                        isMapped
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {isMapped ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-zinc-900">
                          {course.courseCode}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                          {course.students.length} students
                        </span>
                        {!isMapped && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Unmapped
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        {course.fileName}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCourse(course.courseCode);
                    }}
                    aria-label={`Remove ${course.courseCode}`}
                    className="shrink-0 rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Venue assignment for unmapped courses */}
                {!isMapped && (
                  <div className="border-t border-amber-100 px-4 pb-4 pt-3">
                    <p className="mb-2 text-xs font-medium text-amber-700">
                      Assign venues for {course.courseCode}:
                    </p>
                    <div className="relative">
                      <button
                        type="button"
                        id={`venue-dropdown-${course.courseCode}`}
                        onClick={() =>
                          setDropdownOpen((prev) => ({
                            ...prev,
                            [course.courseCode]: !prev[course.courseCode],
                          }))
                        }
                        aria-expanded={isOpen}
                        className="flex w-full items-center justify-between rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-left text-sm text-zinc-700 transition hover:border-zinc-400"
                      >
                        <span>
                          {pickedVenues.length === 0
                            ? "Select venues…"
                            : pickedVenues.join(", ")}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {isOpen && (
                        <div className="absolute left-0 top-full z-30 mt-1.5 max-h-52 w-full overflow-auto rounded-lg border border-zinc-200 bg-white p-1.5 shadow-xl shadow-zinc-900/10">
                          {ALL_VENUES.map((venue) => {
                            const checked = pickedVenues.includes(venue);
                            return (
                              <label
                                key={venue}
                                className="flex cursor-pointer items-center justify-between rounded-md px-2.5 py-2 text-sm hover:bg-zinc-50"
                              >
                                <span className="flex items-center gap-2.5">
                                  <span
                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                                      checked
                                        ? "border-zinc-900 bg-zinc-900 text-white"
                                        : "border-zinc-300"
                                    }`}
                                  >
                                    {checked && (
                                      <svg
                                        viewBox="0 0 10 8"
                                        className="h-2.5 w-2.5 fill-current"
                                      >
                                        <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    )}
                                  </span>
                                  {venue}
                                </span>
                                <span className="text-xs text-zinc-400">
                                  {VENUE_CAPACITIES[venue]}
                                </span>
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={checked}
                                  onChange={() =>
                                    toggleVenue(course.courseCode, venue)
                                  }
                                />
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Generate button */}
          <button
            id="generate-seating-btn"
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate || isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Generate Seating Plan
          </button>
          {!canGenerate && unmappedCourses.length > 0 && (
            <p className="text-center text-xs text-amber-600">
              ↑ Assign venues to all unmapped courses before generating
            </p>
          )}
        </div>
      )}
    </div>
  );
}
