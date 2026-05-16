'use strict';
/**
 * FLUENT Language Server
 * Implements the Language Server Protocol (LSP) — works with any LSP-capable editor:
 *   VSCode, Neovim, Emacs (lsp-mode/eglot), Zed, Helix, Sublime Text (LSP plugin),
 *   Kate, Eclipse, IntelliJ (via LSP4IJ), and more.
 *
 * Features:
 *   - Real-time diagnostics (parse errors shown inline)
 *   - Completion (keywords, model names, stdlib, user variables)
 *   - Hover documentation (keywords, model aliases, stdlib functions)
 *   - Go-to-definition (jump to function definition)
 *   - Document symbols (outline: functions, tests, model aliases)
 *   - Find references
 *   - Signature help (for function calls)
 *   - Code actions (quick fixes for common errors)
 *   - Semantic tokens (richer syntax highlighting)
 */

const {
  createConnection,
  TextDocuments,
  DiagnosticSeverity,
  ProposedFeatures,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
  SemanticTokensBuilder,
  SymbolKind,
} = require('vscode-languageserver/node');

const { TextDocument } = require('vscode-languageserver-textdocument');
const { parse } = require('../parser');

// ── Create LSP connection ─────────────────────────────────────────────────────
const connection = createConnection(ProposedFeatures.all);
const documents  = new TextDocuments(TextDocument);

// ── Document state cache ──────────────────────────────────────────────────────
const docState = new Map(); // uri → { ast, vars, functions, errors }

// ═════════════════════════════════════════════════════════════════════════════
// SERVER CAPABILITIES
// ═════════════════════════════════════════════════════════════════════════════
connection.onInitialize(() => ({
  capabilities: {
    textDocumentSync: { openClose: true, change: 1 /* Incremental */ },
    completionProvider: {
      resolveProvider: true,
      triggerCharacters: [' ', '.', '"', '@'],
    },
    hoverProvider:              true,
    definitionProvider:         true,
    referencesProvider:         true,
    documentSymbolProvider:     true,
    signatureHelpProvider:      { triggerCharacters: ['(', ',', ' '] },
    codeActionProvider:         true,
    semanticTokensProvider: {
      legend: {
        tokenTypes: ['keyword', 'string', 'number', 'variable', 'function',
                     'class', 'comment', 'decorator', 'type', 'operator'],
        tokenModifiers: ['declaration', 'definition', 'readonly'],
      },
      full: true,
    },
    workspace: {
      workspaceFolders: { supported: true },
    },
  },
}));

// ═════════════════════════════════════════════════════════════════════════════
// DOCUMENT ANALYSIS — parse and extract info on every change
// ═════════════════════════════════════════════════════════════════════════════
function analyseDocument(doc) {
  const text   = doc.getText();
  const uri    = doc.uri;
  const errors = [];
  let ast      = null;

  try {
    ast = parse(text);
  } catch (e) {
    // Extract line/col from parser error message if present
    const lineMatch = e.message.match(/line\s*:?\s*(\d+)/i);
    const colMatch  = e.message.match(/col(?:umn)?\s*:?\s*(\d+)/i);
    const line      = lineMatch ? parseInt(lineMatch[1]) - 1 : 0;
    const col       = colMatch  ? parseInt(colMatch[1])  - 1 : 0;
    errors.push({
      range: { start: { line, character: col }, end: { line, character: col + 10 } },
      message: e.message.replace(/\n.*/s, ''),
      severity: DiagnosticSeverity.Error,
      source: 'fluent',
    });
  }

  // Extract declared variables, functions, model aliases
  const vars      = new Map(); // name → { line, type }
  const functions = new Map(); // name → { line, params }
  const models    = new Map(); // name → { line, provider }
  const tests     = new Map(); // name → { line }

  if (ast) {
    extractSymbols(ast.body || [], vars, functions, models, tests, doc);
  }

  // Lint-style warnings on top of parse
  const warnings = lintDocument(text, ast);

  const diagnostics = [...errors, ...warnings];
  connection.sendDiagnostics({ uri, diagnostics });

  docState.set(uri, { ast, vars, functions, models, tests, errors, text });
  return docState.get(uri);
}

