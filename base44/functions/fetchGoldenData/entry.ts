import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const ALLOWED_TABLES = new Set([
  'golden_companies',
  'contacts',
  'deals',
  'tickets',
  'leads',
  'activities',
  'owners',
  'pipeline_stages',
  'merge_log',
]);

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;

const safeError = (message, status = 400) =>
  Response.json({ error: message }, { status });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return safeError('Unauthorized', 401);

    // Exact allowlist — no domain wildcard, no admin bypass. Keep in sync with
    // the ALLOWED_EMAILS list in src/lib/allowlist.js.
    const ALLOWED_EMAILS = new Set([
      'elpaccogames@gmail.com',
      'carson@hellopearl.com',
      'porter@hellopearl.com',
    ]);
    const email = String(user.email || '').trim().toLowerCase();
    if (!ALLOWED_EMAILS.has(email)) {
      return safeError('Forbidden: account not allowlisted', 403);
    }

    let body: any = {};
    if (req.method === 'POST' || req.method === 'PUT') {
      try {
        body = await req.json();
      } catch {
        // allow empty body for GET-style POSTs
      }
    } else if (req.method === 'GET') {
      try {
        const url = new URL(req.url);
        for (const [k, v] of url.searchParams.entries()) body[k] = v;
      } catch {
        // ignore
      }
    }

    const table = String(body.table || '').trim();
    if (!table) return safeError('Missing "table"');
    if (!ALLOWED_TABLES.has(table)) {
      return safeError(`Unsupported table: ${table}`);
    }

    // Pagination
    let limit = Number.isFinite(Number(body.limit)) ? Math.floor(Number(body.limit)) : DEFAULT_LIMIT;
    if (limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;
    let page = Number.isFinite(Number(body.page)) ? Math.floor(Number(body.page)) : 1;
    if (page < 1) page = 1;

    const search = typeof body.search === 'string' ? body.search.trim() : '';
    const filters = body.filters && typeof body.filters === 'object' && !Array.isArray(body.filters) ? body.filters : null;

    const apiUrl = Deno.env.get('GOLDEN_API_URL');
    const apiKey = Deno.env.get('GOLDEN_API_KEY');
    if (!apiUrl || !apiKey) {
      return safeError('Server not configured', 500);
    }

    const base = apiUrl.replace(/\/+$/, '');
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('page', String(page));
    if (search) params.set('search', search);

    if (filters) {
      for (const [fKey, fVal] of Object.entries(filters)) {
        const key = String(fKey).trim();
        if (!key) continue;
        const t = typeof fVal;
        if (t === 'string' || t === 'number' || t === 'boolean') {
          params.set(`filter_${encodeURIComponent(key)}`, String(fVal));
        } else if (Array.isArray(fVal) && fVal.length) {
          params.set(`filter_${encodeURIComponent(key)}`, fVal.map(String).join(','));
        }
      }
    }

    const target = `${base}/api/${encodeURIComponent(table)}?${params.toString()}`;

    const upRes = await fetch(target, {
      headers: {
        'x-api-key': apiKey,
        Accept: 'application/json',
        'User-Agent': 'Base44/fetchGoldenData',
      },
      // Railway should never return 304 to a proxy fetching fresh data.
      method: body.method === 'POST' ? 'POST' : 'GET',
    });

    if (!upRes.ok) {
      // Surface status + reason only — never the body (could leak credentials/payload).
      const status = upRes.status >= 400 && upRes.status < 600 ? upRes.status : 502;
      return Response.json({ error: `Upstream ${status}`, upstream_reason: upRes.statusText, upstream_path: target.replace(apiKey, '***') }, { status });
    }

    const contentType = upRes.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return safeError('Upstream returned non-JSON response', 502);
    }

    let data: any;
    try {
      data = await upRes.json();
    } catch {
      return safeError('Upstream returned invalid JSON', 502);
    }

    // Normalize: unwrap any upstream envelope ({ data: [...] } or { results: [...] }),
    // shipping only the requested paginated rows back to the browser.
    let rows: any[] = [];
    let total: any = undefined;
    if (Array.isArray(data)) {
      rows = data;
    } else if (data && typeof data === 'object') {
      const arr = Array.isArray(data.results) ? data.results : (Array.isArray(data.data) ? data.data : []);
      rows = arr;
      total = data.total ?? data.count ?? undefined;
    }
    const userFacingPayload = { table, page, limit, results: rows, count: rows.length, total };

    return Response.json(userFacingPayload);
  } catch (error) {
    return safeError('Request failed', 500);
  }
});
