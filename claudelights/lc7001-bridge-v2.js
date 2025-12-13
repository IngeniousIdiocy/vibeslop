#!/usr/bin/env node
/**
 * LC7001 Lighting Bridge — Standalone server with Claude AI integration
 *
 * Features:
 * ✅ Persistent socket to LC7001 (handles Hello V1 challenge + [SETKEY])
 * ✅ Live updates: ZonePropertiesChanged + ZoneAdded/ZoneDeleted
 * ✅ Hourly polling zone refresh to self-heal missed updates
 * ✅ Job system: schedules + effects + scripts (start/stop/list)
 * ✅ Effects: pulse/strobe/breathe/ramp
 * ✅ "Creative mode": sandboxed JS lighting scripts
 * ✅ HTTP API with /nl endpoint (Claude-powered natural language)
 * ✅ MCP server (HTTP+SSE) for network AI agents (optional)
 *
 * ---- ENV ----
 * LC7001_HOST / LC7001_IP   (required) Controller IP address
 * LC7001_PORT               (default 2112)
 * LC7001_PASSWORD           (optional; used to derive key = MD5(password))
 * LC7001_KEY                (optional; 32-hex key; overrides password)
 * LC7001_SETKEY_PASSWORD    (optional; only if controller boots into [SETKEY] mode)
 * LC7001_DELIMITER          ("null" default | "newline") JSON message terminator
 *
 * ANTHROPIC_API_KEY         (required for /nl endpoint)
 * ANTHROPIC_MODEL           (default "claude-haiku-4-5")
 * MAX_TOOL_ITERATIONS       (default 100)
 *
 * HTTP_PORT                 (default 3080; set to 0 to disable)
 * MCP_PORT                  (default 3081; set to 0 to disable)
 *
 * ZONE_REFRESH_INTERVAL_MS  (default 3600000 = 1 hour)
 * REQUEST_TIMEOUT_MS        (default 5000)
 * CONNECT_TIMEOUT_MS        (default 5000)
 * COMMAND_SPACING_MS        (default 35)
 * LOG_LEVEL                 (debug|info|warn|error) default info
 */

'use strict';

const net = require('net');
const crypto = require('crypto');
const http = require('http');
const vm = require('vm');
const { EventEmitter } = require('events');

/* ----------------------------- small utilities ---------------------------- */

function envStr(...names) {
  for (const n of names) {
    const v = process.env[n];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return undefined;
}
function envInt(name, def) {
  const v = process.env[name];
  if (v == null || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}
function nowIso() {
  return new Date().toISOString();
}
function newId(prefix = 'job') {
  if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
function clamp(n, lo, hi) {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
function sleepMs(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Object.assign(new Error('Aborted'), { code: 'ABORTED' }));
    const t = setTimeout(() => resolve(), ms);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          reject(Object.assign(new Error('Aborted'), { code: 'ABORTED' }));
        },
        { once: true }
      );
    }
  });
}

function createLogger() {
  const level = (process.env.LOG_LEVEL || 'info').toLowerCase();
  const order = { debug: 10, info: 20, warn: 30, error: 40 };
  const threshold = order[level] ?? order.info;

  function log(lvl, ...args) {
    const sev = order[lvl] ?? 20;
    if (sev < threshold) return;
    const line = `[${nowIso()}] [${lvl.toUpperCase()}]`;
    console.log(line, ...args);
  }
  return {
    debug: (...a) => log('debug', ...a),
    info: (...a) => log('info', ...a),
    warn: (...a) => log('warn', ...a),
    error: (...a) => log('error', ...a),
  };
}

const log = createLogger();

/* ------------------------ LC7001 crypto helpers --------------------------- */

function md5KeyFromPassword(password) {
  return crypto.createHash('md5').update(password, 'utf8').digest();
}

function parseHexKeyMaybe(hex) {
  if (!hex) return undefined;
  const cleaned = hex.trim();
  if (!/^[0-9a-fA-F]{32}$/.test(cleaned)) return undefined;
  return Buffer.from(cleaned, 'hex');
}

function aes128EcbEncryptNoPadding(block16, key16) {
  if (!Buffer.isBuffer(block16) || block16.length !== 16) {
    throw new Error(`AES input must be 16 bytes, got ${block16?.length}`);
  }
  if (!Buffer.isBuffer(key16) || key16.length !== 16) {
    throw new Error(`AES key must be 16 bytes, got ${key16?.length}`);
  }
  const cipher = crypto.createCipheriv('aes-128-ecb', key16, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(block16), cipher.final()]);
}

/* ----------------------------- LC7001 client ------------------------------ */

class LC7001Client extends EventEmitter {
  constructor(opts) {
    super();
    this.host = opts.host;
    this.port = opts.port;
    this.key = opts.key;
    this.setKeyPassword = opts.setKeyPassword;
    this.delimiter = opts.delimiter;
    this.requestTimeoutMs = opts.requestTimeoutMs;
    this.connectTimeoutMs = opts.connectTimeoutMs;
    this.commandSpacingMs = opts.commandSpacingMs;

    this._socket = null;
    this._buffer = '';
    this._shouldRun = false;
    this._connecting = false;

    this._ready = false;
    this._authMode = 'unknown';
    this._seenFirstJson = false;

    // The LC7001 appears to ignore requests when IDs grow large (>~65k). Keep IDs
    // in a small range like the working v1 bridge. Start at 1 so the first sent ID matches v1.
    this._requestId = 1;
    this._pending = new Map();

    this.zones = new Map();
  }

  isReady() {
    return this._ready && this._socket && !this._socket.destroyed;
  }

  start() {
    if (this._shouldRun) return;
    this._shouldRun = true;
    this._connectLoop().catch((e) => log.error('connect loop crashed', e));
  }

  stop() {
    this._shouldRun = false;
    this._ready = false;
    try {
      this._socket?.destroy();
    } catch {}
    this._socket = null;
  }

  async _connectLoop() {
    let backoffMs = 500;
    while (this._shouldRun) {
      // If we already have a live socket (even if not marked ready yet), wait.
      if (this._socket && !this._socket.destroyed) {
        await sleepMs(500, undefined).catch(() => {});
        continue;
      }
      if (this._connecting) {
        await sleepMs(500, undefined).catch(() => {});
        continue;
      }

      this._connecting = true;
      try {
        await this._connectOnce();
        backoffMs = 500;
      } catch (e) {
        this._ready = false;
        this._authMode = 'unknown';
        this._seenFirstJson = false;
        log.warn(`LC7001 connect failed: ${e?.message || e}. Retrying in ${backoffMs}ms...`);
        await sleepMs(backoffMs).catch(() => {});
        backoffMs = clamp(backoffMs * 1.7, 500, 15000);
      } finally {
        this._connecting = false;
      }
    }
  }

  _connectOnce() {
    return new Promise((resolve, reject) => {
      // Use the same simple connection style as the v1 bridge
      const socket = net.createConnection({ host: this.host, port: this.port }, () => {
        log.info(`LC7001 connected to ${this.host}:${this.port}`);
        this.emit('connected');
        resolve();
      });

      this._socket = socket;
      this._buffer = '';
      this._ready = false;
      this._authMode = 'unknown';
      this._seenFirstJson = false;

      socket.on('data', (buf) => this._onData(buf));
      socket.on('error', (err) => {
        log.warn('LC7001 socket error:', err?.message || err);
      });
      socket.on('close', () => {
        const wasReady = this._ready;
        this._ready = false;
        this._authMode = 'unknown';
        this._seenFirstJson = false;
        this._socket = null;
        this._rejectAllPending(new Error('Socket closed'));

        log.warn('LC7001 socket closed');
        this.emit('disconnected', { wasReady });
      });
    });
  }