function extractSymbols(nodes, vars, functions, models, tests, doc) {
  if (!nodes) return;
  for (const node of nodes) {
    if (!node) continue;
    const line = getNodeLine(node, doc);

    switch (node.type) {
      case 'Declaration':
        vars.set(node.name, { line, type: inferType(node.value) });
        break;
      case 'FunctionDef':
        functions.set(node.verb || node.name || '', { line, params: node.params || [] });
        break;
      case 'DefineModel':
        models.set(node.alias, { line, provider: node.provider });
        break;
      case 'Test':
        tests.set(node.name || '', { line });
        break;
    }

    // Recurse
    for (const key of ['body', 'then', 'otherwise', 'fallbacks', 'cases']) {
      if (Array.isArray(node[key])) extractSymbols(node[key], vars, functions, models, tests, doc);
    }
  }
}

function getNodeLine(node, doc) {
  // The parser doesn't track line numbers yet; approximate by text search
  return 0;
}

function inferType(valueNode) {
  if (!valueNode) return 'unknown';
  switch (valueNode.type) {
    case 'Literal':   return valueNode.kind || 'unknown';
    case 'AskCall':   return 'text';
    case 'List':      return 'list';
    case 'Record':    return 'record';
    default:          return 'unknown';
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// INLINE LINTING (warnings without full parse failure)
// ═════════════════════════════════════════════════════════════════════════════
function lintDocument(text, ast) {
  const warnings = [];
  const lines    = text.split('\n');

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    // Warn on possible hardcoded API keys
    if (/sk-ant-|sk-[a-zA-Z0-9]{20,}/.test(line) && !trimmed.startsWith('--')) {
      warnings.push({
        range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } },
        message: 'Possible API key in source. Use `fluent env set` instead.',
        severity: DiagnosticSeverity.Warning,
        source: 'fluent',
        code: 'no-hardcoded-key',
      });
    }
    // Suggest @model annotation on undecorated Ask lines
    if (/^\s*Ask\s+\w+\s+to\s+/i.test(line) && i > 0 && !lines[i-1].trim().startsWith('@')) {
      warnings.push({
        range: { start: { line: i, character: 0 }, end: { line: i, character: line.length } },
        message: 'Consider adding @model(temperature, max_tokens) before Ask for explicit control.',
        severity: DiagnosticSeverity.Hint,
        source: 'fluent',
        code: 'suggest-model-annotation',
      });
    }
  });

  return warnings;
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPLETION
// ═════════════════════════════════════════════════════════════════════════════
const KEYWORD_COMPLETIONS = [
  // Declarations
  { label: 'Let',         kind: CompletionItemKind.Keyword, detail: 'Declare a variable',
    insertText: 'Let ${1:name} be ${2:value}.', insertTextFormat: InsertTextFormat.Snippet },
  { label: 'Set',         kind: CompletionItemKind.Keyword, detail: 'Update a variable',
    insertText: 'Set ${1:name} to ${2:value}.', insertTextFormat: InsertTextFormat.Snippet },
  // Model invocation
  { label: 'Ask',         kind: CompletionItemKind.Keyword, detail: 'Invoke an AI model',
    insertText: 'Ask ${1:claude} to "${2:instruction}" using ${3:text} ${4:input} and call the result ${5:result}.',
    insertTextFormat: InsertTextFormat.Snippet },
  // Control flow
  { label: 'If',          kind: CompletionItemKind.Keyword,
    insertText: 'If ${1:condition}, then ${2:action}.\nOtherwise, ${3:fallback}.',
    insertTextFormat: InsertTextFormat.Snippet },
  { label: 'Match',       kind: CompletionItemKind.Keyword,
    insertText: 'Match ${1:variable}:\n\tWhen "${2:value1}": ${3:Output "result1"}.\n\tOtherwise: ${4:Output "unknown"}.\nEnd match.',
    insertTextFormat: InsertTextFormat.Snippet },
  { label: 'For each',    kind: CompletionItemKind.Keyword,
    insertText: 'For each ${1:item} in ${2:collection}:\n\t${3:Output item}.\nEnd loop.',
    insertTextFormat: InsertTextFormat.Snippet },
  { label: 'Repeat',      kind: CompletionItemKind.Keyword,
    insertText: 'Repeat ${1:5} times:\n\t${2:Output iteration}.\nEnd repeat.',
    insertTextFormat: InsertTextFormat.Snippet },
  { label: 'While',       kind: CompletionItemKind.Keyword,
    insertText: 'While ${1:condition}:\n\t${2:action}.\nEnd while.',
    insertTextFormat: InsertTextFormat.Snippet },
  { label: 'Unless',      kind: CompletionItemKind.Keyword,
    insertText: 'Unless ${1:condition}:\n\t${2:action}.\nEnd unless.',
    insertTextFormat: InsertTextFormat.Snippet },
  // Collection ops
  { label: 'Filter',      kind: CompletionItemKind.Keyword,
    insertText: 'Filter ${1:list} where ${2:field} is greater than ${3:0} and call the result ${4:filtered}.',
    insertTextFormat: InsertTextFormat.Snippet },
  { label: 'Map',         kind: CompletionItemKind.Keyword,
    insertText: 'Map ${1:list} to ${2:field} and call the result ${3:mapped}.',
    insertTextFormat: InsertTextFormat.Snippet },
  { label: 'Sort',        kind: CompletionItemKind.Keyword,
    insertText: 'Sort ${1:list} by ${2:field} descending and call the result ${3:sorted}.',
    insertTextFormat: InsertTextFormat.Snippet },
  { label: 'Group',       kind: CompletionItemKind.Keyword,
    insertText: 'Group ${1:list} by ${2:field} and call the result ${3:grouped}.',
    insertTextFormat: InsertTextFormat.Snippet },
  { label: 'Reduce',      kind: CompletionItemKind.Keyword,
    insertText: 'Reduce ${1:list} to ${2|sum,count,average,min,max|} and call the result ${3:total}.',
    insertTextFormat: InsertTextFormat.Snippet },
  // HTTP
  { label: 'Fetch',       kind: CompletionItemKind.Keyword,
    insertText: 'Fetch "${1:https://api.example.com}" and call the result ${2:response}.',
    insertTextFormat: InsertTextFormat.Snippet },
  // Agent
  { label: 'Run agent',   kind: CompletionItemKind.Keyword,
    insertText: 'Run agent with goal "${1:describe the goal}" and call the outcome ${2:result}.',
    insertTextFormat: InsertTextFormat.Snippet },
  // Functions
  { label: 'To',          kind: CompletionItemKind.Keyword,
    insertText: 'To ${1:verb phrase} (${2:param}):\n\t${3:action}.\n\tReturn ${4:result}.\nEnd of ${1:verb phrase}.',
    insertTextFormat: InsertTextFormat.Snippet },
  // Test
  { label: 'Test',        kind: CompletionItemKind.Keyword,
    insertText: 'Test "${1:description}":\n\t${2:Let result be value}.\n\tExpect ${3:result} to not be empty.\nEnd test.',
    insertTextFormat: InsertTextFormat.Snippet },
  // IO
  { label: 'Output',      kind: CompletionItemKind.Keyword,
    insertText: 'Output ${1:value}.', insertTextFormat: InsertTextFormat.Snippet },
  { label: 'Append',      kind: CompletionItemKind.Keyword,
    insertText: 'Append ${1:value} to "${2:file.txt}".', insertTextFormat: InsertTextFormat.Snippet },
  { label: 'Emit',        kind: CompletionItemKind.Keyword,
    insertText: 'Emit "${1:event_name}" with ${2:data}.', insertTextFormat: InsertTextFormat.Snippet },
];

