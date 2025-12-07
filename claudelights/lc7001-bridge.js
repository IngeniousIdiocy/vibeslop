const http = require('http');
const net = require('net');
const url = require('url');

// --------- CONFIG ---------
const LC_HOST = '192.168.1.63';     // LC7001 IP
const LC_PORT = 2112;               // LC7001 TCP API port
const HTTP_PORT = 3000;             // HTTP port for Shortcuts/Siri
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Require Node 18+ for global fetch
if (typeof fetch === 'undefined') {
  console.error('This script requires Node 18+ with global fetch.');
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.warn('[WARN] ANTHROPIC_API_KEY not set. /nl endpoint will throw until you set it.');
}

// --------- LC7001 TCP HANDLING ---------

let socket = null;
let buffer = '';
let nextId = 1;
const pending = new Map();        // id -> {resolve, reject}
const zones = new Map();          // ZID -> { ZID, Name, DeviceType, PowerLevel, Power }

function connectLC7001() {
  if (socket) socket.destroy();

  socket = net.createConnection({ host: LC_HOST, port: LC_PORT }, () => {
    console.log(`[LC7001] Connected to ${LC_HOST}:${LC_PORT}`);
    refreshZones().catch(err => console.error('[LC7001] refreshZones error:', err.message));
  });

  socket.on('data', (data) => {
    buffer += data.toString('utf8');
    const messages = extractJsonMessages(buffer);
    // extractJsonMessages returns { messages, remaining }
    buffer = messages.remaining;

    for (const part of messages.messages) {
      try {
        const msg = JSON.parse(part);
        handleMessage(msg);
      } catch (e) {
        console.error('[LC7001] Failed to parse JSON message:', e.message, 'raw:', part);
      }
    }
  });

  socket.on('error', (err) => {
    console.error('[LC7001] Socket error:', err.message);
  });

  socket.on('close', () => {
    console.error('[LC7001] Socket closed. Reconnecting in 5s...');
    setTimeout(connectLC7001, 5000);
  });
}

/**
 * Extract complete top-level JSON objects from a stream.
 * We treat any sequence from the first '{' at depth 0 to the matching '}' at depth 0 as a full JSON object.
 * '\0' bytes are ignored (they're just delimiters from LC7001).
 */
function extractJsonMessages(buf) {
  const messages = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;

  for (let i = 0; i < buf.length; i++) {
    let ch = buf[i];

    // Ignore null delimiters — they don't appear inside JSON
    if (ch === '\u0000') {
      continue;
    }

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\') {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (ch === '{') {
        if (depth === 0) {
          start = i;
        }
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          const jsonStr = buf.slice(start, i + 1);
          messages.push(jsonStr);
          start = -1;
        }
      }
    }
  }

  let remaining = '';
  if (depth > 0 && start !== -1) {
    // We have an incomplete JSON object from 'start' to end; keep it in buffer
    remaining = buf.slice(start);
  }

  return { messages, remaining };
}

function sendCommand(service, extra = {}) {
  return new Promise((resolve, reject) => {
    if (!socket || socket.destroyed) {
      return reject(new Error('Socket not connected to LC7001'));
    }
    const id = nextId++;
    const payload = { ID: id, Service: service, ...extra };
    const json = JSON.stringify(payload);
    pending.set(id, { resolve, reject });

    socket.write(json + '\u0000', (err) => {
      if (err) {
        pending.delete(id);
        reject(err);
      }
    });
  });
}

function handleMessage(msg) {
  const id = msg.ID;

  // Broadcasts: ID 0 or undefined
  if (id === 0 || typeof id === 'undefined') {
    if (msg.Service === 'ZonePropertiesChanged') {
      const zid = msg.ZID;
      const pl = msg.PropertyList || {};
      const existing = zones.get(zid) || { ZID: zid };
      zones.set(zid, { ...existing, ...pl });
    }
    return;
  }

  const entry = pending.get(id);
  if (entry) {
    pending.delete(id);
    if (msg.Status && String(msg.Status).toLowerCase().startsWith('error')) {
      console.error('[LC7001] Error response:', JSON.stringify(msg));
      entry.reject(new Error(msg.Status + (msg.ErrorMessage ? ': ' + msg.ErrorMessage : '')));
    } else {
      entry.resolve(msg);
    }
  }
}

// --------- ZONES / LIGHT CONTROL ---------