  _rejectAllPending(err) {
    for (const [id, p] of this._pending.entries()) {
      clearTimeout(p.timeout);
      p.reject(err);
      this._pending.delete(id);
    }
  }

  _onData(buf) {
    const chunk = buf.toString('utf8');
    log.debug(`[LC7001 RX RAW] ${chunk.replace(/\0/g, '<NUL>').slice(0, 300)}`);
    this._buffer += chunk;

    // Use the simple brace-counting extractor like the v1 bridge
    const extracted = this._extractJsonMessages(this._buffer);
    this._buffer = extracted.remaining;

    for (const jsonStr of extracted.messages) {
      this._handleMessage(jsonStr);
    }
  }

  /**
   * Extract complete JSON objects from buffer using brace counting.
   * This is the proven approach from the working old code.
   */
  _extractJsonMessages(buf) {
    const messages = [];
    let depth = 0;
    let inString = false;
    let escape = false;
    let start = -1;

    for (let i = 0; i < buf.length; i++) {
      const ch = buf[i];

      // Ignore null delimiters - they don't appear inside JSON
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
      // Incomplete JSON object - keep it in buffer
      remaining = buf.slice(start);
    }

    return { messages, remaining };
  }

  _handleMessage(msg) {
    const trimmed = msg.trim();

    if (trimmed.startsWith('Hello V1')) {
      this._authMode = 'hello';
      this._handleHelloChallenge(trimmed).catch((e) => {
        log.error('Hello challenge handling failed:', e?.message || e);
        try {
          this._socket?.destroy();
        } catch {}
      });
      return;
    }

    if (trimmed === '[OK]') {
      log.info('LC7001 auth: [OK]');
      this._authMode = 'json';
      this._markReadyIfNeeded();
      return;
    }

    if (trimmed === '[INVALID]') {
      log.error('LC7001 auth: [INVALID] (bad key/password)');
      try {
        this._socket?.destroy();
      } catch {}
      return;
    }

    if (trimmed === '[SETKEY]') {
      this._authMode = 'setkey';
      log.warn('LC7001 is in [SETKEY] mode (needs user key to be set).');
      this._handleSetKeyMode().catch((e) => {
        log.error('Failed to set key in [SETKEY] mode:', e?.message || e);
        try {
          this._socket?.destroy();
        } catch {}
      });
      return;
    }

    if (msg.startsWith('{')) {
      let obj;
      try {
        obj = JSON.parse(msg);
      } catch (e) {
        log.warn('LC7001 JSON parse error:', e?.message || e, 'raw:', msg.slice(0, 200));
        return;
      }
      this._seenFirstJson = true;
      this._authMode = 'json';
      this._markReadyIfNeeded();
      this._handleJson(obj);
      return;
    }

    log.debug('LC7001 unknown message:', msg.slice(0, 200));
  }

  _markReadyIfNeeded() {
    if (!this._ready) {
      this._ready = true;
      this.emit('ready');
      log.info('LC7001 state: READY');
    }
  }

  async _handleHelloChallenge(msg) {
    const m = msg.match(/Hello V1\s+([0-9A-Fa-f]{32})\s+([0-9A-Fa-f]{12})/);
    if (!m) throw new Error(`Unrecognized Hello format: ${msg}`);

    const challengeHex = m[1];
    const macHex = m[2];
    log.info(`LC7001 auth: received Hello challenge (mac=${macHex})`);

    if (!this.key) {
      throw new Error(
        'LC7001 requires auth (Hello challenge), but no LC7001_KEY/LC7001_PASSWORD provided'
      );
    }

    const challenge = Buffer.from(challengeHex, 'hex');
    const encrypted = aes128EcbEncryptNoPadding(challenge, this.key);
    const responseHex = encrypted.toString('hex').toUpperCase();

    this._socket.write(responseHex, 'utf8');
    log.info('LC7001 auth: sent challenge response');
  }

  async _handleSetKeyMode() {
    const pw = this.setKeyPassword || envStr('LC7001_SETKEY_PASSWORD');
    if (!pw) {
      throw new Error(
        'Controller is in [SETKEY] mode but LC7001_SETKEY_PASSWORD not set.'
      );
    }

    const oldKey = md5KeyFromPassword('');
    const newKey = md5KeyFromPassword(pw);

    const oldEnc = aes128EcbEncryptNoPadding(oldKey, oldKey);
    const newEnc = aes128EcbEncryptNoPadding(newKey, oldKey);

    const keys64 = oldEnc.toString('hex').toUpperCase() + newEnc.toString('hex').toUpperCase();

    const resp = await this.send({
      Service: 'SetSystemProperties',
      PropertyList: { Keys: keys64 },
    });

    if (!resp || String(resp.Status || '').toLowerCase() !== 'success') {
      throw new Error(`SetSystemProperties(Keys) failed: ${JSON.stringify(resp)}`);
    }

    log.info('LC7001 [SETKEY]: user key set successfully.');
  }

  _handleJson(obj) {
    const id = obj.ID ?? obj.Id ?? obj.id;
    const service = obj.Service ?? obj.service;

    // Quiet the noisy LC7001 keepalives/broadcasts unless debugging
    if (id === 0) {
      if (service === 'ping') {
        log.debug(`[LC7001] ping seq=${obj.PingSeq} time=${obj.CurrentTime}`);
        return;
      }
      if (service === 'EliotErrors' || service === 'BroadcastDiagnostics' || service === 'BroadcastMemory') {
        log.debug(`[LC7001] ${service} ${JSON.stringify(obj)}`);
        return;
      }
    }

    if (typeof id === 'number' && id !== 0 && this._pending.has(id)) {
      log.info(`[LC7001 RX] Matched pending request ID=${id}`);
      const p = this._pending.get(id);
      this._pending.delete(id);
      clearTimeout(p.timeout);
      p.resolve(obj);
      return;
    } else if (typeof id === 'number' && id !== 0) {
      log.warn(`[LC7001 RX] Received response for unknown ID=${id} (not in pending map)`);
    }

    if (service === 'ZonePropertiesChanged') {
      const zid = obj.ZID;
      const props = obj.PropertyList || {};
      this._applyZoneProps(zid, props);
      this.emit('zoneChanged', { zid, props, raw: obj });
      return;
    }

    if (service === 'ZoneAdded') {
      const zid = obj.ZID;
      if (typeof zid === 'number') {
        log.info(`LC7001 broadcast: ZoneAdded ZID=${zid}`);
        if (!this.zones.has(zid)) this.zones.set(zid, { zid, name: `Zone ${zid}`, updatedAt: Date.now() });
        this.emit('zoneAdded', { zid, raw: obj });
        this.reportZoneProperties(zid).catch(() => {});
      }
      return;
    }

    if (service === 'ZoneDeleted') {
      const zid = obj.ZID;
      if (typeof zid === 'number') {
        log.info(`LC7001 broadcast: ZoneDeleted ZID=${zid}`);
        this.zones.delete(zid);
        this.emit('zoneDeleted', { zid, raw: obj });
      }
      return;
    }

    if (service === 'ReportZoneProperties') {
      const zid = obj.ZID;
      const props = obj.PropertyList || {};
      this._applyZoneProps(zid, props);
      return;
    }

    this.emit('message', obj);
  }