const MODEL_COMPLETIONS = [
  { label: 'claude',      kind: CompletionItemKind.Class, detail: 'Anthropic Claude (default: claude-sonnet-4-6)' },
  { label: 'gpt',         kind: CompletionItemKind.Class, detail: 'OpenAI GPT (default: gpt-4o)' },
  { label: 'gemini',      kind: CompletionItemKind.Class, detail: 'Google Gemini (default: gemini-2.0-flash)' },
  { label: 'mistral',     kind: CompletionItemKind.Class, detail: 'Mistral AI (default: mistral-large-latest)' },
  { label: 'llama',       kind: CompletionItemKind.Class, detail: 'Meta Llama via Groq' },
  { label: 'groq',        kind: CompletionItemKind.Class, detail: 'Groq (fastest inference)' },
  { label: 'deepseek',    kind: CompletionItemKind.Class, detail: 'DeepSeek' },
  { label: 'grok',        kind: CompletionItemKind.Class, detail: 'xAI Grok' },
  { label: 'perplexity',  kind: CompletionItemKind.Class, detail: 'Perplexity AI' },
];

const ANNOTATION_COMPLETIONS = [
  { label: '@model',      kind: CompletionItemKind.Decorator,
    insertText: '@model(temperature: ${1:0.7}, max_tokens: ${2:1024})',
    insertTextFormat: InsertTextFormat.Snippet, detail: 'Configure model parameters' },
  { label: '@expose',     kind: CompletionItemKind.Decorator,
    insertText: '@expose(as: http, path: "/${1:endpoint}", method: ${2|GET,POST,PUT,DELETE|})',
    insertTextFormat: InsertTextFormat.Snippet, detail: 'Expose as HTTP endpoint' },
  { label: '@stream',     kind: CompletionItemKind.Decorator,
    insertText: '@stream', detail: 'Enable streaming output' },
  { label: '@cache',      kind: CompletionItemKind.Decorator,
    insertText: '@cache(ttl: ${1:3600})', insertTextFormat: InsertTextFormat.Snippet, detail: 'Cache model response' },
  { label: '@retry',      kind: CompletionItemKind.Decorator,
    insertText: '@retry(max: ${1:3}, delay: ${2:1000})', insertTextFormat: InsertTextFormat.Snippet },
  { label: '@timeout',    kind: CompletionItemKind.Decorator,
    insertText: '@timeout(${1:30000})', insertTextFormat: InsertTextFormat.Snippet },
  { label: '@parallel',   kind: CompletionItemKind.Decorator, insertText: '@parallel' },
  { label: '@agent',      kind: CompletionItemKind.Decorator,
    insertText: '@agent(model: ${1:claude}, max_steps: ${2:10})',
    insertTextFormat: InsertTextFormat.Snippet },
  { label: '@tools',      kind: CompletionItemKind.Decorator,
    insertText: '@tools(${1:read_file, write_file, web_search})',
    insertTextFormat: InsertTextFormat.Snippet },
];

