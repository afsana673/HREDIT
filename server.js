'use strict';

// ImgUpscaler API gateway for GitHub + Render (Node.js 22+).
// This service adds NO per-user/per-day/per-request-count quota of its own.
// Upstream authentication, credit requirements, rate limits, and Render resource limits still apply.

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = (process.env.UPSTREAM_BASE_URL || 'https://api-v2.imgupscaler.ai').replace(/\/+$/, '');
const API_KEY = process.env.API_KEY || '';
const TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 60000);
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 5 * 1024 * 1024);
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 24 * 1024 * 1024);
const UPLOAD_ALLOWED_HOST_SUFFIXES = (process.env.UPLOAD_ALLOWED_HOST_SUFFIXES || 'aliyuncs.com,amazonaws.com,cloudflarestorage.com,imgupscaler.ai,googleapis.com,myqcloud.com').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);

const TASK_KEYS = Object.freeze({
  'remove-object': 'router_free.me_remove_object_v1',
  'enhance': 'router_free.image_enhance_v1',
  'remove-background': 'router_free.me_remove_background_v1'
});

if (!API_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('API_KEY must be set in production. Add it to Render environment variables.');
}

function reply(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}

function allowedOrigin(origin) {
  if (!origin) return '';
  const list = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  if (list.includes('*')) return '*';
  return list.includes(origin) ? origin : '';
}

function cors(req, res) {
  const origin = allowedOrigin(req.headers.origin);
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization, X-Signed-Url, X-Upload-Method, X-Upload-Headers');
  }
}