  _applyZoneProps(zid, props) {
    if (typeof zid !== 'number') return;
    const existing = this.zones.get(zid) || { zid };
    const updated = {
      ...existing,
      zid,
      name: typeof props.Name === 'string' ? props.Name : existing.name,
      deviceType: typeof props.DeviceType === 'string' ? props.DeviceType : existing.deviceType,
      power: typeof props.Power === 'boolean' ? props.Power : existing.power,
      powerLevel: typeof props.PowerLevel === 'number' ? props.PowerLevel : existing.powerLevel,
      rampRate: typeof props.RampRate === 'number' ? props.RampRate : existing.rampRate,
      updatedAt: Date.now(),
      _lastProps: { ...(existing._lastProps || {}), ...(props || {}) },
    };
    this.zones.set(zid, updated);
    this.emit('zoneUpdated', updated);
  }

  _nextId() {
    const id = this._requestId;
    this._requestId += 1;
    if (this._requestId > 60_000) this._requestId = 1;
    return id;
  }

  async send(payload) {
    if (!this._socket || this._socket.destroyed) throw new Error('Not connected');
    const id = this._nextId();
    const msg = { ID: id, ...payload };
    const raw = JSON.stringify(msg);

    log.info(`[LC7001 TX] ID=${id} Service=${payload.Service}`);
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error(`Request timeout (${this.requestTimeoutMs}ms) for ID=${id} ${payload.Service}`));
      }, this.requestTimeoutMs);

      // Register pending BEFORE the write so we can match very fast responses
      this._pending.set(id, { resolve, reject, timeout });

      this._writeWithSpacing(raw + this.delimiter).catch((err) => {
        clearTimeout(timeout);
        this._pending.delete(id);
        reject(err);
      });
    });
  }

  _writeWithSpacing(data) {
    // Write directly like the v1 bridge
    return new Promise((resolve, reject) => {
      try {
        log.info(`[LC7001 TX RAW] ${data.replace(/\0/g, '<NUL>')}`);
        const buf = Buffer.from(data, 'utf8');
        this._socket.write(buf, (err) => {
          if (err) return reject(err);
          resolve();
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  async listZones() {
    const resp = await this.send({ Service: 'ListZones' });
    const zoneList = resp.ZoneList || [];
    const ids = [];
    for (const entry of zoneList) {
      const zid = entry?.ZID;
      if (typeof zid === 'number') ids.push(zid);
    }
    return ids;
  }

  async reportZoneProperties(zid) {
    const resp = await this.send({ Service: 'ReportZoneProperties', ZID: zid });
    if (resp?.PropertyList) this._applyZoneProps(zid, resp.PropertyList);
    return resp;
  }

  async setZoneProperties(zid, props) {
    const resp = await this.send({ Service: 'SetZoneProperties', ZID: zid, PropertyList: props });
    this._applyZoneProps(zid, props);
    return resp;
  }

  getZoneSnapshot() {
    return [...this.zones.values()]
      .sort((a, b) => a.zid - b.zid)
      .map((z) => ({
        zid: z.zid,
        name: z.name,
        deviceType: z.deviceType,
        power: z.power,
        powerLevel: z.powerLevel,
        rampRate: z.rampRate,
        updatedAt: z.updatedAt,
      }));
  }

  async refreshZones({ full = true } = {}) {
    // Just check socket is connected, don't require 'ready' state
    if (!this._socket || this._socket.destroyed) throw new Error('Not connected');

    const ids = await this.listZones();
    const idSet = new Set(ids);

    for (const zid of [...this.zones.keys()]) {
      if (!idSet.has(zid)) this.zones.delete(zid);
    }

    for (const zid of ids) {
      if (!this.zones.has(zid)) this.zones.set(zid, { zid, name: `Zone ${zid}`, updatedAt: Date.now() });
    }

    if (full) {
      await mapLimit(ids, 6, async (zid) => {
        try {
          await this.reportZoneProperties(zid);
        } catch (e) {
          log.warn(`ReportZoneProperties failed for ZID=${zid}:`, e?.message || e);
        }
      });
    }

    this.emit('zonesRefreshed', { count: this.zones.size, full });
    return this.getZoneSnapshot();
  }
}

/* ------------------------------ mapLimit util ----------------------------- */

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;

  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      results[i] = await fn(items[i], i);
    }
  });

  await Promise.all(workers);
  return results;
}

/* ------------------------------ job manager -------------------------------- */

class JobManager extends EventEmitter {
  constructor() {
    super();
    this.jobs = new Map();
  }

  createJob(base) {
    const id = base.id || newId(base.type || 'job');
    const job = {
      id,
      type: base.type || 'job',
      name: base.name || id,
      status: base.status || 'created',
      createdAt: Date.now(),
      startedAt: base.startedAt || null,
      endedAt: base.endedAt || null,
      details: base.details || {},
      cancel: base.cancel || null,
      error: null,
      result: null,
    };
    this.jobs.set(id, job);
    this.emit('jobCreated', job);
    return job;
  }

  listJobs() {
    return [...this.jobs.values()].map((j) => ({
      id: j.id,
      type: j.type,
      name: j.name,
      status: j.status,
      createdAt: j.createdAt,
      startedAt: j.startedAt,
      endedAt: j.endedAt,
      details: j.details,
      error: j.error ? String(j.error) : null,
    }));
  }

  getJob(id) {
    return this.jobs.get(id);
  }

  stopJob(id) {
    const job = this.jobs.get(id);
    if (!job) return { ok: false, error: `No such job: ${id}` };

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'canceled') {
      return { ok: true, status: job.status };
    }

    try {
      job.cancel?.();
      job.status = 'canceled';
      job.endedAt = Date.now();
      this.emit('jobUpdated', job);
      return { ok: true, status: 'canceled' };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  }

  schedule({ name, runAt, details, fn }) {
    const now = Date.now();
    const delay = Math.max(0, runAt - now);

    let timer = null;
    const job = this.createJob({
      type: 'schedule',
      name: name || `scheduled-${new Date(runAt).toISOString()}`,
      status: 'scheduled',
      details: { ...(details || {}), runAt },
      cancel: () => {
        if (timer) clearTimeout(timer);
        timer = null;
      },
    });

    timer = setTimeout(async () => {
      if (!this.jobs.has(job.id)) return;

      job.status = 'running';
      job.startedAt = Date.now();
      this.emit('jobUpdated', job);

      try {
        job.result = await fn();
        job.status = 'completed';
        job.endedAt = Date.now();
        this.emit('jobUpdated', job);
      } catch (e) {
        job.error = e?.message || String(e);
        job.status = 'failed';
        job.endedAt = Date.now();
        this.emit('jobUpdated', job);
      }
    }, delay);

    return job;
  }

  startLongRunning({ type, name, details, runner }) {
    const ac = new AbortController();
    const job = this.createJob({
      type: type || 'job',
      name: name || type || 'job',
      status: 'running',
      startedAt: Date.now(),
      details: details || {},
      cancel: () => ac.abort(),
    });

    Promise.resolve()
      .then(() => runner(ac.signal))
      .then(
        (result) => {
          if (!this.jobs.has(job.id)) return;
          if (job.status === 'canceled') return;
          job.result = result ?? null;
          job.status = 'completed';
          job.endedAt = Date.now();
          this.emit('jobUpdated', job);
        },
        (err) => {
          if (!this.jobs.has(job.id)) return;
          if (job.status === 'canceled') return;
          job.error = err?.message || String(err);
          job.status = err?.code === 'ABORTED' ? 'canceled' : 'failed';
          job.endedAt = Date.now();
          this.emit('jobUpdated', job);
        }
      );

    return job;
  }
}

/* --------------------------- target resolution ----------------------------- */

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreCandidate(query, candidate) {
  const q = normalizeName(query);
  const c = normalizeName(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1000;
  if (c.includes(q)) return 600 + q.length;
  if (q.includes(c)) return 500 + c.length;

  const qTokens = new Set(q.split(' ').filter(Boolean));
  const cTokens = new Set(c.split(' ').filter(Boolean));
  let overlap = 0;
  for (const t of qTokens) if (cTokens.has(t)) overlap++;
  return overlap * 50;
}

function bestZoneMatch(zones, query) {
  const q = normalizeName(query);
  if (!q) return null;

  let best = null;
  let bestScore = -1;

  for (const z of zones) {
    const score = scoreCandidate(q, z.name || `Zone ${z.zid}`);
    if (score > bestScore) {
      bestScore = score;
      best = z;
    }
  }

  if (bestScore < 50) return null;
  return best;
}

function resolveTargets(lc, targets) {
  const zones = lc.getZoneSnapshot();
  const allIds = zones.map((z) => z.zid);

  if (!targets || typeof targets !== 'object') return [];

  if (targets.all === true) return allIds;

  const ids = new Set();

  if (Array.isArray(targets.zoneIds)) {
    for (const id of targets.zoneIds) if (typeof id === 'number') ids.add(id);
  }

  const nameList = []
    .concat(targets.zoneNames || [])
    .concat(targets.rooms || [])
    .filter((x) => typeof x === 'string' && x.trim() !== '');

  for (const name of nameList) {
    const m = bestZoneMatch(zones, name);
    if (m) ids.add(m.zid);
  }

  if (typeof targets.query === 'string' && targets.query.trim() !== '') {
    const m = bestZoneMatch(zones, targets.query);
    if (m) ids.add(m.zid);
  }

  if (Array.isArray(targets.excludeZoneIds)) {
    for (const id of targets.excludeZoneIds) ids.delete(id);
  }

  return [...ids.values()];
}

/* ----------------------------- effects engine ------------------------------ */

async function setManyZones(lc, zoneIds, props, { concurrency = 6 } = {}) {
  const unique = [...new Set(zoneIds)].filter((z) => typeof z === 'number');
  const results = { ok: 0, errors: [] };

  // Build props description for logging
  const propsDesc = [];
  if (typeof props.Power === 'boolean') propsDesc.push(`Power=${props.Power ? 'ON' : 'OFF'}`);
  if (typeof props.PowerLevel === 'number') propsDesc.push(`Level=${props.PowerLevel}%`);
  if (typeof props.RampRate === 'number') propsDesc.push(`Ramp=${props.RampRate}`);
  const propsStr = propsDesc.join(', ') || 'no changes';

  await mapLimit(unique, concurrency, async (zid) => {
    const zone = lc.zones.get(zid);
    const zoneName = zone?.name || `Zone ${zid}`;
    try {
      await lc.setZoneProperties(zid, props);
      results.ok++;
      log.info(`  ✓ ZID ${zid} "${zoneName}": ${propsStr}`);
    } catch (e) {
      results.errors.push({ zid, name: zoneName, error: e?.message || String(e) });
      log.warn(`  ✗ ZID ${zid} "${zoneName}": FAILED - ${e?.message || e}`);
    }
  });

  return { ok: true, count: unique.length, successCount: results.ok, errors: results.errors, props };
}

async function pulseEffect(lc, zoneIds, opts, signal) {
  const durationMs = clamp(opts.durationMs ?? 60_000, 100, 60 * 60 * 1000);
  const periodMs = clamp(opts.periodMs ?? 600, 50, 60 * 1000);
  const onLevel = clamp(opts.onLevel ?? 100, 1, 100);
  const offPower = opts.offPower ?? false;
  const restore = opts.restore ?? false;

  const snapshot = restore ? lc.getZoneSnapshot().filter((z) => zoneIds.includes(z.zid)) : null;

  const endAt = Date.now() + durationMs;
  let on = true;

  while (Date.now() < endAt) {
    if (signal?.aborted) throw Object.assign(new Error('Aborted'), { code: 'ABORTED' });

    if (on) {
      await setManyZones(lc, zoneIds, { Power: true, PowerLevel: onLevel, RampRate: 100 }, { concurrency: 6 });
    } else {
      await setManyZones(lc, zoneIds, { Power: offPower }, { concurrency: 6 });
    }

    on = !on;
    await sleepMs(periodMs, signal);
  }

  if (restore && snapshot) {
    for (const z of snapshot) {
      const props = {};
      if (typeof z.power === 'boolean') props.Power = z.power;
      if (typeof z.powerLevel === 'number') props.PowerLevel = z.powerLevel;
      if (typeof z.rampRate === 'number') props.RampRate = z.rampRate;
      await lc.setZoneProperties(z.zid, props);
    }
  }

  return { ok: true, effect: 'pulse', zoneCount: zoneIds.length };
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

async function rampEffect(lc, zoneIds, opts, signal) {
  const durationMs = clamp(opts.durationMs ?? 10 * 60_000, 200, 6 * 60 * 60_000);
  const stepMs = clamp(opts.stepMs ?? 1000, 50, 60_000);
  const toLevel = clamp(opts.toLevel ?? 1, 1, 100);
  const fromLevelOpt = opts.fromLevel;
  const curve = (opts.curve || 'ease').toLowerCase();

  const snapshot = lc.getZoneSnapshot().filter((z) => zoneIds.includes(z.zid));
  const fromLevels = new Map();
  for (const z of snapshot) {
    const from = typeof fromLevelOpt === 'number' ? fromLevelOpt : z.powerLevel ?? 100;
    fromLevels.set(z.zid, clamp(from, 1, 100));
  }

  const started = Date.now();
  while (true) {
    if (signal?.aborted) throw Object.assign(new Error('Aborted'), { code: 'ABORTED' });

    const t = (Date.now() - started) / durationMs;
    if (t >= 1) break;

    const k = curve === 'linear' ? t : easeInOutQuad(t);

    await mapLimit(zoneIds, 6, async (zid) => {
      const from = fromLevels.get(zid) ?? 100;
      const level = Math.round(from + (toLevel - from) * k);
      await lc.setZoneProperties(zid, { Power: true, PowerLevel: clamp(level, 1, 100), RampRate: 100 });
    });

    await sleepMs(stepMs, signal);
  }

  await setManyZones(lc, zoneIds, { Power: true, PowerLevel: toLevel, RampRate: 100 }, { concurrency: 6 });
  return { ok: true, effect: 'ramp', zoneCount: zoneIds.length, toLevel };
}

async function breatheEffect(lc, zoneIds, opts, signal) {
  const durationMs = clamp(opts.durationMs ?? 60_000, 200, 60 * 60 * 1000);
  const stepMs = clamp(opts.stepMs ?? 200, 50, 5_000);
  const minLevel = clamp(opts.minLevel ?? 10, 1, 100);
  const maxLevel = clamp(opts.maxLevel ?? 100, 1, 100);
  const periodMs = clamp(opts.periodMs ?? 4000, 200, 60_000);

  const start = Date.now();
  while (Date.now() - start < durationMs) {
    if (signal?.aborted) throw Object.assign(new Error('Aborted'), { code: 'ABORTED' });

    const t = ((Date.now() - start) % periodMs) / periodMs;
    const wave = (1 - Math.cos(2 * Math.PI * t)) / 2;
    const level = Math.round(minLevel + (maxLevel - minLevel) * wave);

    await setManyZones(lc, zoneIds, { Power: true, PowerLevel: level, RampRate: 100 }, { concurrency: 6 });
    await sleepMs(stepMs, signal);
  }
  return { ok: true, effect: 'breathe', zoneCount: zoneIds.length };
}

/* ---------------------------- script sandbox -------------------------- */

function validateScriptSafety(code) {
  const banned = [
    'require(',
    'process',
    'child_process',
    'fs.',
    'net.',
    'http.',
    'https.',
    'dns.',
    'worker_threads',
    'eval(',
    'Function(',
  ];
  const lower = String(code || '').toLowerCase();
  for (const b of banned) {
    if (lower.includes(b.toLowerCase())) {
      throw new Error(`Script contains banned token: ${b}`);
    }
  }
}

async function runLightingScript({ code, lightsApi, timeoutMs, signal }) {
  validateScriptSafety(code);
  const maxTimeout = clamp(timeoutMs ?? 20_000, 200, 120_000);

  const sandbox = {
    lights: lightsApi,
    console: {
      log: (...a) => log.info('[script]', ...a),
      warn: (...a) => log.warn('[script]', ...a),
      error: (...a) => log.error('[script]', ...a),
    },
    sleep: (ms) => lightsApi.sleep(ms, signal),
    clamp,
  };

  const context = vm.createContext(sandbox);

  const wrapped = `
    (async () => {
      "use strict";
      ${code}
    })()
  `;

  const script = new vm.Script(wrapped, { filename: 'user-script.js' });

  const execPromise = Promise.resolve(script.runInContext(context, { timeout: maxTimeout }));

  const timeoutPromise = new Promise((_, reject) => {
    const t = setTimeout(() => {
      clearTimeout(t);
      reject(new Error(`Script wall-time timeout after ${maxTimeout}ms`));
    }, maxTimeout);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(t);
          reject(Object.assign(new Error('Aborted'), { code: 'ABORTED' }));
        },
        { once: true }
      );
    }
  });

  return await Promise.race([execPromise, timeoutPromise]);
}

