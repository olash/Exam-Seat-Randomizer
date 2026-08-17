"use client";

import React, { useMemo, useState } from "react";
import { ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import { SeatingAllocation } from "@/lib/randomization";
import { VENUE_CAPACITIES, ALL_VENUES } from "@/lib/timetableMap";

interface SeatingDataTableProps {
  allocations: SeatingAllocation[];
}

type SortKey = "studentName" | "matricNo" | "courseCode" | "venueName" | "seatNumber";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 50;

export default function SeatingDataTable({ allocations }: SeatingDataTableProps) {
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("seatNumber");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  // Unique values for filters
  const venues = useMemo(
    () => Array.from(new Set(allocations.map((a) => a.venueName))).sort(),
    [allocations]
  );
  const courses = useMemo(
    () => Array.from(new Set(allocations.map((a) => a.courseCode))).sort(),
    [allocations]
  );

  const filtered = useMemo(() => {
    let rows = allocations;
    if (venueFilter !== "all") rows = rows.filter((r) => r.venueName === venueFilter);
    if (courseFilter !== "all") rows = rows.filter((r) => r.courseCode === courseFilter);
    return rows;
  }, [allocations, venueFilter, courseFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: string | number = a[sortKey];
      let vb: string | number = b[sortKey];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageData = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const overflowCount = allocations.filter((a) => a.isOverflow).length;

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col)
      return <ChevronUp className="h-3 w-3 text-zinc-300" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 text-zinc-700" />
    ) : (
      <ChevronDown className="h-3 w-3 text-zinc-700" />
    );
  };

  const ColHeader = ({
    col,
    label,
    className = "",
  }: {
    col: SortKey;
    label: string;
    className?: string;
  }) => (
    <th className={`px-3 py-3 text-left ${className}`}>
      <button
        type="button"
        onClick={() => handleSort(col)}
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-900"
      >
        {label}
        <SortIcon col={col} />
      </button>
    </th>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold text-zinc-900">
              Generated seating list
            </h3>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
              {allocations.length} students
            </span>
            {overflowCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                <AlertTriangle className="h-3 w-3" />
                {overflowCount} overflow
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Showing {sorted.length} of {allocations.length} allocations ·{" "}
            Rows in red exceed venue capacity
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-100 bg-zinc-50/60 px-5 py-2.5">
        {/* Venue filter tabs */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => { setVenueFilter("all"); setPage(1); }}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              venueFilter === "all"
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            All venues
          </button>
          {venues.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { setVenueFilter(v); setPage(1); }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                venueFilter === v
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="mx-2 h-5 w-px self-center bg-zinc-200" />

        {/* Course filter */}
        <select
          id="course-filter-select"
          value={courseFilter}
          onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }}
          className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900"
        >
          <option value="all">All courses</option>
          {courses.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead className="border-b border-zinc-200 bg-zinc-50/70">
            <tr>
              <th className="w-12 px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                #
              </th>
              <ColHeader col="studentName" label="Student Name" className="min-w-[180px]" />
              <ColHeader col="matricNo" label="Matric No" />
              <ColHeader col="courseCode" label="Course" />
              <ColHeader col="venueName" label="Venue" />
              <ColHeader col="seatNumber" label="Seat" className="text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-zinc-400">
                  No records match the current filter.
                </td>
              </tr>
            ) : (
              pageData.map((row, i) => {
                const isOverflow = row.isOverflow;
                return (
                  <tr
                    key={`${row.matricNo}-${row.courseCode}`}
                    className={`transition ${
                      isOverflow
                        ? "bg-red-50/50 hover:bg-red-50 text-red-700"
                        : "hover:bg-zinc-50/80"
                    }`}
                  >
                    <td className="px-5 py-3 text-right font-mono text-xs text-zinc-400">
                      {(currentPage - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td
                      className={`px-3 py-3 text-sm font-medium ${
                        isOverflow ? "text-red-700" : "text-zinc-800"
                      }`}
                    >
                      {row.studentName}
                    </td>
                    <td
                      className={`px-3 py-3 font-mono text-xs ${
                        isOverflow ? "text-red-600" : "text-zinc-600"
                      }`}
                    >
                      {row.matricNo}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          isOverflow
                            ? "bg-red-100 text-red-700"
                            : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {row.courseCode}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-3 text-sm ${
                        isOverflow ? "text-red-600" : "text-zinc-700"
                      }`}
                    >
                      {row.venueName}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-mono text-sm font-semibold ${
                        isOverflow ? "text-red-700" : "text-zinc-800"
                      }`}
                    >
                      {isOverflow && (
                        <AlertTriangle className="mr-1 inline h-3 w-3 text-red-500" />
                      )}
                      {row.seatNumber}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex flex-col gap-3 border-t border-zinc-200 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            Showing{" "}
            <span className="font-medium text-zinc-700">
              {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, sorted.length)}
            </span>{" "}
            of{" "}
            <span className="font-medium text-zinc-700">
              {sorted.length}
            </span>{" "}
            results
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-30"
            >
              <ChevronDown className="h-4 w-4 rotate-90" />
            </button>
            {Array.from({ length: Math.min(7, pageCount) }, (_, idx) => {
              // Show pages around current
              let p: number;
              if (pageCount <= 7) {
                p = idx + 1;
              } else if (currentPage <= 4) {
                p = idx + 1;
              } else if (currentPage >= pageCount - 3) {
                p = pageCount - 6 + idx;
              } else {
                p = currentPage - 3 + idx;
              }
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition ${
                    p === currentPage
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              type="button"
              disabled={currentPage === pageCount}
              onClick={() => setPage((p) => p + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-30"
            >
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