async function refreshZones() {
  console.log('[LC7001] Refreshing zones...');
  zones.clear();

  const listResp = await sendCommand('ListZones', {});
  const zoneList = (listResp.ZoneList || []).map(z => z.ZID);

  for (const zid of zoneList) {
    try {
      const resp = await sendCommand('ReportZoneProperties', { ZID: zid });
      const pl = resp.PropertyList || {};
      zones.set(zid, { ZID: zid, ...pl });
    } catch (e) {
      console.error(`[LC7001] Failed to get properties for zone ${zid}:`, e.message);
    }
  }

  console.log('[LC7001] Zones discovered:');
  for (const [zid, z] of zones.entries()) {
    console.log(`  ZID ${zid}: ${z.Name || '(unnamed)'} (${z.DeviceType || 'Unknown'})`);
  }
}

async function setZonePower(zid, on) {
  const z = zones.get(zid) || { ZID: zid };
  
  // LC7001 API: PowerLevel must be 1-100, Power is boolean on/off
  // To turn off: just set Power: false (don't set PowerLevel to 0)
  // To turn on: set Power: true and optionally PowerLevel
  let pl;
  if (on) {
    const lvl = (typeof z.PowerLevel === 'number' && z.PowerLevel > 0) ? z.PowerLevel : 100;
    pl = { Power: true, PowerLevel: lvl };
  } else {
    pl = { Power: false };
  }

  const resp = await sendCommand('SetZoneProperties', {
    ZID: zid,
    PropertyList: pl,
  });

  try {
    const r = await sendCommand('ReportZoneProperties', { ZID: zid });
    const pl2 = r.PropertyList || {};
    zones.set(zid, { ZID: zid, ...pl2 });
  } catch (e) {
    console.error(`[LC7001] Failed to refresh zone ${zid} after power change:`, e.message);
  }

  return resp;
}

async function setZoneLevel(zid, level) {
  const lvl = Math.max(0, Math.min(100, Number(level)));
  
  // LC7001 API: PowerLevel must be 1-100, Power is boolean on/off
  // To turn off: set Power: false (PowerLevel doesn't matter)
  // To turn on at level: set Power: true AND PowerLevel: 1-100
  let pl;
  if (lvl === 0) {
    pl = { Power: false };
  } else {
    pl = { Power: true, PowerLevel: lvl };
  }

  console.log(`[LC7001] setZoneLevel ZID=${zid} level=${lvl} PropertyList=`, JSON.stringify(pl));
  const resp = await sendCommand('SetZoneProperties', {
    ZID: zid,
    PropertyList: pl,
  });
  console.log(`[LC7001] setZoneLevel response:`, JSON.stringify(resp));

  try {
    const r = await sendCommand('ReportZoneProperties', { ZID: zid });
    const pl2 = r.PropertyList || {};
    zones.set(zid, { ZID: zid, ...pl2 });
  } catch (e) {
    console.error(`[LC7001] Failed to refresh zone ${zid} after level change:`, e.message);
  }

  return resp;
}

// --------- ANTHROPIC / LLM PLANNER ---------

async function planFromNL(command) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set in environment.');
  }

  const zoneSummary = Array.from(zones.values()).map(z => ({
    id: z.ZID,
    name: z.Name || null,
    deviceType: z.DeviceType || null,
  }));

  const systemPrompt = `
You are a planner that translates natural language lighting requests into concrete zone commands.

You are given:
- A list of zones (dimmable lights), each with an integer id and name.
- A user "command" string.

Your job:
- Decide which zones should change and to what brightness level.
- brightness 0 means turn OFF the light.
- brightness 1-100 means turn ON at that percentage level.
- If the user says things like "kitchen lights", apply to ALL zones whose name clearly matches that concept (e.g. contains "Kitchen").
- If they say "office", apply to all zones whose name contains "Office".
- If they say "living room", match zones with "Living Room" in the name, etc.
- "turn off" or "off" → brightness = 0
- "turn on" or "on" (no level specified) → brightness = 100
- "dim" → brightness = 30
- "50 percent" or "half" → brightness = 50

Output STRICTLY valid JSON with this schema and nothing else (no markdown, no code fences):

{
  "actions": [
    {
      "zone_ids": [INT, INT, ...],
      "brightness": INT_0_TO_100
    }
  ]
}

Do not invent zone ids beyond those provided. If nothing should happen, return { "actions": [] }.
`;

  const body = {
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    temperature: 0,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({
          command,
          zones: zoneSummary,
        }),
      },
    ],
  };

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  const textBlock =
    data &&
    Array.isArray(data.content) &&
    data.content[0] &&
    data.content[0].text;

  if (typeof textBlock !== 'string') {
    throw new Error('Unexpected Anthropic response shape.');
  }

  // Strip markdown code blocks if present (e.g., ```json ... ```)
  let jsonText = textBlock.trim();
  if (jsonText.startsWith('```')) {
    // Remove opening ```json or ``` and closing ```
    jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim();
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error('Failed to parse LLM JSON: ' + e.message + ' raw=' + textBlock);
  }

  if (!parsed.actions || !Array.isArray(parsed.actions)) {
    parsed.actions = [];
  }

  parsed.actions = parsed.actions
    .map(a => ({
      zone_ids: Array.isArray(a.zone_ids)
        ? a.zone_ids.filter(n => Number.isInteger(n))
        : [],
      brightness: Math.max(0, Math.min(100, Number(a.brightness))),
    }))
    .filter(a => a.zone_ids.length > 0 && Number.isFinite(a.brightness));

  return parsed;
}