/* ------------------------------- lights API -------------------------------- */

function makeLightsApi(lc, jobs) {
  return {
    get zones() {
      return lc.getZoneSnapshot();
    },

    async refreshZones(full = true) {
      return await lc.refreshZones({ full });
    },

    resolveTargets: (targets) => resolveTargets(lc, targets),

    async set(targets, props) {
      const zoneIds = resolveTargets(lc, targets);
      
      // Log target resolution
      const targetDesc = targets.all ? 'ALL' : 
        targets.query ? `query:"${targets.query}"` :
        targets.zoneNames ? `names:${JSON.stringify(targets.zoneNames)}` :
        targets.rooms ? `rooms:${JSON.stringify(targets.rooms)}` :
        targets.zoneIds ? `ids:${JSON.stringify(targets.zoneIds)}` : 
        JSON.stringify(targets);
      
      if (!zoneIds.length) {
        log.warn(`[SET] No zones matched target: ${targetDesc}`);
        return { ok: false, error: 'No targets resolved', targets };
      }

      const zoneNames = zoneIds.map(id => lc.zones.get(id)?.name || `Zone ${id}`);
      log.info(`[SET] Target "${targetDesc}" resolved to ${zoneIds.length} zone(s): ${zoneNames.join(', ')}`);

      const clean = {};
      if (props && typeof props === 'object') {
        if (typeof props.Power === 'boolean') clean.Power = props.Power;
        if (typeof props.power === 'boolean') clean.Power = props.power;

        if (typeof props.PowerLevel === 'number') clean.PowerLevel = clamp(props.PowerLevel, 1, 100);
        if (typeof props.powerLevel === 'number') clean.PowerLevel = clamp(props.powerLevel, 1, 100);

        if (typeof props.RampRate === 'number') clean.RampRate = clamp(props.RampRate, 1, 100);
        if (typeof props.rampRate === 'number') clean.RampRate = clamp(props.rampRate, 1, 100);

        if (typeof props.Name === 'string') clean.Name = String(props.Name).slice(0, 20);
        if (typeof props.name === 'string') clean.Name = String(props.name).slice(0, 20);
      }

      const result = await setManyZones(lc, zoneIds, clean, { concurrency: 6 });
      return { ok: true, zoneIds, applied: clean, ...result };
    },

    async pulse(targets, opts = {}, signal) {
      const zoneIds = resolveTargets(lc, targets);
      if (!zoneIds.length) throw new Error('No targets resolved');
      return await pulseEffect(lc, zoneIds, opts, signal);
    },

    async strobe(targets, opts = {}, signal) {
      const zoneIds = resolveTargets(lc, targets);
      if (!zoneIds.length) throw new Error('No targets resolved');
      const merged = { periodMs: 150, durationMs: 5000, ...opts };
      return await pulseEffect(lc, zoneIds, merged, signal);
    },

    async breathe(targets, opts = {}, signal) {
      const zoneIds = resolveTargets(lc, targets);
      if (!zoneIds.length) throw new Error('No targets resolved');
      return await breatheEffect(lc, zoneIds, opts, signal);
    },

    async ramp(targets, opts = {}, signal) {
      const zoneIds = resolveTargets(lc, targets);
      if (!zoneIds.length) throw new Error('No targets resolved');
      return await rampEffect(lc, zoneIds, opts, signal);
    },

    sleep: async (ms, signal) => await sleepMs(clamp(ms, 0, 24 * 60 * 60 * 1000), signal),

    scheduleSet({ name, runAt, targets, props }) {
      return jobs.schedule({
        name: name || 'scheduled-set',
        runAt,
        details: { runAt, targets, props },
        fn: async () => await this.set(targets, props),
      });
    },

    startEffectJob({ effect, name, targets, options }) {
      const eff = String(effect || '').toLowerCase();
      const runner = async (signal) => {
        if (eff === 'pulse') return await this.pulse(targets, options || {}, signal);
        if (eff === 'strobe') return await this.strobe(targets, options || {}, signal);
        if (eff === 'breathe') return await this.breathe(targets, options || {}, signal);
        if (eff === 'ramp' || eff === 'dim') return await this.ramp(targets, options || {}, signal);
        throw new Error(`Unknown effect: ${effect}`);
      };

      return jobs.startLongRunning({
        type: 'effect',
        name: name || `effect-${eff}`,
        details: { effect: eff, targets, options },
        runner,
      });
    },

    startScriptJob({ name, code, timeoutMs }) {
      return jobs.startLongRunning({
        type: 'script',
        name: name || 'lighting-script',
        details: { timeoutMs },
        runner: async (signal) => {
          return await runLightingScript({
            code,
            timeoutMs,
            signal,
            lightsApi: {
              listZones: async () => lc.getZoneSnapshot(),
              refreshZones: async (full = true) => await lc.refreshZones({ full }),
              set: async (targets, props) => await this.set(targets, props),
              pulse: async (targets, opts) => await this.pulse(targets, opts, signal),
              strobe: async (targets, opts) => await this.strobe(targets, opts, signal),
              breathe: async (targets, opts) => await this.breathe(targets, opts, signal),
              ramp: async (targets, opts) => await this.ramp(targets, opts, signal),
              sleep: async (ms) => await sleepMs(ms, signal),
              now: () => Date.now(),
            },
          });
        },
      });
    },
  };
}

