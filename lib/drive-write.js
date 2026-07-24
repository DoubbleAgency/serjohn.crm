/**
 * Google Drive write operations using a service account.
 *
 * Setup required (one-time):
 *   1. Create a Google Cloud project (free)
 *   2. Enable the Drive API on that project
 *   3. Create a Service Account, download its JSON key
 *   4. Set GOOGLE_SERVICE_ACCOUNT_JSON env var to the entire JSON contents
 *   5. Share the parent Drive folder ("Carros") with the service account's
 *      email (it looks like xyz@project-name.iam.gserviceaccount.com),
 *      giving "Editor" access
 *   6. Set DRIVE_PARENT_FOLDER_ID to that parent folder's ID
 *
 * Used by /api/import-from-mobile to create a folder per imported car and
 * upload photos scraped from mobile.de.
 */

import { google } from 'googleapis';

let driveClient = null;

function getDrive() {
  if (driveClient) return driveClient;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');

  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch (err) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

/**
 * Create a new folder under DRIVE_PARENT_FOLDER_ID and return its ID + share URL.
 */
export async function createCarFolder(name) {
  const parent = process.env.DRIVE_PARENT_FOLDER_ID;
  if (!parent) throw new Error('DRIVE_PARENT_FOLDER_ID is not set');

  const drive = getDrive();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parent],
    },
    fields: 'id',
  });

  const folderId = res.data.id;

  // Make folder publicly readable so the website can read it without auth
  await drive.permissions.create({
    fileId: folderId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  const url = `https://drive.google.com/drive/folders/${folderId}`;
  return { id: folderId, url };
}

/**
 * Download a remote image URL and upload it to the given Drive folder.
 * Returns the new file ID on Drive.
 */
export async function uploadImageFromUrl({ folderId, url, filename }) {
  const drive = getDrive();

  // Fetch the source image
  const res = await fetch(url, {
    headers: {
      // Some sites (including mobile.de's CDN) require a normal browser UA
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`fetch ${url}: HTTP ${res.status}`);

  // Convert response stream to a Node-compatible readable
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Determine mime type (default to JPEG)
  const ct = res.headers.get('content-type') || 'image/jpeg';
  const mimeType = ct.split(';')[0].trim();

  // Use the Readable stream API of Node
  const { Readable } = await import('stream');
  const stream = Readable.from(buffer);

  const upload = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id',
  });

  return upload.data.id;
}

/**
 * Upload a batch of image URLs to a Drive folder, with filenames numbered
 * to guarantee a stable order (and to make the first one the cover photo).
 *
 * Returns array of { url, fileId, ok } results — failures don't abort.
 */
export async function uploadImagesToFolder({ folderId, imageUrls, prefix = '' }) {
  const results = [];
  // Pad numbers so alphabetical sort matches numerical
  const pad = String(imageUrls.length).length;

  for (let i = 0; i < imageUrls.length; i++) {
    const num = String(i + 1).padStart(pad, '0');
    const filename = `${num}-${prefix || 'foto'}.jpg`;
    try {
      const fileId = await uploadImageFromUrl({
        folderId,
        url: imageUrls[i],
        filename,
      });
      results.push({ url: imageUrls[i], fileId, ok: true });
    } catch (err) {
      results.push({ url: imageUrls[i], ok: false, error: err.message });
    }
  }
  return results;
}
