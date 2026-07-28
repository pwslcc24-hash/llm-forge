import { useState } from "react";
import { Building2, Link2, ChevronDown, ChevronRight } from "lucide-react";
import { snippetAround, highlightSegments } from "./groundedRules";

const TABLE_LABELS = {
  golden_companies: "Company",
  contacts: "Contact",
  deals: "Deal",
  tickets: "Ticket",
  leads: "Lead",
  activities: "Activity",
  owners: "Owner",
  pipeline_stages: "Stage",
  merge_log: "Merge",
};

const formatDate = (s) => {
  try {
    const d = new Date(s);
    if (Number.isFinite(d.getTime())) {
      return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    }
  } catch { /* fall through */ }
  return String(s);
};

const isHttpUrl = (u) => typeof u === "string" && /^https?:\/\//i.test(u.trim());

const PRIORITY_META = {
  high: { label: "Wants CBCT/3D", className: "bg-[#fff3ea] text-[#c2410c]" },
  medium: { label: "Has 3D imaging", className: "bg-[#e6f0fb] text-[#1d4ed8]" },
  low: { label: "Mentioned", className: "bg-slate-100 text-slate-500" },
};

// First one or two distinct evidence snippets — keeps the collapsed summary
// to ~1–2 sentences while still proving *why* the company matched.
function summarize(group, terms) {
  const segs = [];
  const used = new Set();
  for (const e of group.evidences) {
    if (used.has(e.field)) continue;
    used.add(e.field);
    const snip = snippetAround(e.value, terms, 120).replace(/\s+/g, " ").trim();
    if (!snip) continue;
    segs.push(snip);
    if (segs.length >= 2) break;
  }
  if (!segs.length) return null;
  return segs.map((s) => `“${s.length > 140 ? s.slice(0, 140) + '…' : s}”`).join("  ·  ");
}

export default function CompanyResultCard({ group, terms }) {
  const [open, setOpen] = useState(false);
  const link = isHttpUrl(group.hubspotUrl) ? group.hubspotUrl : null;
  const summary = summarize(group, terms);

  const topField = group.evidences[0]?.field;
  const renderVerbatim = () => {
    if (!summary) return "Matched on stored evidence.";
    const parts = highlightSegments(summary, terms);
    return parts.map((seg, k) =>
      seg.match ? <mark key={k} className="rounded bg-amber-200 px-0.5">{seg.text}</mark> : <span key={k}>{seg.text}</span>,
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e9e4ff] text-[#5c46bb]">
          <Building2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {link ? (
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-bold text-[#17243e] underline decoration-slate-300 decoration-1 underline-offset-2 hover:text-[#5c46bb] hover:decoration-[#5c46bb]"
              >
                {group.company}
              </a>
            ) : (
              <span className="text-sm font-bold text-[#17243e]">{group.company}</span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${group.isCustomer ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {group.isCustomer ? "Customer" : "Non-customer"}
            </span>
            {PRIORITY_META[group.priority] && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_META[group.priority].className}`}>
                {PRIORITY_META[group.priority].label}
              </span>
            )}
            <span className="text-[11px] font-medium text-slate-400">
              {group.evidences.length} evidence field{group.evidences.length === 1 ? "" : "s"}
              {topField ? ` · ${topField}` : ""}
            </span>
          </div>
          <div className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-600">{renderVerbatim()}</div>
        </div>
        <span className="mt-1 shrink-0 text-slate-400">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="mb-3 flex justify-end">
            {link ? (
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-[#5c46bb] transition hover:bg-white"
              >
                <Link2 className="h-3.5 w-3.5" /> HubSpot
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-400">
                No verified HubSpot link
              </span>
            )}
          </div>
          <ul className="flex flex-col gap-2.5">
            {group.evidences.map((e, j) => (
              <li key={j} className="flex flex-col gap-1.5 sm:flex-row sm:items-start">
                <div className="flex shrink-0 items-center gap-1.5 sm:w-44">
                  <span className="rounded-md bg-[#f3f0ff] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#5c46bb]">
                    {TABLE_LABELS[e.table] || e.table}
                  </span>
                  <code className="truncate rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{e.field}</code>
                </div>
                <div className="flex-1">
                  <div className="text-sm leading-6 text-slate-700">
                    {highlightSegments(snippetAround(e.value, terms), terms).map((seg, k) =>
                      seg.match
                        ? <mark key={k} className="rounded bg-amber-200 px-0.5">{seg.text}</mark>
                        : <span key={k}>{seg.text}</span>
                    )}
                  </div>
                  {e.date && (
                    <span className="mt-0.5 block text-[11px] text-slate-400">Evidence date: {formatDate(e.date)}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