/* ----------------------------- tool definitions ---------------------------- */

const TOOL_DEFINITIONS = [
  {
    name: 'lights_list_zones',
    description: 'List all known lighting zones with current state (power, level, name). Use this to see what lights exist and their status.',
    input_schema: {
      type: 'object',
      properties: {
        refresh: { type: 'boolean', description: 'If true, refresh zones from controller first (slower but fresh data).' },
      },
    },
  },
  {
    name: 'lights_set',
    description: 'Set power on/off and/or brightness level for one or more zones. Use targets to specify which lights.',
    input_schema: {
      type: 'object',
      properties: {
        targets: {
          type: 'object',
          description: 'Which zones to target. Use {all: true} for all, or zoneIds/zoneNames/rooms/query for specific ones.',
          properties: {
            all: { type: 'boolean', description: 'Target all zones' },
            zoneIds: { type: 'array', items: { type: 'number' }, description: 'Specific zone IDs' },
            zoneNames: { type: 'array', items: { type: 'string' }, description: 'Zone names (fuzzy matched)' },
            rooms: { type: 'array', items: { type: 'string' }, description: 'Room names (fuzzy matched)' },
            query: { type: 'string', description: 'Single search query (fuzzy matched)' },
            excludeZoneIds: { type: 'array', items: { type: 'number' }, description: 'Zone IDs to exclude' },
          },
        },
        power: { type: 'boolean', description: 'Turn on (true) or off (false)' },
        powerLevel: { type: 'number', description: 'Brightness 1-100' },
        rampRate: { type: 'number', description: 'Transition speed 1-100 (100=instant)' },
      },
      required: ['targets'],
    },
  },
  {
    name: 'lights_run_effect',
    description: 'Run a lighting effect (pulse, strobe, breathe, ramp) as a background job. Returns job ID that can be stopped.',
    input_schema: {
      type: 'object',
      properties: {
        effect: { type: 'string', enum: ['pulse', 'strobe', 'breathe', 'ramp'], description: 'Effect type' },
        targets: {
          type: 'object',
          description: 'Which zones to target',
          properties: {
            all: { type: 'boolean' },
            zoneIds: { type: 'array', items: { type: 'number' } },
            zoneNames: { type: 'array', items: { type: 'string' } },
            rooms: { type: 'array', items: { type: 'string' } },
            query: { type: 'string' },
          },
        },
        options: {
          type: 'object',
          description: 'Effect options: durationMs, periodMs, onLevel, minLevel, maxLevel, toLevel, etc.',
        },
        name: { type: 'string', description: 'Optional job name' },
      },
      required: ['effect', 'targets'],
    },
  },
  {
    name: 'lights_schedule_set',
    description: 'Schedule a future lighting change. Returns job ID.',
    input_schema: {
      type: 'object',
      properties: {
        inMs: { type: 'number', description: 'Milliseconds from now to run' },
        at: { type: 'string', description: 'ISO timestamp to run at (alternative to inMs)' },
        targets: { type: 'object', description: 'Which zones to target' },
        power: { type: 'boolean' },
        powerLevel: { type: 'number' },
        name: { type: 'string' },
      },
      required: ['targets'],
    },
  },
  {
    name: 'lights_run_script',
    description: 'Run a custom JavaScript lighting script. You can write creative lighting behaviors. The script runs sandboxed with access to lights.set(), lights.pulse(), lights.breathe(), lights.ramp(), lights.sleep(), etc.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JavaScript code to run. Use await for async operations.' },
        timeoutMs: { type: 'number', description: 'Max runtime in ms (default 20000)' },
        name: { type: 'string', description: 'Optional job name' },
      },
      required: ['code'],
    },
  },
  {
    name: 'lights_list_jobs',
    description: 'List all scheduled and running jobs (effects, scripts, schedules).',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'lights_stop_job',
    description: 'Stop/cancel a running or scheduled job by ID.',
    input_schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'The job ID to stop' },
      },
      required: ['jobId'],
    },
  },
  {
    name: 'lights_health',
    description: 'Get health/status of the lighting system (connection state, zone count, etc).',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

/* ----------------------------- tool executor ------------------------------- */

async function executeTool(name, args, { lc, jobs, lights }) {
  switch (name) {
    case 'lights_list_zones': {
      const refresh = !!args.refresh;
      if (refresh && lc.isReady()) {
        await lc.refreshZones({ full: true });
      }
      return { ok: true, ready: lc.isReady(), zones: lc.getZoneSnapshot() };
    }

    case 'lights_set': {
      const targets = args.targets || {};
      const props = {
        power: args.power,
        powerLevel: args.powerLevel,
        rampRate: args.rampRate,
      };
      return await lights.set(targets, props);
    }

    case 'lights_run_effect': {
      const job = lights.startEffectJob({
        effect: args.effect,
        name: args.name,
        targets: args.targets || {},
        options: args.options || {},
      });
      return { ok: true, jobId: job.id, jobName: job.name, status: job.status };
    }

    case 'lights_schedule_set': {
      const inMs = typeof args.inMs === 'number' ? args.inMs : undefined;
      const atIso = typeof args.at === 'string' ? args.at : undefined;

      let runAt = Date.now();
      if (typeof inMs === 'number') runAt = Date.now() + clamp(inMs, 0, 365 * 24 * 60 * 60 * 1000);
      else if (atIso) runAt = new Date(atIso).getTime();

      if (!Number.isFinite(runAt)) throw new Error('Invalid schedule time');

      const job = lights.scheduleSet({
        name: args.name,
        runAt,
        targets: args.targets || {},
        props: { power: args.power, powerLevel: args.powerLevel },
      });
      return { ok: true, jobId: job.id, jobName: job.name, runAt: new Date(runAt).toISOString() };
    }

    case 'lights_run_script': {
      const job = lights.startScriptJob({
        name: args.name,
        code: args.code,
        timeoutMs: args.timeoutMs,
      });
      return { ok: true, jobId: job.id, jobName: job.name, status: job.status };
    }

    case 'lights_list_jobs': {
      return { ok: true, jobs: jobs.listJobs() };
    }

    case 'lights_stop_job': {
      return jobs.stopJob(args.jobId);
    }

    case 'lights_health': {
      return {
        ok: true,
        now: nowIso(),
        lc7001: {
          host: lc.host,
          port: lc.port,
          ready: lc.isReady(),
          zoneCount: lc.zones.size,
        },
        jobs: {
          total: jobs.jobs.size,
          running: [...jobs.jobs.values()].filter((j) => j.status === 'running').length,
        },
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/* ----------------------------- Claude NL endpoint -------------------------- */

const SYSTEM_PROMPT = `You are a professional home lighting control assistant. You control smart lights via the LC7001 system.

Your responses should be:
- Professional and concise
- Specific about what was done (zone names, levels)
- Brief (this gets read aloud) so IP addresses and GUIDs are not helpful.

House layout:
- Second floor: bedrooms and office
- First/main floor: everything else (kitchen, living room, dining room, etc.)

When reporting success, name the zones affected and their new state.
When reporting errors, state "X errors out of Y calls" then specify which zones failed and why.

Examples:
- "Set kitchen to 100%. Living room set to 75%."
- "All first floor lights turned off. 5 zones affected."
- "2 errors out of 4 calls. Kitchen and garage timed out. Dining room and living room set to 50%."
- "Status: 12 zones online. Kitchen at 80%, living room off, bedroom at 30%."
- "Started pulse effect on office lights for 60 seconds."`;

async function callClaudeWithTools({ command, lc, jobs, lights }) {
  const apiKey = envStr('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set. Cannot process natural language commands.');
  }

  const model = envStr('ANTHROPIC_MODEL') || 'claude-haiku-4-5';
  const maxIterations = envInt('MAX_TOOL_ITERATIONS', 100);

  const messages = [{ role: 'user', content: command }];

  let iterations = 0;
  let totalToolCalls = 0;

  while (iterations < maxIterations) {
    iterations++;

    const body = {
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages,
    };

    log.debug(`[NL] Calling Claude (iteration ${iterations})...`);

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Anthropic API error ${resp.status}: ${text}`);
    }

    const data = await resp.json();

    // Check stop reason
    if (data.stop_reason === 'end_turn') {
      // Claude is done - extract text response
      const textBlocks = (data.content || []).filter((b) => b.type === 'text');
      const responseText = textBlocks.map((b) => b.text).join('\n').trim();
      return { response: responseText, iterations, toolCalls: totalToolCalls };
    }

    if (data.stop_reason === 'tool_use') {
      // Claude wants to use tools
      const toolUseBlocks = (data.content || []).filter((b) => b.type === 'tool_use');

      if (toolUseBlocks.length === 0) {
        // Weird state - treat as done
        const textBlocks = (data.content || []).filter((b) => b.type === 'text');
        const responseText = textBlocks.map((b) => b.text).join('\n').trim();
        return { response: responseText || 'Done.', iterations, toolCalls: totalToolCalls };
      }

      // Add assistant message with the content (including tool_use blocks)
      messages.push({ role: 'assistant', content: data.content });

      // Execute each tool and collect results
      const toolResults = [];
      for (const toolUse of toolUseBlocks) {
        totalToolCalls++;
        const toolName = toolUse.name;
        const toolInput = toolUse.input || {};
        const toolUseId = toolUse.id;

        log.info(`[NL] Tool: ${toolName}(${JSON.stringify(toolInput).slice(0, 150)}...)`);

        let result;
        try {
          result = await executeTool(toolName, toolInput, { lc, jobs, lights });
        } catch (e) {
          result = { ok: false, error: e?.message || String(e) };
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUseId,
          content: JSON.stringify(result),
        });
      }

      // Add tool results as user message
      messages.push({ role: 'user', content: toolResults });

      continue;
    }

    // Unknown stop reason - return what we have
    const textBlocks = (data.content || []).filter((b) => b.type === 'text');
    const responseText = textBlocks.map((b) => b.text).join('\n').trim();
    return { response: responseText || 'Done.', iterations, toolCalls: totalToolCalls };
  }

  // Hit max iterations
  return {
    response: `I got a bit carried away and hit my limit of ${maxIterations} tool calls. The lights may or may not be doing what you asked. Good luck.`,
    iterations,
    toolCalls: totalToolCalls,
  };
}

/* ------------------------------ HTTP server -------------------------------- */

function startHttpServer({ port, lc, jobs, lights }) {
  if (!port || port <= 0) {
    log.info('HTTP server disabled (HTTP_PORT=0)');
    return;
  }

  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = parsedUrl.pathname || '/';

    const sendJson = (status, obj) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj, null, 2));
    };

    const readBody = async () => {
      return await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (chunk) => {
          data += chunk.toString('utf8');
          if (data.length > 1_000_000) {
            req.destroy();
            reject(new Error('Body too large'));
          }
        });
        req.on('end', () => {
          if (!data) return resolve({});
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON body'));
          }
        });
      });
    };

    try {
      // Health check
      if (req.method === 'GET' && path === '/health') {
        return sendJson(200, {
          ok: true,
          now: nowIso(),
          lc7001: { host: lc.host, port: lc.port, ready: lc.isReady(), zones: lc.zones.size },
          jobs: { count: jobs.jobs.size },
        });
      }

      // List zones
      if (req.method === 'GET' && path === '/zones') {
        const refresh = parsedUrl.searchParams.get('refresh') === '1' || parsedUrl.searchParams.get('refresh') === 'true';
        if (refresh && lc.isReady()) {
          await lc.refreshZones({ full: true }).catch((e) => log.warn('refreshZones failed:', e?.message || e));
        }
        return sendJson(200, { ok: true, zones: lc.getZoneSnapshot() });
      }

      // Direct zone set (no AI)
      if (req.method === 'POST' && path === '/zones/set') {
        const body = await readBody();
        const out = await lights.set(body.targets || {}, body.props || body);
        return sendJson(200, out);
      }

      // Natural language endpoint (Claude-powered)
      if (req.method === 'POST' && path === '/nl') {
        const body = await readBody();
        const command = String(body.command || '').trim();

        if (!command) {
          return sendJson(400, { ok: false, error: 'Missing "command" in request body' });
        }

        log.info(`[NL] Command: "${command}"`);

        try {
          const result = await callClaudeWithTools({ command, lc, jobs, lights });
          log.info(`[NL] Response (${result.iterations} iterations, ${result.toolCalls} tools): ${result.response.slice(0, 100)}...`);
          return sendJson(200, {
            ok: true,
            command,
            response: result.response,
            iterations: result.iterations,
            toolCalls: result.toolCalls,
          });
        } catch (e) {
          log.error('[NL] Error:', e?.message || e);
          return sendJson(500, { ok: false, error: e?.message || String(e) });
        }
      }

      // Start effect job directly
      if (req.method === 'POST' && path === '/effects') {
        const body = await readBody();
        const job = lights.startEffectJob({
          effect: body.effect,
          name: body.name,
          targets: body.targets || {},
          options: body.options || body,
        });
        return sendJson(200, { ok: true, job });
      }

      // Schedule job directly
      if (req.method === 'POST' && path === '/schedule') {
        const body = await readBody();
        const inMs = typeof body.inMs === 'number' ? body.inMs : undefined;
        const atIso = typeof body.at === 'string' ? body.at : undefined;

        let runAt = Date.now();
        if (typeof inMs === 'number') runAt = Date.now() + clamp(inMs, 0, 365 * 24 * 60 * 60 * 1000);
        else if (atIso) runAt = new Date(atIso).getTime();

        if (!Number.isFinite(runAt)) return sendJson(400, { ok: false, error: 'Invalid time' });

        const job = lights.scheduleSet({
          name: body.name,
          runAt,
          targets: body.targets || {},
          props: body.props || body,
        });
        return sendJson(200, { ok: true, job });
      }

      // Run script directly
      if (req.method === 'POST' && path === '/scripts') {
        const body = await readBody();
        const job = lights.startScriptJob({
          name: body.name,
          code: body.code,
          timeoutMs: body.timeoutMs,
        });
        return sendJson(200, { ok: true, job });
      }

      // List jobs
      if (req.method === 'GET' && path === '/jobs') {
        return sendJson(200, { ok: true, jobs: jobs.listJobs() });
      }

      // Stop job
      if (req.method === 'POST' && path.startsWith('/jobs/stop/')) {
        const id = path.split('/').pop();
        const out = jobs.stopJob(id);
        return sendJson(200, out);
      }

      sendJson(404, { ok: false, error: 'Not found' });
    } catch (e) {
      sendJson(500, { ok: false, error: e?.message || String(e) });
    }
  });

  server.listen(port, () => {
    log.info(`HTTP API listening on http://0.0.0.0:${port}`);
    log.info('Endpoints: GET /health, GET /zones, POST /nl, POST /effects, POST /schedule, POST /scripts, GET /jobs');
  });
}

/* ------------------------------- MCP server -------------------------------- */

async function loadMcpSdk() {
  const candidates = [
    async () => {
      const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
      const { SSEServerTransport } = await import('@modelcontextprotocol/sdk/server/sse.js');
      const types = await import('@modelcontextprotocol/sdk/types.js');
      return { Server, SSEServerTransport, types };
    },
    async () => {
      const { Server } = await import('@modelcontextprotocol/sdk/server/index');
      const { SSEServerTransport } = await import('@modelcontextprotocol/sdk/server/sse');
      const types = await import('@modelcontextprotocol/sdk/types');
      return { Server, SSEServerTransport, types };
    },
  ];

  for (const attempt of candidates) {
    try {
      return await attempt();
    } catch {
      // keep trying
    }
  }
  return null;
}

async function startMcpServer({ port, lc, jobs, lights }) {
  if (!port || port <= 0) {
    log.info('MCP server disabled (MCP_PORT=0)');
    return;
  }

  const sdk = await loadMcpSdk();
  if (!sdk) {
    log.warn(
      'MCP SDK not installed. To enable MCP server for AI agents on your network:\n' +
        '  npm install @modelcontextprotocol/sdk\n' +
        'HTTP API and /nl endpoint still work fine without it.'
    );
    return;
  }

  const { Server, SSEServerTransport, types } = sdk;
  const { CallToolRequestSchema, ListToolsRequestSchema } = types;

  // Track active transports
  const transports = new Map();

  const mcpHttpServer = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = parsedUrl.pathname || '/';

    // CORS headers for browser-based MCP clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // SSE endpoint for MCP
    if (path === '/sse') {
      log.info(`MCP client connecting from ${req.socket.remoteAddress}`);

      const transport = new SSEServerTransport('/message', res);
      const sessionId = newId('mcp');
      transports.set(sessionId, transport);

      const server = new Server(
        { name: 'lc7001-lights', version: '2.0.0' },
        { capabilities: { tools: {} } }
      );

      // Convert our tool definitions to MCP format
      const mcpTools = TOOL_DEFINITIONS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.input_schema,
      }));

      server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools: mcpTools };
      });

      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const toolName = request.params.name;
        const toolArgs = request.params.arguments || {};

        log.debug(`[MCP] Tool call: ${toolName}`, JSON.stringify(toolArgs).slice(0, 200));

        try {
          const result = await executeTool(toolName, toolArgs, { lc, jobs, lights });
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        } catch (e) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ ok: false, error: e?.message || String(e) }) }],
            isError: true,
          };
        }
      });

      req.on('close', () => {
        log.info(`MCP client disconnected (session ${sessionId})`);
        transports.delete(sessionId);
      });

      await server.connect(transport);
      return;
    }

    // Message endpoint for SSE transport
    if (path === '/message' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        // The SSE transport handles message routing internally
        // This endpoint receives messages from the client
        const sessionId = parsedUrl.searchParams.get('sessionId');
        const transport = transports.get(sessionId);
        if (transport && transport.handlePostMessage) {
          try {
            await transport.handlePostMessage(req, res, body);
          } catch (e) {
            log.error('[MCP] handlePostMessage error:', e?.message || e);
            res.writeHead(500);
            res.end(JSON.stringify({ error: e?.message }));
          }
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Session not found' }));
        }
      });
      return;
    }

    // Health endpoint for MCP server
    if (path === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, mcp: true, sessions: transports.size }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found. Connect to /sse for MCP.' }));
  });

  mcpHttpServer.listen(port, () => {
    log.info(`MCP server (HTTP+SSE) listening on http://0.0.0.0:${port}`);
    log.info('AI agents can connect to /sse endpoint for MCP protocol');
  });
}

