/**
 * Google Drive integration (Option A: public folders, no API key).
 *
 * Each car has a `Link Drive` field pointing to a public Drive folder.
 *
 * Strategy:
 *   1. Fetch the public folder HTML
 *   2. Find all quoted strings that look like Drive file IDs
 *   3. Drive file IDs are typically EXACTLY 33 characters (sometimes 28),
 *      composed of [A-Za-z0-9_-]. We require an exact length match to avoid
 *      capturing internal tokens, nonces, etc. that happen to start with the
 *      right characters.
 *   4. Filter out the folder ID itself and Google API keys.
 *   5. Drive IDs typically start with "1" or "0". Internal tokens often don't.
 *   6. Count occurrences. Real files appear 2+ times in the HTML.
 *   7. Sort by order of first appearance (matches Drive's display order).
 *   8. COVER PRIORITY: files named with a numeric prefix (e.g. "00-capa.jpg",
 *      "01_frente.png") are pulled to the front in numeric order. This lets
 *      the user choose the cover photo by naming it 00- in Drive, without
 *      having to rename every other file.
 *
 * Required: folder must be shared as "Anyone with the link can view".
 */

const cache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Drive file IDs are commonly 33 chars; older or some other types are 28.
// We accept both. Anything else is rejected as noise.
const FILE_ID_LENGTHS = new Set([28, 33]);

export function extractFolderId(url) {
  if (!url) return null;
  let m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return null;
}

function imageUrl(fileId, size = 1600) {
  return `https://lh3.googleusercontent.com/d/${fileId}=w${size}`;
}

function parseFolderHtml(html, folderId) {
  // Match any 20-50 char alphanumeric/underscore/dash inside quotes.
  // We'll filter by length and pattern further down.
  const idRegex = /"([a-zA-Z0-9_-]{20,50})"/g;

  const counts = new Map();
  const firstSeen = new Map();
  let m;
  let idx = 0;
  while ((m = idRegex.exec(html)) !== null) {
    const id = m[1];
    // Length must be exactly 28 or 33 (Drive file ID lengths)
    if (!FILE_ID_LENGTHS.has(id.length)) continue;
    // Skip the folder ID itself
    if (id === folderId) continue;
    // Skip API keys
    if (id.startsWith('AIza')) continue;
    // Drive file IDs start with a digit (almost always 1, occasionally 0)
    if (!/^[01]/.test(id)) continue;
    // Must contain a mix of upper and lower OR digits — purely lowercase
    // strings of this length are usually CSS class names / hashes.
    if (!/[A-Z]/.test(id) && !/[0-9].*[0-9]/.test(id)) continue;

    counts.set(id, (counts.get(id) || 0) + 1);
    if (!firstSeen.has(id)) {
      firstSeen.set(id, idx);
      idx++;
    }
  }

  const fileIds = [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .map(([id]) => id)
    .sort((a, b) => firstSeen.get(a) - firstSeen.get(b));

  // --- Cover priority pass ---
  // The user can name a file with a "00-" or "01-" prefix to mark it as the
  // cover (and "02-", "03-", etc. for a custom order at the front). We look
  // up each file ID in the HTML and check the surrounding text for the
  // filename pattern. Files with a numeric prefix are pulled to the front,
  // sorted by their prefix number. Other files keep their original order.
  function findFilenamePrefix(id) {
    // The filename usually appears within ~500 chars of the file ID.
    // We look for patterns like ,"00-frente.jpg", or ,"01.jpg",
    // tolerating various separators after the number.
    const idIdx = html.indexOf(`"${id}"`);
    if (idIdx === -1) return null;
    const window = html.substr(Math.max(0, idIdx - 100), 600);
    // Look for a filename ending in a common image extension, with the
    // file beginning by 1-3 digits then a separator.
    const fnRegex = /"(\d{1,3})[\s._-][^"]{0,80}\.(?:jpe?g|png|webp|heic|heif)"/gi;
    let match;
    let best = null;
    while ((match = fnRegex.exec(window)) !== null) {
      const num = parseInt(match[1], 10);
      if (Number.isFinite(num)) {
        if (best === null || num < best) best = num;
      }
    }
    return best;
  }

  const withPrefix = [];
  const withoutPrefix = [];
  for (const id of fileIds) {
    const prefix = findFilenamePrefix(id);
    if (prefix !== null) {
      withPrefix.push({ id, prefix });
    } else {
      withoutPrefix.push(id);
    }
  }
  withPrefix.sort((a, b) => a.prefix - b.prefix);

  return [...withPrefix.map((x) => x.id), ...withoutPrefix];
}

async function fetchFolderHtml(folderId) {
  const url = `https://drive.google.com/drive/folders/${folderId}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

export async function extractDriveImages(driveUrl) {
  const folderId = extractFolderId(driveUrl);
  if (!folderId) return [];

  const cached = cache.get(folderId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.images;
  }

  let images = [];
  try {
    const html = await fetchFolderHtml(folderId);
    const ids = parseFolderHtml(html, folderId);
    images = ids.map((id) => imageUrl(id));
  } catch (err) {
    console.warn(`[drive] failed for ${folderId}: ${err.message}`);
  }

  cache.set(folderId, { images, at: Date.now() });
  return images;
}
