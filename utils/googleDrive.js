// Uploads via Google Drive API v3, authenticated as the connected Google
// account (OAuth refresh token) rather than a service account — sidesteps
// the Workspace admin policy that blocks sharing folders with an "external"
// (non-org) service-account email.
//
// Files are kept private on Drive (this Workspace also blocks "anyone with
// the link" sharing — publishOutNotPermitted) — the app serves them through
// its own /api/media/drive/:fileId proxy route instead, which fetches from
// Drive server-side using this same token and streams the bytes back.
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const FILES_URL = "https://www.googleapis.com/drive/v3/files";

let cachedToken = null;
let cachedExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedExpiry - 60000) return cachedToken;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Google token refresh failed: ${JSON.stringify(data)}`);

  cachedToken = data.access_token;
  cachedExpiry = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

function isConfigured() {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  );
}

// Uploads a buffer to the configured Drive folder and returns a URL served
// by this app's own proxy route (see routes/media.js) — works as a normal
// <img src> or link either way, no public Drive sharing needed.
async function uploadToDrive({ buffer, filename, mimeType, folderId }) {
  const accessToken = await getAccessToken();
  const targetFolderId = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
  const metadata = { name: filename, parents: targetFolderId ? [targetFolderId] : undefined };

  const boundary = "hh_archive_boundary";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(`${UPLOAD_URL}?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const data = await res.json();
  if (!data.id) throw new Error(`Drive upload failed: ${JSON.stringify(data)}`);

  const base = process.env.SERVER_BASE_URL || "";
  const url = `${base}/api/media/drive/${data.id}`;
  return { fileId: data.id, url };
}

// Streams a Drive file's bytes through this server (authenticated with our
// own token), used by the /api/media/drive/:fileId proxy route.
async function fetchDriveFile(fileId) {
  const accessToken = await getAccessToken();
  const res = await fetch(`${FILES_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Drive fetch failed (${res.status}) for file ${fileId}`);
  return res;
}

module.exports = { uploadToDrive, fetchDriveFile, isConfigured };
