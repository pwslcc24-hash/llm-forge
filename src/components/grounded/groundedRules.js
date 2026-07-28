// Evidence-snippet helpers used to render the matched CBCT/3D text on each
// company card: pull the text immediately around a matched term, and split
// it into highlight/non-highlight segments for rendering.

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
