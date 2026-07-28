import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Link2, RefreshCw, Search as SearchIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { matchGroups } from "@/components/grounded/groundedRules";
import CompanyResultCard from "@/components/grounded/CompanyResultCard";

// Product terms for Pearl's "Second Opinion 3D" (CBCT) launch, 8/19/2026.
// Reps naturally say "3d" / "cbct" on calls far more often than the formal
// product name, so those short tokens are the primary retrieval terms.
const PRODUCT_TERMS = ["cbct", "second opinion 3d", "so3d", "3d"];
const TABLES = ["golden_companies", "contacts", "activities", "deals", "leads"];
const MAX_PAGES = 20;
const MAX_INDEX_PAGES = 8;
const CONCURRENCY = 6;

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [groups, setGroups] = useState([]);
  const [companySearch, setCompanySearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all"); // all | customer | non_customer
  const [lastRun, setLastRun] = useState(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const tableRecords = {};
      const companyRecords = [];
      const seenCompanyIds = new Set();

      const fetchAllPages = async (table, search, maxPages = MAX_PAGES) => {
        const all = [];
        for (let p = 1; p <= maxPages; p++) {
          try {
            const r = await base44.functions.invoke("fetchGoldenData", {
              table,
              search,
              limit: 1000,
              page: p,
            });
            const list = r?.data?.results || [];
            if (!Array.isArray(list) || !list.length) break;
            all.push(...list);
            if (list.length < 200) break; // last page short — done
          } catch {
            break;
          }
        }
        return all;
      };

      // The broad golden_companies "" index resolves company name / hubspot
      // link / customer status for hits that land on activities/deals/leads.
      const tasks = [{ table: "golden_companies", term: "", maxPages: MAX_INDEX_PAGES }];
      for (const table of TABLES) {
        for (const term of PRODUCT_TERMS) {
          tasks.push({ table, term });
        }
      }

      const runTask = async (t) => {
        try {
          const list = await fetchAllPages(t.table, t.term, t.maxPages);
          tableRecords[t.table] = (tableRecords[t.table] || []).concat(list);
          if (t.table === "golden_companies") {
            for (const rec of list) {
              if (rec && rec.id != null && !seenCompanyIds.has(String(rec.id))) {
                seenCompanyIds.add(String(rec.id));
                companyRecords.push(rec);
              }
            }
          }
        } catch {
          /* skip single fetch failures */
        }
      };
      for (let i = 0; i < tasks.length; i += CONCURRENCY) {
        const batch = tasks.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(runTask));
      }

      for (const t of Object.keys(tableRecords)) {
        const seenIds = new Set();
        const deduped = [];
        for (const rec of tableRecords[t]) {
          const key = rec && rec.id != null ? `id:${rec.id}` : JSON.stringify(rec);
          if (seenIds.has(key)) continue;
          seenIds.add(key);
          deduped.push(rec);
        }
        tableRecords[t] = deduped;
      }

      // "generic" sense: any single evidence hit on any table qualifies —
      // this is meant to surface every mention, not just expressed interest.
      const clauses = TABLES.map((table) => ({ table, terms: PRODUCT_TERMS, variations: [] }));
      const built = matchGroups(clauses, tableRecords, companyRecords, "generic");
      setGroups(built);
      setLastRun(new Date());
    } catch (e) {
      setError(e?.message || "Failed to load Second Opinion 3D mentions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    return groups
      .filter((g) => (q ? String(g.company || "").toLowerCase().includes(q) : true))
      .filter((g) =>
        customerFilter === "all" ? true : customerFilter === "customer" ? g.isCustomer : !g.isCustomer,
      );
  }, [groups, companySearch, customerFilter]);

  const customerCount = groups.filter((g) => g.isCustomer).length;
  const nonCustomerCount = groups.length - customerCount;

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-slate-900">
      <div className="mx-auto max-w-[1080px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-[#e6f4ee] px-2.5 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#19734a]">
              <Sparkles className="h-3.5 w-3.5" /> Second Opinion 3D
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#17243e] sm:text-4xl">
              Every account that's mentioned CBCT / 3D.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Pulled from stored notes, emails, call transcripts, deals, and leads across the Golden DB — grouped by company, with the exact evidence that matched. Launching 8/19.
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#17243e] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-[#7662d6] focus-within:bg-white">
            <SearchIcon className="h-4 w-4 text-slate-400" />
            <input
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              placeholder="Filter by company name…"
              className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
            {[
              { key: "all", label: "All" },
              { key: "customer", label: "Customer" },
              { key: "non_customer", label: "Non-customer" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setCustomerFilter(opt.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${customerFilter === opt.key ? "bg-white text-[#17243e] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {(loading || refreshing) && (
          <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-[#19734a]" />
            Scanning notes, emails, calls, deals, and leads for CBCT / 3D mentions…
          </div>
        )}

        {!loading && !refreshing && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-sm text-red-700">{error}</div>
        )}

        {!loading && !refreshing && !error && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
            No accounts match these filters.
          </div>
        )}

        {!loading && !refreshing && !error && filtered.length > 0 && (
          <>
            <div className="mb-3 text-xs text-slate-500">
              <strong className="text-[#17243e]">{filtered.length}</strong> account{filtered.length === 1 ? "" : "s"} shown ·{" "}
              <strong className="text-[#19734a]">{customerCount}</strong> customer{customerCount === 1 ? "" : "s"} ·{" "}
              <strong className="text-slate-600">{nonCustomerCount}</strong> non-customer{nonCustomerCount === 1 ? "" : "s"} total
            </div>
            <div className="flex flex-col gap-3">
              {filtered.map((g, i) => (
                <CompanyResultCard key={g.companyId || `${g.company}-${i}`} group={g} terms={PRODUCT_TERMS} />
              ))}
            </div>
          </>
        )}

        <div className="mt-6 flex items-center gap-1.5 text-[11px] text-slate-400">
          <Link2 className="h-3.5 w-3.5" />
          Matches "cbct", "3d", "second opinion 3d", "so3d" across companies, contacts, notes/calls/emails, deals, and leads. Email evidence is subject-line only — full email bodies aren't stored.
          {lastRun ? ` Last refreshed ${lastRun.toLocaleTimeString()}.` : ""}
        </div>
      </div>
    </main>
  );
}