/* ---------------------------------- main ---------------------------------- */

(async () => {
  const host = envStr('LC7001_HOST', 'LC7001_IP');
  if (!host) {
    log.error('Missing LC7001_HOST (or LC7001_IP). Exiting.');
    process.exit(1);
  }

  const port = envInt('LC7001_PORT', 2112);

  const keyHex = envStr('LC7001_KEY');
  const pw = envStr('LC7001_PASSWORD');
  const setKeyPassword = envStr('LC7001_SETKEY_PASSWORD');

  const key = parseHexKeyMaybe(keyHex) || (pw ? md5KeyFromPassword(pw) : undefined);

  const delimiterChoice = (envStr('LC7001_DELIMITER') || 'null').toLowerCase();
  const delimiter = delimiterChoice === 'newline' ? '\n' : '\0';

  const lc = new LC7001Client({
    host,
    port,
    key,
    setKeyPassword,
    delimiter,
    requestTimeoutMs: envInt('REQUEST_TIMEOUT_MS', 10000),
    connectTimeoutMs: envInt('CONNECT_TIMEOUT_MS', 10000),
    commandSpacingMs: envInt('COMMAND_SPACING_MS', 35),
  });

  const jobs = new JobManager();
  const lights = makeLightsApi(lc, jobs);

  // Start LC7001 connection
  lc.start();

  // On connect (not ready), immediately try to load zones like the old working code
  lc.on('connected', async () => {
    log.info('LC7001 connected. Loading zones immediately...');

    // Retry up to 3 times
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const zones = await lc.refreshZones({ full: true });
        log.info(`\n========== ZONES LOADED (${zones.length}) ==========`);
        for (const z of zones) {
          const powerStr = z.power ? 'ON ' : 'OFF';
          const levelStr = String(z.powerLevel ?? '-').padStart(3);
          log.info(`  ZID ${String(z.zid).padStart(2)}: ${powerStr} ${levelStr}% | ${z.name || '(unnamed)'} [${z.deviceType || 'unknown'}]`);
        }
        log.info(`==========================================\n`);
        return; // Success
      } catch (e) {
        log.warn(`Zone refresh attempt ${attempt}/3 failed: ${e?.message || e}`);
        if (attempt < 3) {
          log.info('Retrying in 2 seconds...');
          await sleepMs(2000);
        }
      }
    }
    log.error('Failed to load zones after 3 attempts. Commands may not work correctly.');
  });

  // Hourly polling refresh
  const refreshIntervalMs = envInt('ZONE_REFRESH_INTERVAL_MS', 60 * 60 * 1000);
  setInterval(() => {
    if (!lc.isReady()) return;
    lc.refreshZones({ full: true }).catch((e) => log.warn('Hourly refreshZones failed:', e?.message || e));
  }, refreshIntervalMs);
  log.info(`Zone refresh polling interval: ${refreshIntervalMs}ms`);

  // Check for API key
  if (!envStr('ANTHROPIC_API_KEY')) {
    log.warn('ANTHROPIC_API_KEY not set. The /nl endpoint will not work until you set it.');
  }

  // Start HTTP server
  const httpPort = envInt('HTTP_PORT', 3080);
  startHttpServer({ port: httpPort, lc, jobs, lights });

  // Start MCP server (optional)
  const mcpPort = envInt('MCP_PORT', 3081);
  startMcpServer({ port: mcpPort, lc, jobs, lights }).catch((e) => {
    log.error('MCP server failed to start:', e?.message || e);
  });

  // Log zone events
  lc.on('zoneChanged', ({ zid, props }) => {
    const zone = lc.zones.get(zid);
    const name = zone?.name || `Zone ${zid}`;
    const changes = [];
    if (typeof props.Power === 'boolean') changes.push(`Power=${props.Power ? 'ON' : 'OFF'}`);
    if (typeof props.PowerLevel === 'number') changes.push(`Level=${props.PowerLevel}%`);
    if (changes.length) {
      log.info(`[BROADCAST] ZID ${zid} "${name}": ${changes.join(', ')}`);
    }
  });
  lc.on('zoneAdded', ({ zid }) => log.info(`[BROADCAST] Zone added: ZID ${zid}`));
  lc.on('zoneDeleted', ({ zid }) => log.info(`[BROADCAST] Zone deleted: ZID ${zid}`));

  log.info('LC7001 Bridge started. Waiting for controller connection...');
})();
