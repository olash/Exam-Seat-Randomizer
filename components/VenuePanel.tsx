"use client";

import React from "react";
import { Building2 } from "lucide-react";
import { VENUE_CAPACITIES } from "@/lib/timetableMap";
import { SeatingAllocation } from "@/lib/randomization";

interface VenuePanelProps {
  allocations: SeatingAllocation[];
}

export default function VenuePanel({ allocations }: VenuePanelProps) {
  // Count allocated per venue
  const allocatedByVenue = new Map<string, number>();
  for (const a of allocations) {
    allocatedByVenue.set(
      a.venueName,
      (allocatedByVenue.get(a.venueName) ?? 0) + 1
    );
  }

  const totalCapacity = Object.values(VENUE_CAPACITIES).reduce(
    (s, c) => s + c,
    0
  );
  const totalAllocated = allocations.length;

  const venues = Object.entries(VENUE_CAPACITIES);

  return (
    <section
      aria-labelledby="venue-panel-title"
      className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
    >
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
        <div>
          <h3
            id="venue-panel-title"
            className="text-sm font-semibold text-zinc-900"
          >
            Venue constraints
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Predefined rooms and usable capacity.
          </p>
        </div>
        <Building2 className="h-5 w-5 text-zinc-400" />
      </div>

      <div className="divide-y divide-zinc-100">
        {venues.map(([venue, cap]) => {
          const used = allocatedByVenue.get(venue) ?? 0;
          const pct = Math.min(100, Math.round((used / cap) * 100));
          const isOverfull = used > cap;

          return (
            <div key={venue} className="px-5 py-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm text-zinc-700">{venue}</span>
                <span
                  className={`font-mono text-sm font-semibold ${
                    isOverfull ? "text-red-600" : "text-zinc-900"
                  }`}
                >
                  {used > 0 ? (
                    <>
                      <span
                        className={isOverfull ? "text-red-600" : "text-zinc-500"}
                      >
                        {used}/
                      </span>
                      {cap}
                    </>
                  ) : (
                    cap
                  )}
                </span>
              </div>
              {used > 0 && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isOverfull
                        ? "bg-red-500"
                        : pct > 80
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-zinc-200 bg-zinc-50 px-5 py-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Total capacity
          </span>
          <span className="font-mono text-sm font-semibold text-zinc-900">
            {totalCapacity.toLocaleString()}
          </span>
        </div>
        {totalAllocated > 0 && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full rounded-full bg-zinc-900 transition-all duration-700"
              style={{
                width: `${Math.min(100, (totalAllocated / totalCapacity) * 100)}%`,
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
