'use strict';
/**
 * FLUENT File Runtime
 * Loads images, audio, video, and documents from disk (or uploaded buffers)
 * and returns structured typed values that the executor and providers understand.
 *
 * Typed file values:
 *   { type:'image',    path, mimeType, base64, size, width?, height? }
 *   { type:'audio',    path, mimeType, base64, size, durationMs? }
 *   { type:'video',    path, mimeType, base64, size, frames? }
 *   { type:'document', path, mimeType, text,   size, pages? }
 */

const fs   = require('fs');
const path = require('path');
const mime = require('mime-types');

// ── Image extensions we handle ────────────────────────────────────────────────
const IMAGE_EXTS = new Set(['.jpg','.jpeg','.png','.gif','.webp','.bmp','.svg']);
const AUDIO_EXTS = new Set(['.mp3','.wav','.ogg','.flac','.m4a','.aac','.opus']);
const VIDEO_EXTS = new Set(['.mp4','.mov','.avi','.mkv','.webm','.m4v']);
const DOC_EXTS   = new Set(['.pdf','.docx','.doc','.txt','.md','.csv','.json','.xml','.html']);

// ── Detect kind from extension ────────────────────────────────────────────────
function detectKind(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (DOC_EXTS.has(ext))   return 'document';
  return 'document';
}

// ── Main loadFile entry point ─────────────────────────────────────────────────
async function loadFile(kind, filePath, opts = {}) {
  // Accept both absolute and relative paths
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const inferredKind = kind === 'file' ? detectKind(resolved) : kind;
  const mimeType     = mime.lookup(resolved) || 'application/octet-stream';
  const stat         = fs.statSync(resolved);
  const size         = stat.size;

  switch (inferredKind) {
    case 'image':    return loadImage(resolved, mimeType, size);
    case 'audio':    return loadAudio(resolved, mimeType, size);
    case 'video':    return loadVideo(resolved, mimeType, size, opts);
    case 'document': return loadDocument(resolved, mimeType, size);
    default:         return loadDocument(resolved, mimeType, size);
  }
}

// ── Load image → base64 ───────────────────────────────────────────────────────
function loadImage(filePath, mimeType, size) {
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  return {
    type:     'image',
    path:     filePath,
    filename: path.basename(filePath),
    mimeType: mimeType || 'image/jpeg',
    base64,
    size,
    dataUri:  `data:${mimeType};base64,${base64}`,
  };
}

// ── Load image from Buffer (for uploaded files) ───────────────────────────────
function loadImageFromBuffer(buffer, filename, mimeType) {
  const base64 = buffer.toString('base64');
  return {
    type:     'image',
    path:     null,
    filename,
    mimeType: mimeType || 'image/jpeg',
    base64,
    size:     buffer.length,
    dataUri:  `data:${mimeType};base64,${base64}`,
  };
}

// ── Load audio → base64 ───────────────────────────────────────────────────────
function loadAudio(filePath, mimeType, size) {
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  return {
    type:     'audio',
    path:     filePath,
    filename: path.basename(filePath),
    mimeType: mimeType || 'audio/mpeg',
    base64,
    size,
    dataUri:  `data:${mimeType};base64,${base64}`,
  };
}

// ── Load audio from Buffer ────────────────────────────────────────────────────
function loadAudioFromBuffer(buffer, filename, mimeType) {
  const base64 = buffer.toString('base64');
  return {
    type:     'audio',
    path:     null,
    filename,
    mimeType: mimeType || 'audio/mpeg',
    base64,
    size:     buffer.length,
    dataUri:  `data:${mimeType};base64,${base64}`,
  };
}

// ── Load video → base64 (+ optional frame extraction) ────────────────────────
function loadVideo(filePath, mimeType, size, opts = {}) {
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  return {
    type:     'video',
    path:     filePath,
    filename: path.basename(filePath),
    mimeType: mimeType || 'video/mp4',
    base64,
    size,
    dataUri:  `data:${mimeType};base64,${base64}`,
    fps:      opts.fps || null,
    // frames would be populated by a future ffmpeg integration
    frames:   [],
  };
}

// ── Load video from Buffer ────────────────────────────────────────────────────
function loadVideoFromBuffer(buffer, filename, mimeType) {
  const base64 = buffer.toString('base64');
  return {
    type:     'video',
    path:     null,
    filename,
    mimeType: mimeType || 'video/mp4',
    base64,
    size:     buffer.length,
    dataUri:  `data:${mimeType};base64,${base64}`,
    frames:   [],
  };
}

