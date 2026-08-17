"use client";

export const dynamic = "force-dynamic";

import React, { useState } from "react";
import { Shuffle, RotateCcw, BookOpen } from "lucide-react";
import FileUploadZone from "@/components/FileUploadZone";
import SeatingDataTable from "@/components/SeatingDataTable";
import ExportControls from "@/components/ExportControls";
import VenuePanel from "@/components/VenuePanel";
import { ParsedCourse } from "@/lib/excelParser";
import { SeatingAllocation, generateSeating } from "@/lib/randomization";
import { TOTAL_CAPACITY } from "@/lib/timetableMap";

type Phase = "upload" | "generated";

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [allocations, setAllocations] = useState<SeatingAllocation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastCourses, setLastCourses] = useState<ParsedCourse[]>([]);
  const [lastOverrides, setLastOverrides] = useState<Record<string, string[]>>(
    {}
  );

  const handleCoursesReady = async (
    courses: ParsedCourse[],
    overrides: Record<string, string[]>
  ) => {
    setLastCourses(courses);
    setLastOverrides(overrides);
    setIsGenerating(true);
    // Run allocation (slightly async so UI updates first)
    await new Promise((r) => setTimeout(r, 80));
    const result = generateSeating(courses, overrides);
    setAllocations(result);
    setPhase("generated");
    setIsGenerating(false);
  };

  const handleReset = () => {
    setPhase("upload");
    setAllocations([]);
    setLastCourses([]);
    setLastOverrides({});
  };

  const handleRegenerate = async () => {
    if (lastCourses.length === 0) return;
    setIsGenerating(true);
    await new Promise((r) => setTimeout(r, 80));
    const result = generateSeating(lastCourses, lastOverrides);
    setAllocations(result);
    setIsGenerating(false);
  };

  const totalStudents = lastCourses.reduce((s, c) => s + c.students.length, 0);

  return (
    <main className="min-h-screen bg-zinc-50">
      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-6 px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-sm font-bold tracking-tighter text-white">
              SL
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold tracking-tight text-zinc-950">
                  Seatline
                </h1>
                <span className="hidden rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-500 sm:inline">
                  Examination Seating
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-zinc-200 pl-3.5">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-zinc-800">
                Registry Office
              </p>
              <p className="text-xs text-zinc-500">Administrator</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">
              RO
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-screen-2xl px-5 py-8 sm:px-8 lg:px-10">
        {/* Page title */}
        <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <nav
              aria-label="Breadcrumb"
              className="mb-3 flex items-center gap-2 text-xs text-zinc-500"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Assessments</span>
              <span className="text-zinc-300">/</span>
              <span className="font-medium text-zinc-700">Seating plans</span>
            </nav>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
              Generate seating allocation
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
              Import examination rosters, review venue capacity, and generate an
              interleaved anti-cheating seating plan. Export a ZIP of PDFs by
              course.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-center">
              <p className="text-xs text-zinc-500">Total capacity</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-zinc-900">
                {TOTAL_CAPACITY.toLocaleString()}{" "}
                <span className="font-normal text-zinc-500">seats</span>
              </p>
            </div>
            {totalStudents > 0 && (
              <div className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-center">
                <p className="text-xs text-zinc-500">Imported students</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-zinc-900">
                  {totalStudents.toLocaleString()}{" "}
                  <span className="font-normal text-zinc-500">records</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Main grid */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Left column */}
          <div className="min-w-0 space-y-6">
            {/* Upload / Regenerate controls */}
            {phase === "upload" ? (
              <section
                aria-labelledby="upload-section-title"
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
              >
                <div className="border-b border-zinc-100 px-5 py-4">
                  <h3
                    id="upload-section-title"
                    className="text-sm font-semibold text-zinc-900"
                  >
                    File ingestion
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Upload one or more .xlsx registration files. Each file
                    should contain one course.
                  </p>
                </div>
                <div className="p-5">
                  <FileUploadZone onCoursesReady={handleCoursesReady} />
                </div>
              </section>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  id="regenerate-btn"
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
                  ) : (
                    <Shuffle className="h-4 w-4" />
                  )}
                  Regenerate (re-shuffle)
                </button>
                <button
                  id="start-over-btn"
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Start over
                </button>
                <p className="text-xs text-zinc-500">
                  {lastCourses.length} course
                  {lastCourses.length !== 1 ? "s" : ""} ·{" "}
                  {totalStudents.toLocaleString()} students ·{" "}
                  {allocations.length.toLocaleString()} allocations
                </p>
              </div>
            )}

            {/* Generated table */}
            {phase === "generated" && !isGenerating && (
              <SeatingDataTable allocations={allocations} />
            )}

            {isGenerating && (
              <div className="flex items-center justify-center rounded-xl border border-zinc-200 bg-white py-20">
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
                  <p className="mt-4 text-sm text-zinc-500">
                    Randomizing and allocating…
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <aside className="space-y-5">
            <VenuePanel allocations={allocations} />

            {phase === "generated" && (
              <ExportControls allocations={allocations} />
            )}

            {/* Policy info card */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-zinc-800">
                Allocation policy
              </h3>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-500">
                <li className="flex gap-2">
                  <span className="mt-px text-zinc-300">▸</span>
                  Students are shuffled independently per course (Fisher-Yates)
                </li>
                <li className="flex gap-2">
                  <span className="mt-px text-zinc-300">▸</span>
                  Round-robin interleaving prevents same-course adjacency
                  (anti-cheating)
                </li>
                <li className="flex gap-2">
                  <span className="mt-px text-zinc-300">▸</span>
                  Red rows indicate overflow beyond venue capacity — manual
                  placement required on exam day
                </li>
                <li className="flex gap-2">
                  <span className="mt-px text-zinc-300">▸</span>
                  Re-generating replaces the current allocation with a new
                  random seed
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
