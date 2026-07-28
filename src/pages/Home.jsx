import { useMemo, useState } from "react";
import { Sparkles, Link2, Search as SearchIcon, Lock, LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { isAllowedEmail } from "@/lib/allowlist";
import CompanyResultCard from "@/components/grounded/CompanyResultCard";
import ACCOUNTS from "@/data/secondOpinion3DAccounts.json";

// Product terms for Pearl's "Second Opinion 3D" (CBCT) launch, 8/19/2026.
// This list was built as a one-time, hand-verified scan of the Golden DB
// (companies, contacts, notes/calls/emails, deals, leads) — see
// src/data/secondOpinion3DAccounts.json. It excludes ~1,250 evidence rows
// that turned out to be Pearl's own mass-outreach templates (reengagement
// emails, FDA-clearance announcement blasts) rather than genuine
// account-specific mentions, and 20 accounts already enrolled in the 3D
// beta program (tagged "CBCT BETA" or sent the beta-onboarding email) —
// they already have it, so they aren't launch prospects. Every remaining
// account is tagged by how strongly it signals wanting CBCT/3D once it
// ships: "Wants CBCT/3D" (explicit interest/demo-request language), "Has
// 3D imaging" (already owns CBCT hardware, no expressed want), or
// "Mentioned" (came up with no clear signal either way).
const PRODUCT_TERMS = ["cbct", "second opinion 3d", "so3d", "3d"];
const GENERATED_AT = "2026-07-28";

export default function Home() {
  const { user, logout } = useAuth();
  const [companySearch, setCompanySearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all"); // all | customer | non_customer
  const [priorityFilter, setPriorityFilter] = useState("all"); // all | high | medium | low

  const filtered = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    return ACCOUNTS.filter((g) => (q ? String(g.company || "").toLowerCase().includes(q) : true))
      .filter((g) => (customerFilter === "all" ? true : customerFilter === "customer" ? g.isCustomer : !g.isCustomer))
      .filter((g) => (priorityFilter === "all" ? true : g.priority === priorityFilter));
  }, [companySearch, customerFilter, priorityFilter]);

  const customerCount = ACCOUNTS.filter((g) => g.isCustomer).length;
  const nonCustomerCount = ACCOUNTS.length - customerCount;
  const priorityCounts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    for (const g of ACCOUNTS) c[g.priority] = (c[g.priority] || 0) + 1;
    return c;
  }, []);

  if (!isAllowedEmail(user?.email)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-6 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm">
          <Lock className="mx-auto mb-3 h-6 w-6 text-slate-400" />
          <h1 className="text-lg font-bold text-[#17243e]">Access restricted</h1>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            This tool contains internal account notes and is limited to an allowlisted set of accounts.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-slate-900">
      <div className="mx-auto max-w-[1080px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-[#e6f4ee] px-2.5 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#19734a]">
              <Sparkles className="h-3.5 w-3.5" /> Second Opinion 3D
            </div>
            <button
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            >
              <LogOut className="h-3.5 w-3.5" /> Log out
            </button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#17243e] sm:text-4xl">
            Accounts that want CBCT / 3D when it ships.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Hand-verified list from stored notes, emails, call transcripts, deals, and leads across the Golden DB, ranked by how strongly each account signals wanting Second Opinion 3D once it launches 8/19. Beta-program accounts (already have it) are excluded. Generated {GENERATED_AT}.
          </p>
        </header>

        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
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
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 self-start">
            {[
              { key: "all", label: `All (${ACCOUNTS.length})` },
              { key: "high", label: `Wants CBCT/3D (${priorityCounts.high})` },
              { key: "medium", label: `Has 3D imaging (${priorityCounts.medium})` },
              { key: "low", label: `Mentioned (${priorityCounts.low})` },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPriorityFilter(opt.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${priorityFilter === opt.key ? "bg-white text-[#17243e] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
            No accounts match these filters.
          </div>
        )}

        {filtered.length > 0 && (
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
          Matches "cbct", "3d", "second opinion 3d", "so3d" across companies, contacts, notes/calls/emails, deals, and leads. Mass-outreach templates (reengagement emails, FDA-clearance announcement blasts) and 20 confirmed beta-program accounts were excluded — this is per-account signal, not raw keyword hits. Email evidence is subject-line only.
        </div>
      </div>
    </main>
  );
}