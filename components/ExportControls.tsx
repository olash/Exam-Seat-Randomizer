"use client";

import React, { useState } from "react";
import { Download, Save, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { SeatingAllocation } from "@/lib/randomization";
import { VENUE_CAPACITIES } from "@/lib/timetableMap";
import { saveSession } from "@/lib/db";

interface ExportControlsProps {
  allocations: SeatingAllocation[];
  sessionName?: string;
}

type Status = "idle" | "loading" | "success" | "error";

export default function ExportControls({
  allocations,
  sessionName = "",
}: ExportControlsProps) {
  const [zipStatus, setZipStatus] = useState<Status>("idle");
  const [saveStatus, setSaveStatus] = useState<Status>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [inputName, setInputName] = useState(sessionName);

  const handleExportZip = async () => {
    setZipStatus("loading");
    try {
      // Dynamic imports to avoid SSR issues
      const jsPDF = (await import("jspdf")).default;
      const autoTable = (await import("jspdf-autotable")).default;
      const JSZip = (await import("jszip")).default;

      // Group allocations by course
      const byCourse = new Map<string, SeatingAllocation[]>();
      for (const a of allocations) {
        if (!byCourse.has(a.courseCode)) byCourse.set(a.courseCode, []);
        byCourse.get(a.courseCode)!.push(a);
      }

      const zip = new JSZip();

      for (const [courseCode, rows] of byCourse) {
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

        // Header
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`Examination Seating Plan`, 14, 18);
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(`Course: ${courseCode}`, 14, 26);
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(
          `Generated: ${new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })} · ${rows.length} students`,
          14,
          32
        );
        doc.setTextColor(0);

        // Use autoTable (modern API — NOT doc.autoTable)
        autoTable(doc, {
          startY: 38,
          head: [["#", "Student Name", "Matric No.", "Venue", "Seat No."]],
          body: rows.map((r, i) => [
            String(i + 1),
            r.studentName,
            r.matricNo,
            r.venueName,
            String(r.seatNumber),
          ]),
          styles: {
            fontSize: 8,
            cellPadding: 2.5,
          },
          headStyles: {
            fillColor: [24, 24, 27], // zinc-900
            textColor: 255,
            fontStyle: "bold",
            fontSize: 8,
          },
          alternateRowStyles: {
            fillColor: [250, 250, 250],
          },
          columnStyles: {
            0: { cellWidth: 10, halign: "right" },
            2: { font: "courier", fontSize: 7.5 },
            4: { cellWidth: 18, halign: "center", font: "courier" },
          },
          // Overflow rows in red
          didParseCell: (data) => {
            if (data.section === "body") {
              const rowIndex = data.row.index;
              const alloc = rows[rowIndex];
              if (alloc?.isOverflow) {
                data.cell.styles.textColor = [185, 28, 28]; // red-700
                data.cell.styles.fillColor = [254, 242, 242]; // red-50
              }
            }
          },
        });

        const pdfBytes = doc.output("arraybuffer");
        zip.file(`${courseCode}_Seating_Plan.pdf`, pdfBytes);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Examination_Seating_Plans.zip"; // Explicit extension for OS compatibility
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setZipStatus("success");
      setTimeout(() => setZipStatus("idle"), 3000);
    } catch (e) {
      console.error(e);
      setZipStatus("error");
      setTimeout(() => setZipStatus("idle"), 5000);
    }
  };

  const handleSave = async () => {
    if (!inputName.trim()) return;
    setSaveStatus("loading");
    setSaveError(null);
    try {
      const desc = `${allocations.length} allocations across ${
        new Set(allocations.map((a) => a.courseCode)).size
      } courses`;
      await saveSession(inputName.trim(), desc, allocations);
      setSaveStatus("success");
      setModalOpen(false);
      setTimeout(() => setSaveStatus("idle"), 4000);
    } catch (e) {
      setSaveError((e as Error).message);
      setSaveStatus("error");
    }
  };

  const disabled = allocations.length === 0;

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Export & Save</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Download a ZIP of per-course PDF seating plans, or save to Supabase.
          </p>
        </div>

        <button
          id="export-zip-btn"
          type="button"
          onClick={handleExportZip}
          disabled={disabled || zipStatus === "loading"}
          className="flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {zipStatus === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : zipStatus === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {zipStatus === "loading"
            ? "Generating PDFs…"
            : zipStatus === "success"
            ? "Downloaded!"
            : "Export ZIP (PDFs per course)"}
        </button>

        <button
          id="save-supabase-btn"
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={disabled || saveStatus === "loading"}
          className="flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saveStatus === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saveStatus === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saveStatus === "success" ? "Saved to Supabase!" : "Save to Supabase"}
        </button>

        {zipStatus === "error" && (
          <p className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertTriangle className="h-3 w-3" />
            Export failed. Check console for details.
          </p>
        )}
      </div>

      {/* Save modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-zinc-900">
              Save session to Supabase
            </h2>
            <p className="mt-1.5 text-sm text-zinc-500">
              Give this seating session a descriptive name for future reference.
            </p>

            <div className="mt-5">
              <label
                htmlFor="session-name-input"
                className="mb-1.5 block text-xs font-medium text-zinc-700"
              >
                Session name
              </label>
              <input
                id="session-name-input"
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="e.g. Semester II 2025 — Main Exams"
                className="w-full rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              />
            </div>

            {saveError && (
              <p className="mt-3 flex items-center gap-2 text-xs text-red-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {saveError}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                id="confirm-save-btn"
                type="button"
                onClick={handleSave}
                disabled={!inputName.trim() || saveStatus === "loading"}
                className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
              >
                {saveStatus === "loading" && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Save session
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
