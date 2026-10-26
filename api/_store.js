// Shared helpers for reading/writing the live menu state stored in Vercel
// Global Config (Edge Config). The store only ever holds ONE key,
// "menu_state", whose value is a small JSON object:
//
//   {
//     overrides:  { "<baseItemId>": { name?, category?, price?, photo?, available?, stock? }, ... },
//     newItems:   [ { id, name, category, price, photo, available, stock }, ... ],
//     deletedIds: [ <baseItemId>, ... ]
//   }
//
// Base item data (the original 159 menu items + their verified photos) lives
// in ./_data.js and is bundled with the function — it never changes at
// runtime. Only admin-driven changes go through Global Config, which keeps
// the store tiny (well under the 1MB limit) since photos for NEW/edited
// items are stored in Vercel Blob and only their URLs are kept here.

const EMPTY_STATE = { overrides: {}, newItems: [], deletedIds: [] };

function normalizeState(state) {
  if (!state || typeof state !== 'object') return { ...EMPTY_STATE };
  return {
    overrides: state.overrides && typeof state.overrides === 'object' ? state.overrides : {},
    newItems: Array.isArray(state.newItems) ? state.newItems : [],
    deletedIds: Array.isArray(state.deletedIds) ? state.deletedIds : [],
  };
}

// Fast, globally-cached read via the Global Config SDK. Good for the public
// menu endpoint. May lag up to ~10s behind the latest write.
async function readState() {
  const { get } = require('@vercel/global-config');
  const state = await get('menu_state');
  return normalizeState(state);
}

// Always-fresh read straight from the Vercel REST API. Used by the admin
// panel right after a write so the dashboard never shows stale data.
async function readStateFresh() {
  const id = process.env.EDGE_CONFIG_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  const token = process.env.VERCEL_API_TOKEN;
  if (!id || !token) throw new Error('Missing EDGE_CONFIG_ID / VERCEL_API_TOKEN env vars');
  const url = `https://api.vercel.com/v1/global-config/${id}/items?teamId=${encodeURIComponent(teamId || '')}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Global Config read failed: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  const arr = Array.isArray(data) ? data : (data.items || []);
  const found = arr.find((it) => it.key === 'menu_state');
  return normalizeState(found && found.value);
}

async function writeState(state) {
  const id = process.env.EDGE_CONFIG_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  const token = process.env.VERCEL_API_TOKEN;
  if (!id || !token) throw new Error('Missing EDGE_CONFIG_ID / VERCEL_API_TOKEN env vars');
  const url = `https://api.vercel.com/v1/global-config/${id}/items?teamId=${encodeURIComponent(teamId || '')}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [{ operation: 'upsert', key: 'menu_state', value: normalizeState(state) }],
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Global Config write failed: ${resp.status} ${text}`);
  }
  return resp.json();
}

module.exports = { readState, readStateFresh, writeState, normalizeState, EMPTY_STATE };