// --------- HTTP SERVER ---------

function sendJson(res, statusCode, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname || '/';
  const method = req.method || 'GET';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  try {
    // GET /zones
    if (method === 'GET' && path === '/zones') {
      const list = [];
      for (const [zid, z] of zones.entries()) {
        list.push({
          id: zid,
          name: z.Name || null,
          deviceType: z.DeviceType || null,
          powerLevel: z.PowerLevel ?? null,
          power: typeof z.Power === 'boolean' ? z.Power : null,
        });
      }
      return sendJson(res, 200, { zones: list });
    }

    // POST /zone/:id/on
    if (method === 'POST' && /^\/zone\/\d+\/on$/.test(path)) {
      const zid = parseInt(path.split('/')[2], 10);
      await setZonePower(zid, true);
      return sendJson(res, 200, { ok: true, zone: zid, state: 'on' });
    }

    // POST /zone/:id/off
    if (method === 'POST' && /^\/zone\/\d+\/off$/.test(path)) {
      const zid = parseInt(path.split('/')[2], 10);
      await setZonePower(zid, false);
      return sendJson(res, 200, { ok: true, zone: zid, state: 'off' });
    }

    // POST /zone/:id/level  { "level": 0-100 }
    if (method === 'POST' && /^\/zone\/\d+\/level$/.test(path)) {
      const zid = parseInt(path.split('/')[2], 10);
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = body ? JSON.parse(body) : {};
          const level = payload.level;
          if (typeof level === 'undefined') {
            return sendJson(res, 400, { error: 'Missing "level" in JSON body' });
          }
          await setZoneLevel(zid, level);
          return sendJson(res, 200, { ok: true, zone: zid, level });
        } catch (e) {
          console.error('[HTTP] /zone/:id/level error:', e.message);
          return sendJson(res, 500, { error: e.message });
        }
      });
      return;
    }

    // POST /nl  { "command": "set kitchen and living room..." }
    if (method === 'POST' && path === '/nl') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = body ? JSON.parse(body) : {};
          const command = String(payload.command || '').trim();
          if (!command) {
            return sendJson(res, 400, { error: 'Missing "command" string in JSON body' });
          }

          console.log('[NL] Command:', command);
          const plan = await planFromNL(command);
          console.log('[NL] Plan:', JSON.stringify(plan));

          const results = [];
          for (const action of plan.actions) {
            for (const zid of action.zone_ids) {
              try {
                await setZoneLevel(zid, action.brightness);
                const z = zones.get(zid);
                results.push({
                  zone_id: zid,
                  name: z ? z.Name : null,
                  brightness: action.brightness,
                });
              } catch (e) {
                console.error(`[NL] Failed to set zone ${zid}:`, e.message);
                results.push({
                  zone_id: zid,
                  error: e.message,
                });
              }
            }
          }

          return sendJson(res, 200, {
            ok: true,
            command,
            actions: results,
          });
        } catch (e) {
          console.error('[HTTP] /nl error:', e.message);
          return sendJson(res, 500, { error: e.message });
        }
      });
      return;
    }

    // Fallback
    sendJson(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error('[HTTP] Handler error:', e.message);
    sendJson(res, 500, { error: e.message });
  }
});

// --------- STARTUP ---------

server.listen(HTTP_PORT, () => {
  console.log(`[HTTP] LC7001 bridge listening on http://0.0.0.0:${HTTP_PORT}`);
});

connectLC7001();