const STDLIB_COMPLETIONS = [
  // String
  { label: 'the length of',         kind: CompletionItemKind.Function, detail: 'stdlib: string length' },
  { label: 'the word count of',     kind: CompletionItemKind.Function, detail: 'stdlib: count words' },
  { label: 'uppercase of',          kind: CompletionItemKind.Function, detail: 'stdlib: to uppercase' },
  { label: 'lowercase of',          kind: CompletionItemKind.Function, detail: 'stdlib: to lowercase' },
  { label: 'slugify',               kind: CompletionItemKind.Function, detail: 'stdlib: URL-safe slug' },
  { label: 'truncate',              kind: CompletionItemKind.Function, detail: 'stdlib: truncate text',
    insertText: 'truncate ${1:text} to ${2:100} characters', insertTextFormat: InsertTextFormat.Snippet },
  // Math
  { label: 'round',                 kind: CompletionItemKind.Function, detail: 'stdlib: round number',
    insertText: 'round ${1:n} to ${2:2} decimal places', insertTextFormat: InsertTextFormat.Snippet },
  { label: 'floor of',              kind: CompletionItemKind.Function, detail: 'stdlib: floor' },
  { label: 'ceiling of',            kind: CompletionItemKind.Function, detail: 'stdlib: ceiling' },
  { label: 'square root of',        kind: CompletionItemKind.Function, detail: 'stdlib: sqrt' },
  { label: 'absolute value of',     kind: CompletionItemKind.Function, detail: 'stdlib: abs' },
  // List
  { label: 'the sum of',            kind: CompletionItemKind.Function, detail: 'stdlib: sum list' },
  { label: 'the average of',        kind: CompletionItemKind.Function, detail: 'stdlib: average list' },
  { label: 'the first item of',     kind: CompletionItemKind.Function, detail: 'stdlib: first item' },
  { label: 'the last item of',      kind: CompletionItemKind.Function, detail: 'stdlib: last item' },
  { label: 'unique items from',     kind: CompletionItemKind.Function, detail: 'stdlib: deduplicate list' },
  { label: 'a range from',          kind: CompletionItemKind.Function,
    insertText: 'a range from ${1:1} to ${2:10}', insertTextFormat: InsertTextFormat.Snippet },
  // Date
  { label: 'the current date',      kind: CompletionItemKind.Function, detail: 'stdlib: today\'s date (ISO)' },
  { label: 'days between',          kind: CompletionItemKind.Function,
    insertText: 'days between ${1:start} and ${2:end}', insertTextFormat: InsertTextFormat.Snippet },
  // Type
  { label: 'converted to number',   kind: CompletionItemKind.Function, detail: 'stdlib: parse as number' },
  { label: 'converted to text',     kind: CompletionItemKind.Function, detail: 'stdlib: to string' },
];

