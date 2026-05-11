'use strict';
/**
 * FLUENT Standard Library
 * Pure built-in functions that execute without model calls.
 * All functions accept (value, ...args) and return a value.
 *
 * Categories:
 *   string  — split, join, trim, upper, lower, replace, length, slice, pad, etc.
 *   math    — round, floor, ceil, abs, sqrt, pow, min, max, clamp, random
 *   list    — first, last, sum, avg, count, unique, reverse, flatten, zip, chunk
 *   date    — format, parse, add, diff, now
 *   json    — parse, stringify
 *   type    — toNumber, toText, toBoolean, typeOf, isNull, isEmpty
 *   http    — fetch, post (async)
 */

const fetch = require('node-fetch');

// ═══════════════════════════════════════════════════════════════════════════
// STRING
// ═══════════════════════════════════════════════════════════════════════════
const string = {
  split(text, delimiter = ' ') {
    return String(text).split(delimiter);
  },
  join(list, delimiter = ', ') {
    return (Array.isArray(list) ? list : [list]).join(delimiter);
  },
  trim(text) {
    return String(text).trim();
  },
  trimStart(text) { return String(text).trimStart(); },
  trimEnd(text)   { return String(text).trimEnd();   },
  upper(text)  { return String(text).toUpperCase(); },
  lower(text)  { return String(text).toLowerCase(); },
  capitalize(text) {
    const s = String(text).trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  },
  titleCase(text) {
    return String(text).replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  },
  replace(text, search, replacement = '') {
    return String(text).split(search).join(replacement);
  },
  replaceFirst(text, search, replacement = '') {
    return String(text).replace(search, replacement);
  },
  replaceAll(text, search, replacement = '') {
    return String(text).split(search).join(replacement);
  },
  length(text) {
    return String(text).length;
  },
  wordCount(text) {
    return String(text).trim().split(/\s+/).filter(Boolean).length;
  },
  slice(text, start, end) {
    return String(text).slice(start, end);
  },
  first(text, n = 1) {
    return String(text).slice(0, n);
  },
  last(text, n = 1) {
    const s = String(text);
    return s.slice(Math.max(0, s.length - n));
  },
  includes(text, search) {
    return String(text).toLowerCase().includes(String(search).toLowerCase());
  },
  startsWith(text, prefix) {
    return String(text).startsWith(prefix);
  },
  endsWith(text, suffix) {
    return String(text).endsWith(suffix);
  },
  padStart(text, length, char = ' ') {
    return String(text).padStart(length, char);
  },
  padEnd(text, length, char = ' ') {
    return String(text).padEnd(length, char);
  },
  repeat(text, n) {
    return String(text).repeat(n);
  },
  reverse(text) {
    return String(text).split('').reverse().join('');
  },
  countOccurrences(text, search) {
    return String(text).split(search).length - 1;
  },
  matchPattern(text, pattern) {
    try {
      const re = new RegExp(pattern, 'gi');
      return String(text).match(re) || [];
    } catch { return []; }
  },
  extractNumbers(text) {
    return (String(text).match(/-?\d+\.?\d*/g) || []).map(Number);
  },
  removeWhitespace(text) {
    return String(text).replace(/\s+/g, '');
  },
  collapseWhitespace(text) {
    return String(text).replace(/\s+/g, ' ').trim();
  },
  slugify(text) {
    return String(text).toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
  },
  truncate(text, maxLen = 100, suffix = '…') {
    const s = String(text);
    return s.length <= maxLen ? s : s.slice(0, maxLen - suffix.length) + suffix;
  },
  lines(text) {
    return String(text).split(/\r?\n/);
  },
  template(templateStr, vars = {}) {
    return templateStr.replace(/\{(\w+)\}/g, (_, key) =>
      vars[key] !== undefined ? vars[key] : `{${key}}`
    );
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// MATH
// ═══════════════════════════════════════════════════════════════════════════
const math = {
  round(n, decimals = 0) {
    const factor = Math.pow(10, decimals);
    return Math.round(Number(n) * factor) / factor;
  },
  floor(n)  { return Math.floor(Number(n)); },
  ceil(n)   { return Math.ceil(Number(n));  },
  abs(n)    { return Math.abs(Number(n));   },
  sqrt(n)   { return Math.sqrt(Number(n));  },
  cbrt(n)   { return Math.cbrt(Number(n));  },
  pow(base, exp)     { return Math.pow(Number(base), Number(exp)); },
  log(n)             { return Math.log(Number(n)); },
  log2(n)            { return Math.log2(Number(n)); },
  log10(n)           { return Math.log10(Number(n)); },
  min(...args) {
    const nums = args.flat().map(Number).filter(n => !isNaN(n));
    return Math.min(...nums);
  },
  max(...args) {
    const nums = args.flat().map(Number).filter(n => !isNaN(n));
    return Math.max(...nums);
  },
  clamp(n, low, high) {
    return Math.min(Math.max(Number(n), Number(low)), Number(high));
  },
  random(low = 0, high = 1) {
    return Number(low) + Math.random() * (Number(high) - Number(low));
  },
  randomInt(low = 0, high = 100) {
    return Math.floor(Number(low) + Math.random() * (Number(high) - Number(low) + 1));
  },
  sign(n)    { return Math.sign(Number(n)); },
  isEven(n)  { return Number(n) % 2 === 0; },
  isOdd(n)   { return Number(n) % 2 !== 0; },
  percentage(part, total) { return (Number(part) / Number(total)) * 100; },
  add(a, b)  { return Number(a) + Number(b); },
  subtract(a, b) { return Number(a) - Number(b); },
  multiply(a, b) { return Number(a) * Number(b); },
  divide(a, b)   { return b !== 0 ? Number(a) / Number(b) : null; },
  modulo(a, b)   { return Number(a) % Number(b); },
  PI:  Math.PI,
  E:   Math.E,
  TAU: Math.PI * 2,
};

// ═══════════════════════════════════════════════════════════════════════════
// LIST
// ═══════════════════════════════════════════════════════════════════════════
const list = {
  first(arr, n = 1) {
    if (!Array.isArray(arr)) return arr;
    return n === 1 ? arr[0] : arr.slice(0, n);
  },
  last(arr, n = 1) {
    if (!Array.isArray(arr)) return arr;
    return n === 1 ? arr[arr.length - 1] : arr.slice(-n);
  },
  nth(arr, n) {
    return Array.isArray(arr) ? arr[n < 0 ? arr.length + n : n] : undefined;
  },
  count(arr) {
    return Array.isArray(arr) ? arr.length : (arr == null ? 0 : 1);
  },
  sum(arr) {
    return (Array.isArray(arr) ? arr : [arr]).reduce((s, v) => s + Number(v || 0), 0);
  },
  average(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    return list.sum(arr) / arr.length;
  },
  min(arr)   { return Math.min(...(Array.isArray(arr) ? arr : [arr]).map(Number)); },
  max(arr)   { return Math.max(...(Array.isArray(arr) ? arr : [arr]).map(Number)); },
  unique(arr) {
    if (!Array.isArray(arr)) return [arr];
    return [...new Set(arr.map(v => typeof v === 'object' ? JSON.stringify(v) : v))]
      .map(v => { try { return JSON.parse(v); } catch { return v; } });
  },
  reverse(arr) {
    return Array.isArray(arr) ? [...arr].reverse() : arr;
  },
  flatten(arr, depth = 1) {
    return Array.isArray(arr) ? arr.flat(depth) : [arr];
  },
  compact(arr) {
    return Array.isArray(arr) ? arr.filter(v => v != null && v !== '' && v !== false) : [];
  },
  chunk(arr, size) {
    const result = [];
    for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
    return result;
  },
  zip(...arrays) {
    const len = Math.min(...arrays.map(a => a.length));
    return Array.from({ length: len }, (_, i) => arrays.map(a => a[i]));
  },
  range(start, end, step = 1) {
    const result = [];
    for (let i = Number(start); i <= Number(end); i += Number(step)) result.push(i);
    return result;
  },
  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  sample(arr, n = 1) {
    const shuffled = list.shuffle(arr);
    return n === 1 ? shuffled[0] : shuffled.slice(0, n);
  },
  intersection(a, b) {
    const setB = new Set(b);
    return a.filter(v => setB.has(v));
  },
  difference(a, b) {
    const setB = new Set(b);
    return a.filter(v => !setB.has(v));
  },
  union(a, b) {
    return list.unique([...a, ...b]);
  },
  includes(arr, val) {
    return Array.isArray(arr) && arr.includes(val);
  },
  indexOf(arr, val) {
    return Array.isArray(arr) ? arr.indexOf(val) : -1;
  },
  frequencies(arr) {
    const freq = {};
    for (const v of arr) freq[v] = (freq[v] || 0) + 1;
    return freq;
  },
  pluck(arr, field) {
    return arr.map(item => item && item[field]);
  },
  groupBy(arr, key) {
    return arr.reduce((groups, item) => {
      const k = typeof key === 'function' ? key(item) : item[key];
      (groups[k] = groups[k] || []).push(item);
      return groups;
    }, {});
  },
  sortBy(arr, key, dir = 'asc') {
    const d = dir === 'desc' ? -1 : 1;
    return [...arr].sort((a, b) => {
      const va = typeof key === 'function' ? key(a) : (a && a[key]);
      const vb = typeof key === 'function' ? key(b) : (b && b[key]);
      if (va == null) return d;
      if (vb == null) return -d;
      return va < vb ? -d : va > vb ? d : 0;
    });
  },
  sumBy(arr, key) {
    return arr.reduce((s, item) => s + Number((item && item[key]) || 0), 0);
  },
  countBy(arr, key) {
    return arr.filter(item => item && item[key]).length;
  },
  append(arr, val) {
    return Array.isArray(arr) ? [...arr, val] : [arr, val];
  },
  prepend(arr, val) {
    return Array.isArray(arr) ? [val, ...arr] : [val, arr];
  },
  without(arr, ...vals) {
    return Array.isArray(arr) ? arr.filter(v => !vals.includes(v)) : arr;
  },
  take(arr, n) { return Array.isArray(arr) ? arr.slice(0, n) : []; },
  drop(arr, n) { return Array.isArray(arr) ? arr.slice(n) : []; },
};

// ═══════════════════════════════════════════════════════════════════════════
// DATE
// ═══════════════════════════════════════════════════════════════════════════
const date = {
  now()  { return new Date().toISOString(); },
  today(){ return new Date().toISOString().slice(0, 10); },
  parse(s) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString();
  },
  format(dateStr, fmt = 'YYYY-MM-DD') {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const pad = n => String(n).padStart(2, '0');
    return fmt
      .replace('YYYY', d.getFullYear())
      .replace('YY',   String(d.getFullYear()).slice(-2))
      .replace('MM',   pad(d.getMonth() + 1))
      .replace('DD',   pad(d.getDate()))
      .replace('HH',   pad(d.getHours()))
      .replace('mm',   pad(d.getMinutes()))
      .replace('ss',   pad(d.getSeconds()));
  },
  addDays(dateStr, n) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + Number(n));
    return d.toISOString();
  },
  addHours(dateStr, n) {
    const d = new Date(dateStr);
    d.setHours(d.getHours() + Number(n));
    return d.toISOString();
  },
  addMonths(dateStr, n) {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + Number(n));
    return d.toISOString();
  },
  diffDays(a, b) {
    const da = new Date(a), db = new Date(b);
    return Math.round((db - da) / (1000 * 60 * 60 * 24));
  },
  diffHours(a, b) {
    return Math.round((new Date(b) - new Date(a)) / (1000 * 60 * 60));
  },
  isBefore(a, b) { return new Date(a) < new Date(b); },
  isAfter(a, b)  { return new Date(a) > new Date(b); },
  isSameDay(a, b) {
    return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
  },
  dayOfWeek(dateStr) {
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
      [new Date(dateStr).getDay()];
  },
  monthName(dateStr) {
    return ['January','February','March','April','May','June',
            'July','August','September','October','November','December']
      [new Date(dateStr).getMonth()];
  },
  year(dateStr)  { return new Date(dateStr).getFullYear(); },
  month(dateStr) { return new Date(dateStr).getMonth() + 1; },
  day(dateStr)   { return new Date(dateStr).getDate(); },
  timestamp()    { return Date.now(); },
  fromTimestamp(ms) { return new Date(Number(ms)).toISOString(); },
};

