// Exact access allowlist for this app. No domain wildcard, no admin bypass.
// Keep in sync with the ALLOWED_EMAILS set in base44/functions/fetchGoldenData/entry.ts.
export const ALLOWED_EMAILS = [
  'elpaccogames@gmail.com',
  'carson@hellopearl.com',
  'porter@hellopearl.com',
];

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export const isAllowedEmail = (email) => {
  const e = normalizeEmail(email);
  return e.length > 0 && ALLOWED_EMAILS.includes(e);
};