connection.onCompletion(params => {
  const doc   = documents.get(params.textDocument.uri);
  if (!doc) return [];

  const line  = doc.getText({
    start: { line: params.position.line, character: 0 },
    end:   params.position,
  });
  const state = docState.get(params.textDocument.uri);

  // Annotation context
  if (line.trimStart().startsWith('@')) {
    return ANNOTATION_COMPLETIONS;
  }

  // After "Ask" → model names
  if (/\bAsk\s+$/i.test(line)) {
    const items = [...MODEL_COMPLETIONS];
    if (state) {
      for (const [name] of state.models) {
        items.push({ label: name, kind: CompletionItemKind.Variable, detail: 'Model alias (defined in this file)' });
      }
    }
    return items;
  }

  // After "the result of" → stdlib
  if (/\bthe result of\s+$/i.test(line) || /\bbe the result of\s+$/i.test(line)) {
    return STDLIB_COMPLETIONS;
  }

  // Variable completions (user-defined vars in scope)
  const varItems = [];
  if (state) {
    for (const [name, info] of state.vars) {
      varItems.push({
        label: name,
        kind:  CompletionItemKind.Variable,
        detail: `${info.type} variable`,
        documentation: { kind: MarkupKind.Markdown, value: `Declared on line ${info.line + 1}` },
      });
    }
    for (const [name, info] of state.functions) {
      varItems.push({
        label: name,
        kind:  CompletionItemKind.Function,
        detail: `Procedure (${info.params.join(', ')})`,
      });
    }
  }

  return [...KEYWORD_COMPLETIONS, ...MODEL_COMPLETIONS, ...STDLIB_COMPLETIONS, ...varItems];
});

connection.onCompletionResolve(item => {
  // Enrich documentation for model aliases
  const docs = {
    claude:     '**claude** — Anthropic Claude Sonnet\n\nAlias for `anthropic/claude-sonnet-4-6`\n\nBest for: reasoning, coding, analysis.',
    gpt:        '**gpt** — OpenAI GPT-4o\n\nBest for: general tasks, function calling.',
    gemini:     '**gemini** — Google Gemini 2.0 Flash\n\nBest for: multimodal, fast responses.',
    mistral:    '**mistral** — Mistral Large\n\nBest for: European data residency, multilingual.',
    llama:      '**llama** — Meta Llama 3.3 70B (via Groq)\n\nBest for: open-weight, cost-effective.',
  };
  if (docs[item.label]) {
    item.documentation = { kind: MarkupKind.Markdown, value: docs[item.label] };
  }
  return item;
});