// ── Load document → extract text ──────────────────────────────────────────────
async function loadDocument(filePath, mimeType, size) {
  const ext = path.extname(filePath).toLowerCase();

  let text = '';
  let pages = null;

  // Plain text / markdown / CSV / JSON / XML / HTML
  if (['.txt','.md','.csv','.json','.xml','.html'].includes(ext)) {
    text = fs.readFileSync(filePath, 'utf8');
  }
  // PDF
  else if (ext === '.pdf') {
    text = await extractPDF(filePath);
  }
  // DOCX
  else if (['.docx','.doc'].includes(ext)) {
    text = await extractDOCX(filePath);
  }
  else {
    // Fallback: try to read as UTF-8, or note as binary
    try {
      text = fs.readFileSync(filePath, 'utf8');
    } catch {
      text = `[Binary file: ${path.basename(filePath)}, ${(size / 1024).toFixed(1)} KB]`;
    }
  }

  return {
    type:     'document',
    path:     filePath,
    filename: path.basename(filePath),
    mimeType: mimeType || 'text/plain',
    text,
    size,
    pages,
  };
}

// ── Load document from Buffer ─────────────────────────────────────────────────
async function loadDocumentFromBuffer(buffer, filename, mimeType) {
  const ext = path.extname(filename).toLowerCase();
  let text = '';

  if (['.txt','.md','.csv','.json','.xml','.html'].includes(ext)) {
    text = buffer.toString('utf8');
  } else if (ext === '.pdf') {
    text = await extractPDFBuffer(buffer);
  } else if (['.docx','.doc'].includes(ext)) {
    text = await extractDOCXBuffer(buffer);
  } else {
    try { text = buffer.toString('utf8'); }
    catch { text = `[Binary file: ${filename}]`; }
  }

  return {
    type:     'document',
    path:     null,
    filename,
    mimeType: mimeType || 'text/plain',
    text,
    size:     buffer.length,
    pages:    null,
  };
}

// ── PDF text extraction ───────────────────────────────────────────────────────
async function extractPDF(filePath) {
  try {
    const pdfParse = require('pdf-parse');
    const buffer   = fs.readFileSync(filePath);
    const data     = await pdfParse(buffer);
    return data.text;
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      return `[PDF content — install pdf-parse to extract text: npm install pdf-parse]\nFile: ${filePath}`;
    }
    return `[PDF extraction failed: ${e.message}]`;
  }
}

async function extractPDFBuffer(buffer) {
  try {
    const pdfParse = require('pdf-parse');
    const data     = await pdfParse(buffer);
    return data.text;
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      return `[PDF content — install pdf-parse to extract text: npm install pdf-parse]`;
    }
    return `[PDF extraction failed: ${e.message}]`;
  }
}

// ── DOCX text extraction ──────────────────────────────────────────────────────
async function extractDOCX(filePath) {
  try {
    const mammoth = require('mammoth');
    const result  = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      return `[DOCX content — install mammoth to extract text: npm install mammoth]\nFile: ${filePath}`;
    }
    return `[DOCX extraction failed: ${e.message}]`;
  }
}

async function extractDOCXBuffer(buffer) {
  try {
    const mammoth = require('mammoth');
    const result  = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      return `[DOCX content — install mammoth to extract text: npm install mammoth]`;
    }
    return `[DOCX extraction failed: ${e.message}]`;
  }
}

// ── Helper: route buffer to correct loader by MIME ───────────────────────────
async function loadFromBuffer(buffer, filename, mimeType) {
  const kind = detectKind(filename);
  switch (kind) {
    case 'image':    return loadImageFromBuffer(buffer, filename, mimeType);
    case 'audio':    return loadAudioFromBuffer(buffer, filename, mimeType);
    case 'video':    return loadVideoFromBuffer(buffer, filename, mimeType);
    case 'document': return loadDocumentFromBuffer(buffer, filename, mimeType);
    default:         return loadDocumentFromBuffer(buffer, filename, mimeType);
  }
}

// ── Utility: is a value a typed file object? ─────────────────────────────────
function isFileValue(val) {
  return val && typeof val === 'object' &&
    ['image','audio','video','document'].includes(val.type);
}

module.exports = {
  loadFile,
  loadFromBuffer,
  loadImage,    loadImageFromBuffer,
  loadAudio,    loadAudioFromBuffer,
  loadVideo,    loadVideoFromBuffer,
  loadDocument, loadDocumentFromBuffer,
  isFileValue,
  detectKind,
  IMAGE_EXTS, AUDIO_EXTS, VIDEO_EXTS, DOC_EXTS,
};