function sameSecret(actual, expected) {
  const a = Buffer.from(String(actual || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function authorized(req) {
  if (!API_KEY) return true; // Development only; production requires API_KEY.
  const headerKey = req.headers['x-api-key'];
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return sameSecret(headerKey, API_KEY) || sameSecret(bearer, API_KEY);
}

function upstreamHeaders(req) {
  const headers = { Accept: 'application/json' };
  const type = req.headers['content-type'];
  if (type) headers['Content-Type'] = type;
  else if (req.method === 'POST') headers['Content-Type'] = 'application/json';

  // Credentials are stored ONLY on the server; the gateway API key is never sent upstream.
  if (process.env.IMGUPSCALER_COOKIE) headers.Cookie = process.env.IMGUPSCALER_COOKIE;
  if (process.env.IMGUPSCALER_AUTHORIZATION) headers.Authorization = process.env.IMGUPSCALER_AUTHORIZATION;
  if (process.env.IMGUPSCALER_ORIGIN) headers.Origin = process.env.IMGUPSCALER_ORIGIN;
  if (process.env.IMGUPSCALER_REFERER) headers.Referer = process.env.IMGUPSCALER_REFERER;

  // Optional extra upstream auth headers for your own authorized account.
  if (process.env.UPSTREAM_HEADERS_JSON) {
    const extra = JSON.parse(process.env.UPSTREAM_HEADERS_JSON);
    if (!extra || Array.isArray(extra) || typeof extra !== 'object') {
      throw new Error('UPSTREAM_HEADERS_JSON must be a JSON object');
    }
    for (const [key, value] of Object.entries(extra)) {
      if (typeof value !== 'string') throw new Error('Extra headers must contain string values');
      if (/^(host|content-length|connection|transfer-encoding)$/i.test(key)) continue;
      headers[key] = value;
    }
  }
  return headers;
}

async function readRequestBody(req, limit = MAX_BODY_BYTES) {
  const chunks = [];
  let count = 0;
  for await (const chunk of req) {
    count += chunk.length;
    if (count > limit) {
      const err = new Error('Request body too large');
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function proxy(req, res, upstreamPath) {
  const headers = upstreamHeaders(req);
  const opts = {
    method: req.method,
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS)
  };
  if (req.method === 'POST') opts.body = await readRequestBody(req);

  const upstream = await fetch(BASE_URL + upstreamPath, opts);
  const responseBytes = Buffer.from(await upstream.arrayBuffer());
  res.statusCode = upstream.status;
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (upstream.headers.get('retry-after')) res.setHeader('Retry-After', upstream.headers.get('retry-after'));
  res.end(responseBytes);
}

// Safe same-origin upload fallback for signed object-storage URLs that reject browser CORS.
// Deliberately restricted to HTTPS, public DNS hostnames, and configured provider domains.
function permittedSignedUploadUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 11000) return false;
  let parsed;
  try { parsed = new URL(raw); } catch { return false; }
  if (parsed.protocol !== 'https:' || parsed.port && parsed.port !== '443' || parsed.username || parsed.password) return false;
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (net.isIP(host) || host === 'localhost' || !host.includes('.')) return false;
  return UPLOAD_ALLOWED_HOST_SUFFIXES.some(suffix => host === suffix || host.endsWith('.' + suffix));
}

async function uploadSignedObject(req, res) {
  const destination = req.headers['x-signed-url'];
  if (!permittedSignedUploadUrl(destination)) return reply(res, 400, {
    ok: false, error: 'Signed storage host is not allowed. Set UPLOAD_ALLOWED_HOST_SUFFIXES for an authorized object-storage domain.'
  });
  const uploadMethod = String(req.headers['x-upload-method'] || 'PUT').toUpperCase();
  if (!['PUT', 'POST'].includes(uploadMethod)) return reply(res, 400, {ok: false, error: 'Unsupported signed upload method'});
  const headers = {};
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
  if (req.headers['x-upload-headers']) {
    let supplied;
    try { supplied = JSON.parse(req.headers['x-upload-headers']); }
    catch { return reply(res, 400, {ok:false, error: 'X-Upload-Headers must contain valid JSON'}); }
    if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied))
      return reply(res, 400, {ok:false, error: 'X-Upload-Headers must be an object'});
    for (const [k,v] of Object.entries(supplied)) {
      if (!/^(content-type|x-(?:amz|oss|goog)-[\w-]+)$/i.test(k) || typeof v !== 'string' || v.length > 4096)
        return reply(res, 400, {ok:false, error: 'Unsupported signed storage header'});
      headers[k] = v;
    }
  }
  try {
    const bytes = await readRequestBody(req, MAX_UPLOAD_BYTES);
    const upstream = await fetch(destination, { method: uploadMethod, headers, body: bytes, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!upstream.ok) return reply(res, 502, {ok:false, error:'Object storage rejected uploaded file', upstreamStatus:upstream.status});
    return reply(res, 200, {ok:true, upstreamStatus:upstream.status});
  } catch(err) {
    return reply(res, err.status || 502, {ok:false, error: err.status ? err.message : 'Signed upload could not be completed'});
  }
}

function findUpstreamPath(method, pathname, query) {
  // Friendly routes + routes identical to the original API.
  if (method === 'POST' && ['/api/upload/sign', '/api/common/upload/sign-object'].includes(pathname)) {
    return '/api/common/upload/sign-object';
  }
  if (method === 'POST' && ['/api/jobs/create', '/api/runtime/jobs/create-job'].includes(pathname)) {
    return '/api/runtime/jobs/create-job';
  }
  if (method === 'GET' && ['/api/credits', '/api/business/config/free-credits-config'].includes(pathname)) {
    return '/api/business/config/free-credits-config';
  }
  const jobMatch = pathname.match(/^\/api\/(?:jobs|runtime\/jobs)\/([A-Za-z0-9_-]{1,150})$/);
  if (method === 'GET' && jobMatch) {
    return '/api/runtime/jobs/' + encodeURIComponent(jobMatch[1]);
  }
  if (method === 'GET' && ['/api/task-config', '/api/runtime/system-parameters'].includes(pathname)) {
    const task = query.get('task');
    const fullKey = query.get('full_key') || TASK_KEYS[task];
    if (!Object.values(TASK_KEYS).includes(fullKey)) return null;
    return '/api/runtime/system-parameters?full_key=' + encodeURIComponent(fullKey);
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  const { pathname, searchParams } = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && pathname === '/api/health') {
    return reply(res, 200, { ok: true, service: 'imgupscaler-render-api', upstream: BASE_URL });
  }
  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    try {
      const html = await fs.promises.readFile(path.join(__dirname, 'index.html'));
      res.writeHead(200, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      return res.end(html);
    } catch { return reply(res, 500, {ok:false, error:'UI file not found'}); }
  }
  if (req.method === 'GET' && pathname === '/api') {
    return reply(res, 200, {
      message: 'ImgUpscaler Render API gateway',
      authentication: API_KEY ? 'X-API-Key header required' : 'Disabled (development only)',
      endpoints: {
        signUpload: 'POST /api/upload/sign',
        uploadObject: 'POST /api/upload/object (signed storage upload CORS fallback)',
        createJob: 'POST /api/jobs/create',
        jobStatus: 'GET /api/jobs/{JOB_ID}',
        freeCreditsConfig: 'GET /api/credits',
        taskConfig: 'GET /api/task-config?task=enhance|remove-object|remove-background',
        health: 'GET /api/health'
      },
      note: 'Send the real upstream JSON request body as-is. Does not bypass upstream quotas.'
    });
  }
  if (!authorized(req)) return reply(res, 401, { ok: false, error: 'Invalid or missing API key' });
  if (req.method === 'POST' && pathname === '/api/upload/object') return uploadSignedObject(req,res);
  const upstreamPath = findUpstreamPath(req.method, pathname, searchParams);
  if (!upstreamPath) return reply(res, 404, { ok: false, error: 'Unknown route or unsupported task' });
  try {
    await proxy(req, res, upstreamPath);
  } catch (err) {
    const status = err.status || (err.name === 'TimeoutError' ? 504 : 502);
    reply(res, status, { ok: false, error: status === 504 ? 'Upstream request timed out' : err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ImgUpscaler gateway listening on port ${PORT}`);
});