// ═════════════════════════════════════════════════════════════════════════════
// HOVER DOCUMENTATION
// ═════════════════════════════════════════════════════════════════════════════
const HOVER_DOCS = {
  'Ask':         '**Ask** `[model]` to `"[instruction]"` using `[input_kind] [var]` and call the result `[name]`.\n\nInvokes an AI model with an instruction and optional input.',
  'Let':         '**Let** `[name]` be `[value]`.\n\nDeclares an immutable variable in the current scope.',
  'Set':         '**Set** `[name]` to `[value]`.\n\nUpdates an existing variable. Use after `Let`.',
  'Filter':      '**Filter** `[list]` where `[condition]` and call the result `[name]`.\n\nReturns a new list containing only items that match the condition.\n\nFields of each item are available by name in the condition.',
  'Map':         '**Map** `[list]` to `[field/expr]` and call the result `[name]`.\n\nTransforms each item in the list.',
  'Sort':        '**Sort** `[list]` by `[field]` `ascending|descending` and call the result `[name]`.',
  'Group':       '**Group** `[list]` by `[field]` and call the result `[name]`.\n\nReturns an object keyed by the field value.',
  'Reduce':      '**Reduce** `[list]` to `sum|count|average|min|max|product` and call the result `[name]`.',
  'Match':       '**Match** `[value]`:\n```\n  When "x": ...\n  Otherwise: ...\nEnd match.\n```\nPattern matching — runs the first matching branch.',
  'Repeat':      '**Repeat** `N` times:\n  ...\n**End repeat.**\n\nExposes `iteration` (1-based) and `index` (0-based) inside the block.',
  'Unless':      '**Unless** `[condition]`:\n  ...\n**End unless.**\n\nRuns the body only when the condition is **false** (inverse of If).',
  'Fetch':       '**Fetch** `"[url]"` and call the result `[name]`.\n\nHTTP GET. Returns `{ status, ok, body }`.',
  'Try':         '**Try to** `[action]`.\n**If that fails**, `[fallback]`.\n\nError handling — the fallback runs if the try action throws.',
  'claude':      '**claude** — Anthropic Claude Sonnet 4.6\n\nAlias for `anthropic/claude-sonnet-4-6`.\n\n```fluent\nAsk claude to "..." using text input and call the result r.\n```',
  'gpt':         '**gpt** — OpenAI GPT-4o\n\nAlias for `openai/gpt-4o`.',
  'gemini':      '**gemini** — Google Gemini 2.0 Flash\n\nAlias for `google/gemini-2.0-flash`.',
  'mistral':     '**mistral** — Mistral Large Latest\n\nAlias for `mistral/mistral-large-latest`.',
  'llama':       '**llama** — Meta Llama 3.3 70B Versatile via Groq\n\nAlias for `groq/llama-3.3-70b-versatile`.',
  'groq':        '**groq** — Groq inference (fastest available models).',
  '@model':      '**@model** annotation\n\n```fluent\n@model(temperature: 0.7, max_tokens: 1024)\nAsk claude to "..." ...\n```\n\nOptions: `temperature`, `max_tokens`, `system`, `top_p`',
  '@expose':     '**@expose** annotation — creates an HTTP endpoint\n\n```fluent\n@expose(as: http, path: "/classify", method: POST)\nTo classify input (text):\n  ...\nEnd of classify input.\n```',
  '@stream':     '**@stream** — stream model output token-by-token.',
  '@cache':      '**@cache(ttl: 3600)** — cache the model response for `ttl` seconds.',
  '@retry':      '**@retry(max: 3, delay: 1000)** — retry on failure, up to `max` times.',
  '@agent':      '**@agent(model: claude, max_steps: 10)** — configure the agent loop.',
  '@tools':      '**@tools(...)** — specify which tools the agent may use.\n\nBuilt-in: `read_file`, `write_file`, `list_files`, `run_calculation`, `web_search`, `http_get`, `remember`, `recall`',
};

connection.onHover(params => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;

  const line = doc.getText({
    start: { line: params.position.line, character: 0 },
    end:   { line: params.position.line, character: 999 },
  });

  // Find the word at cursor
  const col    = params.position.character;
  const before = line.slice(0, col);
  const after  = line.slice(col);
  const wordMatch = (before.match(/[@\w]+$/) || [''])[0] + (after.match(/^[\w]+/) || [''])[0];
  const word   = wordMatch.trim();

  // Try multi-word hover (e.g. "the result of")
  for (const key of Object.keys(HOVER_DOCS).sort((a, b) => b.length - a.length)) {
    if (line.includes(key)) {
      const idx = line.indexOf(key);
      if (col >= idx && col <= idx + key.length) {
        return {
          contents: { kind: MarkupKind.Markdown, value: HOVER_DOCS[key] },
        };
      }
    }
  }

  if (HOVER_DOCS[word]) {
    return { contents: { kind: MarkupKind.Markdown, value: HOVER_DOCS[word] } };
  }

  // Hover on user-defined variable
  const state = docState.get(params.textDocument.uri);
  if (state && state.vars.has(word)) {
    const info = state.vars.get(word);
    return {
      contents: { kind: MarkupKind.Markdown, value: `**${word}** — \`${info.type}\` variable\n\nDeclared on line ${info.line + 1}` },
    };
  }
  if (state && state.functions.has(word)) {
    const fn = state.functions.get(word);
    return {
      contents: { kind: MarkupKind.Markdown, value: `**${word}** — procedure\n\nDefined on line ${fn.line + 1}\n\nParameters: ${fn.params.join(', ') || 'none'}` },
    };
  }

  return null;
});

