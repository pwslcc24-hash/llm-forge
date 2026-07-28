// Deterministic collectors + grouping helpers for evidence-grounded search
// results. Groups matched rows by company so the UI shows one card per
// account with every matching field as proof.

const SKIP_FIELDS =
  /^(id$|.*_id$|.*owner.*|phone$|.*phone.*|email$|.*email.*|mobile|fax|.*address.*|npi|stripe_.*|.*token.*|.*secret.*|.*password.*|created_date|updated_date|created_by_id|synced_at)$/i;

const DATE_FIELDS = /(_at$|_date$|^date|time$|date_.*|.*_time$)/i;

const isoLike = (v) => typeof v === 'string' && /^\d{4}-\d{1,2}-\d{1,2}[T ]\d{1,2}:/.test(v);

function truthy(v) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'customer';
}

function isCustomerCompany(rec) {
  if (!rec) return false;
  if (truthy(rec.is_customer)) return true;
  if (truthy(rec.is_current_customer_flag)) return true;
  const ls = String(rec.lifecycle_stage || '').toLowerCase().replace(/[-\s]/g, '_');
  if (ls === 'customer' || ls === 'evangelist' || ls === 'loyalty') return true;
  return false;
}

function hasOwnerInfo(rec) {
  if (!rec) return false;
  for (const [k, v] of Object.entries(rec)) {
    if (/owner/i.test(k) && v !== null && v !== undefined && String(v).trim() !== '') return true;
  }
  return false;
}

function pickDate(rec) {
  let best = null;
  let bestT = 0;
  for (const [k, v] of Object.entries(rec)) {
    if (DATE_FIELDS.test(k) && isoLike(v)) {
      const t = new Date(v).getTime();
      if (Number.isFinite(t) && t > bestT) {
        bestT = t;
        best = v;
      }
    }
  }
  return best;
}

export function buildCompanyMap(companyRecords) {
  const map = {};
  for (const rec of companyRecords || []) {
    if (rec && rec.id != null) map[String(rec.id)] = rec;
  }
  return map;
}

function resolveCompany(rec, table, companyMap) {
  let companyId = null;
  if (table === 'golden_companies') {
    companyId = rec.id != null ? String(rec.id) : null;
  } else if (table === 'activities') {
    companyId = rec.parent_object_id != null ? String(rec.parent_object_id) : null;
  } else {
    companyId = rec.company_id != null ? String(rec.company_id) : null;
  }
  const compRec = companyId ? companyMap[companyId] : null;
  const company =
    (compRec && (compRec.name || compRec.company_name)) ||
    rec.name || rec.company || rec.company_name || rec.account_name || '(unknown)';
  const hubspotUrl =
    (compRec && compRec.hubspot_url) || (table === 'golden_companies' ? rec.hubspot_url : null) || null;
  const isCustomer = compRec ? isCustomerCompany(compRec) : isCustomerCompany(rec);
  const hasOwner = compRec ? hasOwnerInfo(compRec) : hasOwnerInfo(rec);
  return { companyId, company, hubspotUrl, isCustomer, hasOwner };
}

export function snippetAround(text, terms, radius = 240) {
  if (!text) return '';
  const s = String(text);
  if (s.length <= radius * 2 + 12) return s;
  const lower = s.toLowerCase();
  let first = -1;
  for (const t of terms || []) {
    const at = lower.indexOf(String(t).toLowerCase());
    if (at >= 0 && (first < 0 || at < first)) first = at;
  }
  if (first < 0) return s.slice(0, radius) + '…';
  const start = Math.max(0, first - radius);
  const end = Math.min(s.length, first + radius);
  return (start > 0 ? '…' : '') + s.slice(start, end) + (end < s.length ? '…' : '');
}

export function highlightSegments(text, terms) {
  if (!text) return [];
  const escTerms = (terms || [])
    .filter(Boolean)
    .map((t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(Boolean);
  if (!escTerms.length) return [{ text, match: false }];
  const re = new RegExp(`(${escTerms.join('|')})`, 'ig');
  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), match: false });
    parts.push({ text: m[0], match: true });
    last = m.index + m[0].length;
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false });
  return parts;
}

