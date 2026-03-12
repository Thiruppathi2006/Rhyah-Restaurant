export function relatedImageUrl(name) {
  const q = (name || '').trim();
  if (!q) return '';
  // Uses Unsplash Source endpoint (no API key) to fetch a relevant image.
  // If offline or blocked, callers should fall back to placeholderDataUrl().
  const query = encodeURIComponent(`${q},food,South Indian`);
  return `https://source.unsplash.com/640x420/?${query}`;
}

export function placeholderDataUrl(label) {
  const safe = (label || '').slice(0, 18);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
        <stop stop-color="#1a2133" offset="0"/>
        <stop stop-color="#0f1420" offset="1"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="52%" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto" font-size="44" fill="#e9eefc" opacity="0.9">${escapeXml(safe)}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','\"':'&quot;' }[c] || c));
}