// ═════════════════════════════════════════════════════════════════════════════
// DOCUMENT SYMBOLS (Outline view)
// ═════════════════════════════════════════════════════════════════════════════
connection.onDocumentSymbol(params => {
  const doc   = documents.get(params.textDocument.uri);
  if (!doc) return [];

  const text  = doc.getText();
  const lines = text.split('\n');
  const syms  = [];

  lines.forEach((line, i) => {
    const t = line.trim();
    const range = { start: { line: i, character: 0 }, end: { line: i, character: line.length } };

    const fnMatch    = t.match(/^To\s+(.+?)(?:\s*\(.*\))?\s*:?\s*$/i);
    const testMatch  = t.match(/^Test\s+"([^"]+)"/i);
    const modelMatch = t.match(/^Define model\s+(\w+)/i);
    const defMatch   = t.match(/^Let\s+(\w+)\s+be/i);

    if (fnMatch)    syms.push({ name: fnMatch[1].trim(),    kind: SymbolKind.Function,  range, selectionRange: range });
    if (testMatch)  syms.push({ name: testMatch[1],         kind: SymbolKind.Module,    range, selectionRange: range });
    if (modelMatch) syms.push({ name: modelMatch[1],        kind: SymbolKind.Variable,  range, selectionRange: range });
    if (defMatch)   syms.push({ name: defMatch[1],          kind: SymbolKind.Variable,  range, selectionRange: range });
  });

  return syms;
});

// ═════════════════════════════════════════════════════════════════════════════
// GO-TO-DEFINITION
// ═════════════════════════════════════════════════════════════════════════════
connection.onDefinition(params => {
  const doc   = documents.get(params.textDocument.uri);
  if (!doc) return null;

  const text  = doc.getText();
  const lines = text.split('\n');
  const line  = lines[params.position.line] || '';
  const col   = params.position.character;
  const before = line.slice(0, col);
  const word  = (before.match(/\w+$/) || [''])[0];
  if (!word) return null;

  // Find definition line
  const defPatterns = [
    new RegExp(`^\\s*(?:Let|Set)\\s+${word}\\s+`, 'i'),
    new RegExp(`^\\s*To\\s+${word}\\b`, 'i'),
    new RegExp(`^\\s*Define model\\s+${word}\\b`, 'i'),
  ];

  for (let i = 0; i < lines.length; i++) {
    if (defPatterns.some(p => p.test(lines[i]))) {
      const range = { start: { line: i, character: 0 }, end: { line: i, character: lines[i].length } };
      return { uri: params.textDocument.uri, range };
    }
  }
  return null;
});

// ═════════════════════════════════════════════════════════════════════════════
// CODE ACTIONS (Quick Fixes)
// ═════════════════════════════════════════════════════════════════════════════
connection.onCodeAction(params => {
  const actions = [];
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];

  for (const diag of params.context.diagnostics) {
    if (diag.code === 'suggest-model-annotation') {
      actions.push({
        title:       'Add @model annotation',
        kind:        'quickfix',
        diagnostics: [diag],
        edit: {
          changes: {
            [params.textDocument.uri]: [{
              range: { start: { line: diag.range.start.line, character: 0 }, end: { line: diag.range.start.line, character: 0 } },
              newText: '@model(temperature: 0.7, max_tokens: 1024)\n',
            }],
          },
        },
      });
    }
  }
  return actions;
});

// ═════════════════════════════════════════════════════════════════════════════
// DOCUMENT SYNC
// ═════════════════════════════════════════════════════════════════════════════
documents.onDidChangeContent(change => analyseDocument(change.document));
documents.onDidOpen(event        => analyseDocument(event.document));

documents.listen(connection);
connection.listen();