// Bare product-token matching that rejects false positives. Short bare
// tokens use word boundaries; multi-word / longer tokens use substring
// (low false-positive rate).
function productTermMatches(lowerVal, term) {
  if (term.length <= 4) {
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${esc}\\b`).test(lowerVal);
  }
  return lowerVal.includes(term);
}

// matchGroups: deterministic substring match across EVERY fetched record,
// grouped by company. "generic" sense keeps any group with >= 1 evidence hit
// — used when the goal is "surface every mention", not just expressed interest.
export function matchGroups(clauses, tableRecords, companyRecords, sense) {
  const companyMap = buildCompanyMap(
    companyRecords || (tableRecords && tableRecords.golden_companies) || [],
  );
  const groups = new Map();

  const toLower = (arr) =>
    (arr || [])
      .map((t) => String(t || '').trim())
      .filter(Boolean)
      .map((t) => t.toLowerCase());

  const wantOwnership = sense === 'ownership';
  const requireDual = sense === 'interest' || sense === 'demo' || sense === 'callback';

  for (const clause of clauses || []) {
    const table = clause.table;
    const records = tableRecords[table] || [];

    let productTerms;
    let intentTerms;
    if (requireDual) {
      productTerms = toLower(clause.terms).filter((t) => t.length >= 2);
      intentTerms = toLower(clause.variations).filter((t) => t.length >= 2);
    } else {
      const merged = toLower([...(clause.terms || []), ...(clause.variations || [])]);
      productTerms = merged.filter((t) => t.length >= 2);
      intentTerms = [];
    }
    if (!productTerms.length && intentTerms.length === 0) continue;

    for (const rec of records) {
      if (!rec || typeof rec !== 'object') continue;
      const { companyId, company, hubspotUrl, isCustomer, hasOwner } = resolveCompany(rec, table, companyMap);
      // Skip noisy orphan records — keep only records tied to a real, named
      // company. Leads/deals remain a deliberate exception: a lead/deal
      // record may legitimately exist before the company profile is fully
      // wired up in HubSpot.
      if (table !== 'leads' && table !== 'deals') {
        if (!companyId || !company || company === '(unknown)') continue;
      }
      const hits = [];
      let productHitCount = 0;
      let intentHitCount = 0;
      for (const [field, value] of Object.entries(rec)) {
        if (value === null || value === undefined || value === '') continue;
        if (SKIP_FIELDS.test(field)) continue;
        const sval = String(value);
        if (sval.length < 2 || sval.length > 6000) continue;
        if (!/[a-z]/i.test(sval)) continue;
        const lowerVal = sval.toLowerCase();
        const hasProduct = productTerms.some((t) => productTermMatches(lowerVal, t));
        const hasIntent =
          requireDual &&
          intentTerms.length > 0 &&
          intentTerms.some((t) => lowerVal.includes(t));
        if (!hasProduct && !hasIntent) continue;
        if (hasProduct) productHitCount++;
        if (hasIntent) intentHitCount++;
        hits.push({ field, sval, hasProduct, hasIntent });
      }

      if (productHitCount === 0 && intentHitCount === 0) continue;

      const key = companyId || company;
      if (!groups.has(key)) {
        groups.set(key, {
          company,
          companyId,
          hubspotUrl,
          isCustomer,
          hasOwner,
          evidences: [],
          senses: { ownership: 0, note: 0, other: 0 },
          productHits: 0,
          intentHits: 0,
        });
      }
      const g = groups.get(key);
      if (hubspotUrl && !g.hubspotUrl) g.hubspotUrl = hubspotUrl;
      if (g.isCustomer === false && isCustomer) g.isCustomer = true;

      const date = pickDate(rec);
      g.productHits += productHitCount;
      g.intentHits += intentHitCount;
      for (const hit of hits) {
        g.evidences.push({ table, field: hit.field, value: hit.sval, date });
      }
    }
  }

  const list = [];
  for (const g of groups.values()) {
    if (requireDual) {
      if (g.productHits === 0 || g.intentHits === 0) continue;
    } else if (wantOwnership) {
      if (g.senses.ownership === 0) continue;
    }
    const seen = new Set();
    g.evidences = g.evidences.filter((e) => {
      const k = `${e.table}|${e.field}|${e.value}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (g.evidences.length) list.push(g);
  }
  list.sort(
    (a, b) =>
      b.evidences.length - a.evidences.length || String(a.company).localeCompare(String(b.company)),
  );
  return list;
}