// ═══════════════════════════════════════════════════════════════════════════
// JSON
// ═══════════════════════════════════════════════════════════════════════════
const json = {
  parse(str) {
    try {
      return JSON.parse(String(str).replace(/```json\n?|```/g, '').trim());
    } catch { return null; }
  },
  stringify(val, indent = 2) {
    return JSON.stringify(val, null, indent);
  },
  get(obj, path, defaultVal = null) {
    const parts = String(path).split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return defaultVal;
      cur = cur[p];
    }
    return cur !== undefined ? cur : defaultVal;
  },
  set(obj, path, val) {
    const parts = String(path).split('.');
    const result = { ...obj };
    let cur = result;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = { ...cur[parts[i]] };
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
    return result;
  },
  keys(obj)   { return obj ? Object.keys(obj)   : []; },
  values(obj) { return obj ? Object.values(obj) : []; },
  entries(obj){ return obj ? Object.entries(obj) : []; },
  merge(...objs) { return Object.assign({}, ...objs); },
  pick(obj, ...keys) {
    const result = {};
    for (const k of keys.flat()) if (k in obj) result[k] = obj[k];
    return result;
  },
  omit(obj, ...keys) {
    const ks = new Set(keys.flat());
    return Object.fromEntries(Object.entries(obj).filter(([k]) => !ks.has(k)));
  },
  flatten(obj, prefix = '', sep = '.') {
    const result = {};
    function walk(o, p) {
      for (const [k, v] of Object.entries(o)) {
        const key = p ? `${p}${sep}${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, key);
        else result[key] = v;
      }
    }
    walk(obj, prefix);
    return result;
  },
  isValid(str) {
    try { JSON.parse(str); return true; } catch { return false; }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPE
// ═══════════════════════════════════════════════════════════════════════════
const type = {
  toNumber(val) {
    if (val == null) return 0;
    if (typeof val === 'boolean') return val ? 1 : 0;
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  },
  toText(val) {
    if (val == null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  },
  toBoolean(val) {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;
    if (typeof val === 'string') {
      const s = val.toLowerCase().trim();
      return s === 'true' || s === 'yes' || s === '1' || s === 'on';
    }
    return val != null;
  },
  toList(val) {
    if (Array.isArray(val)) return val;
    if (val == null) return [];
    return [val];
  },
  typeOf(val) {
    if (val === null) return 'null';
    if (Array.isArray(val)) return 'list';
    if (val instanceof Date) return 'date';
    if (typeof val === 'object' && val.type) return val.type; // FluentFile
    return typeof val;
  },
  isNull(val)    { return val == null; },
  isNotNull(val) { return val != null; },
  isEmpty(val) {
    if (val == null) return true;
    if (typeof val === 'string') return val.trim() === '';
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === 'object') return Object.keys(val).length === 0;
    return false;
  },
  isNumber(val) { return typeof val === 'number' && !isNaN(val); },
  isText(val)   { return typeof val === 'string'; },
  isList(val)   { return Array.isArray(val); },
  isRecord(val) { return val !== null && typeof val === 'object' && !Array.isArray(val); },
  coerce(val, targetType) {
    switch (String(targetType).toLowerCase()) {
      case 'number': case 'integer': case 'decimal': return type.toNumber(val);
      case 'text':   case 'string':                  return type.toText(val);
      case 'boolean':                                return type.toBoolean(val);
      case 'list':   case 'array':                   return type.toList(val);
      case 'json':                                   return json.parse(type.toText(val));
      default: return val;
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// HTTP
// ═══════════════════════════════════════════════════════════════════════════
const http = {
  async get(url, headers = {}) {
    const res = await fetch(url, { headers });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, ok: res.ok, body, headers: Object.fromEntries(res.headers) };
  },
  async post(url, body, headers = {}) {
    const isObj = body && typeof body === 'object';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': isObj ? 'application/json' : 'text/plain',
        ...headers,
      },
      body: isObj ? JSON.stringify(body) : String(body),
    });
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: res.status, ok: res.ok, body: parsed };
  },
  async put(url, body, headers = {}) {
    const isObj = body && typeof body === 'object';
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': isObj ? 'application/json' : 'text/plain', ...headers },
      body: isObj ? JSON.stringify(body) : String(body),
    });
    const text = await res.text();
    let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: res.status, ok: res.ok, body: parsed };
  },
  async delete(url, headers = {}) {
    const res = await fetch(url, { method: 'DELETE', headers });
    return { status: res.status, ok: res.ok };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED RESOLVER
// Called by the executor to dispatch built-in function invocations.
// Returns { handled: true, value } or { handled: false }.
// ═══════════════════════════════════════════════════════════════════════════
async function resolve(raw, scope) {
  const s = raw.trim().toLowerCase();

  // ── String operations ──────────────────────────────────────────────────
  let m;

  // "split [var] by [delim]"
  m = raw.match(/^split\s+(\w+)\s+by\s+"([^"]*)"$/i) ||
      raw.match(/^split\s+(\w+)\s+by\s+(\S+)$/i);
  if (m) return { handled: true, value: string.split(scope.get(m[1]), m[2]) };

  // "[var] split by [delim]"
  m = raw.match(/^(\w+)\s+split\s+by\s+"([^"]*)"$/i);
  if (m) return { handled: true, value: string.split(scope.get(m[1]), m[2]) };

  // "join [var] with [delim]"
  m = raw.match(/^join\s+(\w+)\s+with\s+"([^"]*)"$/i);
  if (m) return { handled: true, value: string.join(scope.get(m[1]), m[2]) };

  // "[var] joined with [delim]" / "[var] joined by [delim]"
  m = raw.match(/^(\w+)\s+joined\s+(?:with|by)\s+"([^"]*)"$/i);
  if (m) return { handled: true, value: string.join(scope.get(m[1]), m[2]) };

  // "[var] in uppercase" / "[var] in lowercase"
  m = raw.match(/^(\w+)\s+in\s+uppercase$/i);
  if (m) return { handled: true, value: string.upper(scope.get(m[1])) };
  m = raw.match(/^(\w+)\s+in\s+lowercase$/i);
  if (m) return { handled: true, value: string.lower(scope.get(m[1])) };

  // "uppercase of [var]" / "lowercase of [var]"
  m = raw.match(/^uppercase\s+of\s+(\w+)$/i);
  if (m) return { handled: true, value: string.upper(scope.get(m[1])) };
  m = raw.match(/^lowercase\s+of\s+(\w+)$/i);
  if (m) return { handled: true, value: string.lower(scope.get(m[1])) };

  // "trim [var]" / "[var] trimmed" / "[var] with whitespace removed"
  // Specific patterns only — prevents false matches on vars named "trimmed"
  m = raw.match(/^trim\s+(\w+)$/i);
  if (m) return { handled: true, value: string.trim(scope.get(m[1])) };
  m = raw.match(/^(\w+)\s+trimmed$/i);
  if (m && scope.get(m[1]) !== undefined) return { handled: true, value: string.trim(scope.get(m[1])) };
  m = raw.match(/^(\w+)\s+with\s+whitespace\s+removed$/i);
  if (m) return { handled: true, value: string.trim(scope.get(m[1])) };

  // "the length of [var]" / "length of [var]"
  m = raw.match(/^(?:the\s+)?length\s+of\s+(\w+)$/i);
  if (m) return { handled: true, value: string.length(scope.get(m[1])) };

  // "the word count of [var]"
  m = raw.match(/^(?:the\s+)?word\s+count\s+of\s+(\w+)$/i);
  if (m) return { handled: true, value: string.wordCount(scope.get(m[1])) };

  // "replace [search] with [repl] in [var]"
  m = raw.match(/^replace\s+"([^"]*)"\s+with\s+"([^"]*)"\s+in\s+(\w+)$/i);
  if (m) return { handled: true, value: string.replace(scope.get(m[3]), m[1], m[2]) };

  // "[var] with [search] replaced by [repl]"
  m = raw.match(/^(\w+)\s+with\s+"([^"]*)"\s+replaced\s+(?:by|with)\s+"([^"]*)"$/i);
  if (m) return { handled: true, value: string.replace(scope.get(m[1]), m[2], m[3]) };

  // "the first [n] characters of [var]"
  m = raw.match(/^(?:the\s+)?first\s+(\d+)\s+characters?\s+of\s+(\w+)$/i);
  if (m) return { handled: true, value: string.first(scope.get(m[2]), parseInt(m[1])) };

  // "the last [n] characters of [var]"
  m = raw.match(/^(?:the\s+)?last\s+(\d+)\s+characters?\s+of\s+(\w+)$/i);
  if (m) return { handled: true, value: string.last(scope.get(m[2]), parseInt(m[1])) };

  // "truncate [var] to [n] characters"
  m = raw.match(/^truncate\s+(\w+)\s+to\s+(\d+)\s+characters?$/i);
  if (m) return { handled: true, value: string.truncate(scope.get(m[1]), parseInt(m[2])) };

  // "slugify [var]"
  m = raw.match(/^slugify\s+(\w+)$/i);
  if (m) return { handled: true, value: string.slugify(scope.get(m[1])) };

  // "capitalize [var]" / "[var] capitalized"
  m = raw.match(/^capitalize\s+(\w+)$|^(\w+)\s+capitalized$/i);
  if (m) return { handled: true, value: string.capitalize(scope.get(m[1] || m[2])) };

  // "title case [var]" / "[var] in title case"
  m = raw.match(/^(?:title\s+case\s+(\w+)|(\w+)\s+in\s+title\s+case)$/i);
  if (m) return { handled: true, value: string.titleCase(scope.get(m[1] || m[2])) };

  // "lines of [var]" / "[var] split into lines"
  m = raw.match(/^(?:lines\s+of\s+(\w+)|(\w+)\s+split\s+into\s+lines)$/i);
  if (m) return { handled: true, value: string.lines(scope.get(m[1] || m[2])) };

  // ── Math operations ────────────────────────────────────────────────────
  // "round [var] to [n] decimal places"
  m = raw.match(/^round\s+(\w+)\s+to\s+(\d+)\s+decimal\s+places?$/i);
  if (m) return { handled: true, value: math.round(scope.get(m[1]), parseInt(m[2])) };

  // "round [var]"
  m = raw.match(/^round(?:ed)?\s+(\w+)$/i);
  if (m) return { handled: true, value: math.round(scope.get(m[1])) };

  // "floor of [var]" / "the floor of [var]"
  m = raw.match(/^(?:the\s+)?floor\s+of\s+(\w+)$/i);
  if (m) return { handled: true, value: math.floor(scope.get(m[1])) };

  // "ceiling of [var]"
  m = raw.match(/^(?:the\s+)?ceiling\s+of\s+(\w+)$/i);
  if (m) return { handled: true, value: math.ceil(scope.get(m[1])) };

  // "absolute value of [var]"
  m = raw.match(/^(?:the\s+)?absolute\s+value\s+of\s+(\w+)$/i);
  if (m) return { handled: true, value: math.abs(scope.get(m[1])) };

  // "square root of [var]"
  m = raw.match(/^(?:the\s+)?square\s+root\s+of\s+(\w+)$/i);
  if (m) return { handled: true, value: math.sqrt(scope.get(m[1])) };

  // "[base] to the power of [exp]" / "[base] raised to [exp]"
  m = raw.match(/^(\w+)\s+to\s+the\s+power\s+of\s+(\w+)$/i) ||
      raw.match(/^(\w+)\s+raised\s+to\s+(\w+)$/i);
  if (m) {
    const base = scope.get(m[1]) ?? (isNaN(m[1]) ? 0 : Number(m[1]));
    const exp  = scope.get(m[2]) ?? (isNaN(m[2]) ? 0 : Number(m[2]));
    return { handled: true, value: math.pow(base, exp) };
  }

  // "the minimum of [var]" / "the maximum of [var]"
  m = raw.match(/^(?:the\s+)?minimum\s+of\s+(\w+)$/i);
  if (m) { const v = scope.get(m[1]); return { handled: true, value: Array.isArray(v) ? list.min(v) : v }; }
  m = raw.match(/^(?:the\s+)?maximum\s+of\s+(\w+)$/i);
  if (m) { const v = scope.get(m[1]); return { handled: true, value: Array.isArray(v) ? list.max(v) : v }; }

  // "a random number" / "a random number between [a] and [b]"
  m = raw.match(/^a\s+random\s+number\s+between\s+(\d+)\s+and\s+(\d+)$/i);
  if (m) return { handled: true, value: math.randomInt(parseInt(m[1]), parseInt(m[2])) };
  if (/^a random number$/i.test(raw)) return { handled: true, value: math.random() };

  // "percentage of [part] out of [total]" / "[part] percent of [total]"
  m = raw.match(/^percentage\s+of\s+(\w+)\s+out\s+of\s+(\w+)$/i);
  if (m) return { handled: true, value: math.percentage(scope.get(m[1]), scope.get(m[2])) };

  // ── List operations ────────────────────────────────────────────────────
  // "the first item of [var]" / "the first item in [var]"
  m = raw.match(/^(?:the\s+)?first\s+item\s+(?:of|in)\s+(\w+)$/i);
  if (m) return { handled: true, value: list.first(scope.get(m[1])) };

  // "the last item of [var]"
  m = raw.match(/^(?:the\s+)?last\s+item\s+(?:of|in)\s+(\w+)$/i);
  if (m) return { handled: true, value: list.last(scope.get(m[1])) };

  // "the sum of [var]"
  m = raw.match(/^(?:the\s+)?sum\s+of\s+(\w+)$/i);
  if (m) return { handled: true, value: list.sum(scope.get(m[1])) };

  // "the average of [var]"
  m = raw.match(/^(?:the\s+)?average\s+of\s+(\w+)$/i);
  if (m) return { handled: true, value: list.average(scope.get(m[1])) };

  // "the count of [var]" / "count of [var]"
  m = raw.match(/^(?:the\s+)?count\s+of\s+(\w+)$/i);
  if (m) { const v = scope.get(m[1]); return { handled: true, value: list.count(v) }; }

  // "unique items from [var]" / "unique items in [var]"
  m = raw.match(/^unique\s+items?\s+(?:from|in)\s+(\w+)$/i);
  if (m) return { handled: true, value: list.unique(scope.get(m[1])) };

  // "reverse [var]" / "[var] in reverse order" / "[var] reversed"
  m = raw.match(/^reverse\s+(\w+)$/i);
  if (m) return { handled: true, value: list.reverse(scope.get(m[1])) };
  m = raw.match(/^(\w+)\s+in\s+reverse\s+order$/i);
  if (m) return { handled: true, value: list.reverse(scope.get(m[1])) };
  m = raw.match(/^(\w+)\s+reversed$/i);
  if (m) return { handled: true, value: list.reverse(scope.get(m[1])) };

  // "a range from [a] to [b]" / "numbers from [a] to [b]"
  m = raw.match(/^(?:a\s+)?(?:range|numbers?)\s+from\s+(-?\d+)\s+to\s+(-?\d+)(?:\s+step\s+(-?\d+))?$/i);
  if (m) return { handled: true, value: list.range(m[1], m[2], m[3] || 1) };

  // "a shuffled [var]" / "shuffle [var]"
  m = raw.match(/^(?:a\s+)?shuffled?\s+(\w+)$/i);
  if (m) return { handled: true, value: list.shuffle(scope.get(m[1])) };

  // "a sample from [var]" / "random item from [var]"
  m = raw.match(/^(?:a\s+)?(?:sample|random\s+item)\s+from\s+(\w+)$/i);
  if (m) return { handled: true, value: list.sample(scope.get(m[1])) };

  // ── Date operations ────────────────────────────────────────────────────
  // "the current date"
  if (/^the current date$/i.test(raw)) return { handled: true, value: date.today() };
  if (/^the current datetime$/i.test(raw) || /^the current timestamp$/i.test(raw)) {
    return { handled: true, value: date.now() };
  }

  // "[var] formatted as [fmt]" / "format [var] as [fmt]"
  m = raw.match(/^(?:format\s+)?(\w+)\s+formatted\s+as\s+"([^"]+)"$/i) ||
      raw.match(/^format\s+(\w+)\s+as\s+"([^"]+)"$/i);
  if (m) return { handled: true, value: date.format(scope.get(m[1]), m[2]) };

  // "[var] plus [n] days/hours/months"
  m = raw.match(/^(\w+)\s+plus\s+(\d+)\s+(days?|hours?|months?)$/i);
  if (m) {
    const d = scope.get(m[1]);
    const n = parseInt(m[2]);
    const unit = m[3].toLowerCase();
    if (unit.startsWith('day'))   return { handled: true, value: date.addDays(d, n) };
    if (unit.startsWith('hour'))  return { handled: true, value: date.addHours(d, n) };
    if (unit.startsWith('month')) return { handled: true, value: date.addMonths(d, n) };
  }

  // "days between [a] and [b]"
  m = raw.match(/^days?\s+between\s+(\w+)\s+and\s+(\w+)$/i);
  if (m) return { handled: true, value: date.diffDays(scope.get(m[1]), scope.get(m[2])) };

  // ── JSON / Type operations ─────────────────────────────────────────────
  // "[var] parsed as JSON" / "parse [var] as JSON"
  m = raw.match(/^(?:parse\s+)?(\w+)\s+(?:parsed\s+)?as\s+json$/i);
  if (m) return { handled: true, value: json.parse(scope.get(m[1])) };

  // "[var] stringified as JSON" / "stringify [var]"
  m = raw.match(/^(?:stringify\s+)?(\w+)\s+(?:stringified\s+)?(?:as\s+json)?$/i);
  if (m && (s.includes('stringify') || s.includes('stringified'))) {
    return { handled: true, value: json.stringify(scope.get(m[1])) };
  }

  // "[var] converted to [type]"
  m = raw.match(/^(\w+)\s+converted\s+to\s+(\w+)$/i);
  if (m) return { handled: true, value: type.coerce(scope.get(m[1]), m[2]) };

  // "the type of [var]"
  m = raw.match(/^(?:the\s+)?type\s+of\s+(\w+)$/i);
  if (m) return { handled: true, value: type.typeOf(scope.get(m[1])) };

  // ── HTTP operations ────────────────────────────────────────────────────
  // "fetch [url]" / "fetch \"url\""
  m = raw.match(/^fetch\s+"([^"]+)"$/i);
  if (m) return { handled: true, value: await http.get(m[1]) };

  // "fetch [var]"
  m = raw.match(/^fetch\s+(\w+)$/i);
  if (m) { const url = scope.get(m[1]); return { handled: true, value: await http.get(url) }; }

  return { handled: false };
}

module.exports = { string, math, list, date, json, type, http, resolve };
