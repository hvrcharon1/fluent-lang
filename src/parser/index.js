'use strict';
/**
 * FLUENT Parser
 * Converts .fl natural-language source into an Abstract Syntax Tree (AST).
 *
 * Strategy:
 *   1. Preprocess: strip comments, collect annotations, join continuation lines
 *   2. Split into raw statement strings
 *   3. Parse each statement into a typed AST node
 */

// ── Node Types ────────────────────────────────────────────────────────────────
const T = {
  PROGRAM:       'Program',
  DECLARATION:   'Declaration',      // Let x be ...
  ASSIGNMENT:    'Assignment',       // Set x to ...
  ASK:           'Ask',              // Ask model to "..." using ... and call the result x.
  OUTPUT:        'Output',           // Output x.
  RETURN:        'Return',           // Return x.
  IF:            'If',               // If cond, then ... Otherwise ...
  FOR_EACH:      'ForEach',          // For each x in list: ... End loop.
  WHILE:         'While',            // While cond: ... End while.
  PARALLEL:      'Parallel',         // In parallel: ... End parallel.
  TRY:           'Try',              // Try to ... If that fails, ...
  FUNCTION_DEF:  'FunctionDef',      // To verb (params): ... End of verb.
  FUNCTION_CALL: 'FunctionCall',     // [result] be the result of verb arg.
  DEFINE_MODEL:  'DefineModel',      // Define model alias as provider/model with ...
  DEFINE_TYPE:   'DefineType',       // Define type Name as a record with ...
  DEFINE_PERSONA:'DefinePersona',    // Define persona x as "..."
  USE:           'Use',              // Use the procedures from "file".
  REMEMBER:      'Remember',         // Remember x as "...".
  RECALL:        'Recall',           // Recall memories similar to "..." and call result x.
  SEARCH:        'Search',           // Search knowledge_base for "..." and call result x.
  EMBED:         'Embed',            // Embed x using provider/model and call result y.
  VALIDATE:      'Validate',         // Validate x: ... End validate.
  TEST_BLOCK:    'TestBlock',        // Test "name": ... End test.
  EXPECT:        'Expect',           // Expect x to not be empty.
  STOP:          'Stop',             // Stop with error "...".
  RAW:           'Raw',              // Unrecognised — stored as raw text for fallback
  LOAD_FILE:     'LoadFile',         // load image/audio/video/document "path"
  // ── New v1.1 constructs ─────────────────────────────────────────────────────
  MATCH:         'Match',            // Match x: When "a": ... End match.
  FILTER:        'Filter',           // Filter list where cond and call result x.
  MAP_COLLECT:   'MapCollect',       // Map list to expr and call result x.
  SORT_COLLECT:  'SortCollect',      // Sort list by field desc and call result x.
  GROUP_COLLECT: 'GroupCollect',     // Group list by field and call result x.
  REDUCE_COLLECT:'ReduceCollect',    // Reduce list to sum and call result x.
  REPEAT:        'Repeat',           // Repeat N times: ... End repeat.
  UNLESS:        'Unless',           // Unless condition: ... End unless.
  USING_MODEL:   'UsingModel',       // Using model x with temp 0: ... End using.
  FETCH:         'Fetch',            // Fetch "url" and call result x.
  HTTP_POST:     'HttpPost',         // Post to "url" with body x and call result y.
  PIPE:          'Pipe',             // Pass x through f1, then f2 and call result y.
  APPEND_FILE:   'AppendFile',       // Append x to "file".
  EMIT:          'Emit',             // Emit "event" with data.
  RUN_AGENT:     'RunAgent',          // Run agent with goal "..." and call the outcome x.
  // Expression nodes
  LITERAL:       'Literal',
  IDENTIFIER:    'Identifier',
  FIELD_ACCESS:  'FieldAccess',
  RECORD:        'Record',
  LIST:          'List',
  CONDITION:     'Condition',
  ANNOTATION:    'Annotation',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function strLit(s)  { return { type: T.LITERAL, kind: 'string',  value: s }; }
function numLit(n)  { return { type: T.LITERAL, kind: 'number',  value: n }; }
function boolLit(b) { return { type: T.LITERAL, kind: 'boolean', value: b }; }
function ident(n)   { return { type: T.IDENTIFIER, name: n }; }

// ── Tokenise annotations and statements ──────────────────────────────────────
function preprocess(source) {
  const lines = source.split('\n');
  const items = [];   // { kind:'annotation'|'line', text, lineNo }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;   // empty or comment
    if (trimmed.startsWith('@')) {
      items.push({ kind: 'annotation', text: trimmed, lineNo: i + 1 });
    } else {
      items.push({ kind: 'line', text: trimmed, lineNo: i + 1 });
    }
  }

  // Group annotations with their following statement lines
  const grouped = [];  // { annotations: [], lines: [] }
  let current = null;

  for (const item of items) {
    if (item.kind === 'annotation') {
      if (!current) current = { annotations: [], lines: [] };
      current.annotations.push(item.text);
    } else {
      if (!current) current = { annotations: [], lines: [] };
      current.lines.push(item.text);

      // A group ends when we reach a line ending with '.' that is NOT
      // a block-continuation keyword (those are inside a block body).
      const joined = current.lines.join(' ');
      const isBlockEnd = /\b(End loop|End while|End parallel|End of .+|End when|End schedule|End validate|End test|End parallel loop)\s*\.?\s*$/i.test(joined);
      const isBlockStart = /:\s*$/.test(joined);
      if (!isBlockStart && joined.trim().endsWith('.')) {
        grouped.push(current);
        current = null;
      }
    }
  }
  if (current && current.lines.length) grouped.push(current);

  return grouped;
}

// ── Expression parser ─────────────────────────────────────────────────────────
function parseExpression(s) {
  s = s.trim().replace(/\.$/, '').trim();

  // String literal
  const strMatch = s.match(/^"((?:[^"\\]|\\.)*)"$/);
  if (strMatch) return strLit(strMatch[1]);

  // Number literal
  if (/^-?\d+(\.\d+)?$/.test(s)) return numLit(parseFloat(s));

  // Boolean
  if (s === 'true' || s === 'yes') return boolLit(true);
  if (s === 'false' || s === 'no') return boolLit(false);

  // "nothing" / "empty"
  if (s === 'nothing' || s === 'empty') return { type: T.LITERAL, kind: 'null', value: null };

  // the current date / datetime
  if (/^the current (date|datetime|time)$/i.test(s)) return { type: T.LITERAL, kind: 'date', value: 'NOW' };

  // the result of [fn] [args...]
  const resultOf = s.match(/^the result of\s+(.+)$/i);
  if (resultOf) {
    return { type: T.FUNCTION_CALL, raw: resultOf[1].trim() };
  }

  // a record with ...
  const recordMatch = s.match(/^a record with\s+(.+)$/i);
  if (recordMatch) return parseRecord(recordMatch[1]);

  // a list containing ...
  const listContaining = s.match(/^a list(?: of \w+)? containing\s+(.+)$/i);
  if (listContaining) return parseList(listContaining[1]);

  // a list of [type]
  const listOf = s.match(/^a list of .+$/i);
  if (listOf) return { type: T.LIST, elements: [] };

  // an optional [type]
  const optional = s.match(/^an optional .+$/i);
  if (optional) return { type: T.LITERAL, kind: 'null', value: null };

  // load image/audio/video/document/file "path" [sampled at N fps]
  const loadMatch = s.match(/^(?:load (image|audio|video|document)|read (file|document))\s+"([^"]+)"(?:\s+sampled at\s+([\d.]+)\s+frames? per second)?$/i);
  if (loadMatch) {
    const kind = (loadMatch[1] || loadMatch[2] || 'document').toLowerCase()
      .replace('file', 'document');
    return { type: T.LOAD_FILE, kind, path: loadMatch[3], fps: loadMatch[4] ? parseFloat(loadMatch[4]) : null };
  }

  // field.access
  if (/^[\w_]+\.[\w_.]+$/.test(s)) {
    const parts = s.split('.');
    let node = ident(parts[0]);
    for (let i = 1; i < parts.length; i++) {
      node = { type: T.FIELD_ACCESS, object: node, field: parts[i] };
    }
    return node;
  }

  // interpolated string: "..." var "..."  (multiple segments)
  if (/^".*"\s+\w/.test(s) || /\w\s+".*"$/.test(s)) {
    return { type: T.LITERAL, kind: 'interpolated', raw: s };
  }

  // arithmetic: x plus y, x minus y, x times y, ...
  const arith = s.match(/^(.+?)\s+(plus|minus|times|divided by)\s+(.+)$/i);
  if (arith) {
    const ops = { plus: '+', minus: '-', times: '*', 'divided by': '/' };
    return { type: 'Arithmetic', op: ops[arith[2].toLowerCase()], left: parseExpression(arith[1]), right: parseExpression(arith[3]) };
  }

  // or else fallback: x or else y
  const orElse = s.match(/^(.+?)\s+or else\s+(.+)$/i);
  if (orElse) return { type: 'OrElse', primary: parseExpression(orElse[1]), fallback: parseExpression(orElse[2]) };

  // Default: treat as identifier
  return ident(s.replace(/\s+/g, '_').toLowerCase());
}

// Tokenise a record string into alternating key/value tokens
function tokeniseRecord(s) {
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    if (/\s/.test(s[i])) { i++; continue; }
    if (s[i] === '"') {
      let j = i + 1;
      while (j < s.length && s[j] !== '"') j++;
      tokens.push({ kind: 'string', raw: s.slice(i, j + 1), val: s.slice(i + 1, j) });
      i = j + 1;
    } else {
      let j = i;
      while (j < s.length && !/\s/.test(s[j])) j++;
      const word = s.slice(i, j);
      if (/^-?\d+(\.\d+)?$/.test(word)) tokens.push({ kind: 'number', raw: word, val: parseFloat(word) });
      else tokens.push({ kind: 'word', raw: word, val: word });
      i = j;
    }
  }
  return tokens;
}

function parseRecord(s) {
  const fields = {};
  // If there are commas outside quotes → comma-delimited fields
  const parts = splitByComma(s);
  if (parts.length > 1) {
    for (const part of parts) {
      const trimmed = part.trim();
      const m = trimmed.match(/^(\w+)\s+(.+)$/);
      if (m) fields[m[1]] = parseExpression(m[2].trim());
    }
    return { type: T.RECORD, fields };
  }
  // No commas → tokenise and pair key/value tokens
  // Pattern: WORD (string|number|bool|nothing)  WORD (string|number|bool|nothing) ...
  const tokens = tokeniseRecord(s);
  let i = 0;
  while (i < tokens.length) {
    const keyTok = tokens[i];
    if (!keyTok || keyTok.kind !== 'word') { i++; continue; }
    const valTok = tokens[i + 1];
    if (!valTok) break;
    const key = keyTok.val;
    let value = null;
    if (valTok.kind === 'string') {
      value = strLit(valTok.val); i += 2;
    } else if (valTok.kind === 'number') {
      value = numLit(valTok.val); i += 2;
    } else if (valTok.kind === 'word') {
      const w = valTok.val.toLowerCase();
      if (w === 'true' || w === 'yes')   { value = boolLit(true);  i += 2; }
      else if (w === 'false' || w === 'no') { value = boolLit(false); i += 2; }
      else if (w === 'nothing' || w === 'null') { value = { type: T.LITERAL, kind: 'null', value: null }; i += 2; }
      else {
        // Two consecutive words — first is key, second might be the start of a value
        // Peek ahead: if the next-next token is a value type, treat current pair as key/identifier-value
        const nextTok = tokens[i + 2];
        if (!nextTok || nextTok.kind === 'word') {
          // Skip — probably ambiguous; try treating valTok as start of next key
          i++;
        } else {
          // valTok is a variable reference
          value = ident(valTok.val); i += 2;
        }
      }
    } else { i++; continue; }
    if (value !== null) fields[key] = value;
  }
  return { type: T.RECORD, fields };
}

function parseList(s) {
  const elements = splitByComma(s).map(e => parseExpression(e.trim().replace(/^and\s+/, '')));
  return { type: T.LIST, elements };
}

function splitByComma(s) {
  const parts = [];
  let depth = 0, current = '';
  for (const ch of s) {
    if (ch === '"') depth = depth === 0 ? 1 : 0;
    else if (ch === '(' ) depth++;
    else if (ch === ')' ) depth--;
    if (ch === ',' && depth === 0) { parts.push(current); current = ''; }
    else current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

// ── Condition parser ──────────────────────────────────────────────────────────
function parseCondition(s) {
  s = s.trim();

  // and / or (split on outermost)
  const andIdx = s.toLowerCase().indexOf(' and ');
  if (andIdx > 0) {
    return { type: T.CONDITION, op: 'and', left: parseCondition(s.slice(0, andIdx)), right: parseCondition(s.slice(andIdx + 5)) };
  }
  const orIdx = s.toLowerCase().indexOf(' or ');
  if (orIdx > 0) {
    return { type: T.CONDITION, op: 'or', left: parseCondition(s.slice(0, orIdx)), right: parseCondition(s.slice(orIdx + 4)) };
  }

  const ops = [
    [/^(.+?)\s+is greater than or equal to\s+(.+)$/i, '>='],
    [/^(.+?)\s+is less than or equal to\s+(.+)$/i,    '<='],
    [/^(.+?)\s+is greater than\s+(.+)$/i,             '>'],
    [/^(.+?)\s+is less than\s+(.+)$/i,                '<'],
    [/^(.+?)\s+is at least\s+(.+)$/i,                 '>='],
    [/^(.+?)\s+is at most\s+(.+)$/i,                  '<='],
    [/^(.+?)\s+is not\s+(.+)$/i,                      '!='],
    [/^(.+?)\s+is\s+(.+)$/i,                          '=='],
    [/^(.+?)\s+contains\s+(.+)$/i,                    'contains'],
    [/^(.+?)\s+does not contain\s+(.+)$/i,            '!contains'],
  ];

  for (const [re, op] of ops) {
    const m = s.match(re);
    if (m) return { type: T.CONDITION, op, left: parseExpression(m[1]), right: parseExpression(m[2]) };
  }

  if (/^(.+?)\s+exists$/i.test(s)) {
    const m = s.match(/^(.+?)\s+exists$/i);
    return { type: T.CONDITION, op: 'exists', left: parseExpression(m[1]) };
  }
  if (/^(.+?)\s+does not exist$/i.test(s)) {
    const m = s.match(/^(.+?)\s+does not exist$/i);
    return { type: T.CONDITION, op: '!exists', left: parseExpression(m[1]) };
  }
  if (/^(.+?)\s+is empty$/i.test(s)) {
    const m = s.match(/^(.+?)\s+is empty$/i);
    return { type: T.CONDITION, op: 'empty', left: parseExpression(m[1]) };
  }
  if (/^(.+?)\s+is not empty$/i.test(s)) {
    const m = s.match(/^(.+?)\s+is not empty$/i);
    return { type: T.CONDITION, op: '!empty', left: parseExpression(m[1]) };
  }

  // Fallback: treat as truthy check
  return { type: T.CONDITION, op: 'truthy', left: parseExpression(s) };
}

// ── Parse annotations ─────────────────────────────────────────────────────────
function parseAnnotations(anns) {
  return anns.map(a => {
    const m = a.match(/^@(\w+)(?:\((.+)\))?$/s);
    if (!m) return { type: T.ANNOTATION, name: a.slice(1), args: {} };
    const name = m[1];
    const args = {};
    if (m[2]) {
      // Simple key:value parsing
      const pairs = m[2].split(',').map(p => p.trim());
      for (const pair of pairs) {
        const kv = pair.match(/^(\w+)\s*:\s*(.+)$/);
        if (kv) args[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
      }
    }
    return { type: T.ANNOTATION, name, args };
  });
}

// ── Parse model reference ─────────────────────────────────────────────────────
function parseModelRef(s) {
  // "anthropic/claude-opus-4" or just "claude"
  if (s.includes('/')) {
    const [provider, model] = s.split('/');
    return { provider: provider.trim(), model: model.trim() };
  }
  return { alias: s.trim() };
}

// ── Parse a single statement group ───────────────────────────────────────────
function parseStatement(group) {
  const annotations = parseAnnotations(group.annotations || []);
  const text = group.lines.join(' ').replace(/\s+/g, ' ').trim();
  const t = text.replace(/\.$/, '').trim();

  // ── Let x be ... ────────────────────────────────────────────────────────
  const letMatch = t.match(/^Let\s+(\w+)\s+be\s+(.+)$/i);
  if (letMatch) {
    return { type: T.DECLARATION, annotations, name: letMatch[1], value: parseExpression(letMatch[2]) };
  }

  // ── Set x to ... ────────────────────────────────────────────────────────
  const setMatch = t.match(/^Set\s+(\w+(?:\.\w+)*)\s+to\s+(.+)$/i);
  if (setMatch) {
    return { type: T.ASSIGNMENT, annotations, target: setMatch[1], value: parseExpression(setMatch[2]) };
  }

  // ── Ask model to "..." [using ...] and call the result x ────────────────
  const askMatch = t.match(/^Ask\s+(.+?)\s+to\s+"([^"]+)"(.*?)(?:and (?:call the result|return the result)\s+(\w+(?:\.\w+)*))?\.?\s*$/i);
  if (askMatch) {
    const node = {
      type: T.ASK,
      annotations,
      model: parseModelRef(askMatch[1]),
      instruction: askMatch[2],
      inputs: [],
      result: askMatch[4] || null,
    };
    // Parse "using X y [, Z w]*" clauses
    const usingStr = askMatch[3] || '';
    const usingRe = /using\s+(\w+)\s+([^,]+?)(?=\s+using\s+|\s+and\s+|$)/gi;
    let um;
    while ((um = usingRe.exec(usingStr)) !== null) {
      node.inputs.push({ kind: um[1].toLowerCase(), value: parseExpression(um[2].trim()) });
    }
    return node;
  }

  // Ask with a variable prompt (no quotes)
  const askVarMatch = t.match(/^Ask\s+(.+?)\s+to\s+(.+?)(?:\s+and (?:call the result|return the result)\s+(\w+(?:\.\w+)*))?\.?\s*$/i);
  if (askVarMatch && !askVarMatch[2].startsWith('the result')) {
    const node = {
      type: T.ASK,
      annotations,
      model: parseModelRef(askVarMatch[1]),
      instruction: parseExpression(askVarMatch[2]),
      inputs: [],
      result: askVarMatch[3] || null,
    };
    return node;
  }

  // ── Output x ────────────────────────────────────────────────────────────
  const outputMatch = t.match(/^Output\s+(.+)$/i);
  if (outputMatch) {
    return { type: T.OUTPUT, annotations, value: parseExpression(outputMatch[1]) };
  }

  // ── Return x ────────────────────────────────────────────────────────────
  const returnMatch = t.match(/^Return\s+(.+)$/i);
  if (returnMatch) {
    return { type: T.RETURN, annotations, value: parseExpression(returnMatch[1]) };
  }

  // ── Stop with error ──────────────────────────────────────────────────────
  const stopMatch = t.match(/^(?:stop|Stop)\s+with\s+error\s+"([^"]+)"$/i);
  if (stopMatch) {
    return { type: T.STOP, message: stopMatch[1] };
  }

  // ── Define model alias as provider/model ────────────────────────────────
  const defineModel = t.match(/^Define model\s+(\w+)\s+as\s+(.+?)(?:\s+with\s+(.+))?\.?\s*$/i);
  if (defineModel) {
    const opts = {};
    if (defineModel[3]) {
      // parse: temperature 0.2, max_tokens 1000, system "..."
      const optStr = defineModel[3];
      const tempM = optStr.match(/temperature\s+([\d.]+)/i);
      if (tempM) opts.temperature = parseFloat(tempM[1]);
      const tokM = optStr.match(/max_tokens\s+(\d+)/i);
      if (tokM) opts.max_tokens = parseInt(tokM[1]);
      const sysM = optStr.match(/system\s+"([^"]+)"/i);
      if (sysM) opts.system = sysM[1];
    }
    return { type: T.DEFINE_MODEL, annotations, alias: defineModel[1], model: parseModelRef(defineModel[2].trim()), options: opts };
  }

  // ── Define persona ───────────────────────────────────────────────────────
  const definePersona = t.match(/^Define persona\s+(\w+)\s+as\s+"([^"]+)"$/i);
  if (definePersona) {
    return { type: T.DEFINE_PERSONA, name: definePersona[1], description: definePersona[2] };
  }

  // ── Use procedures from "file" ───────────────────────────────────────────
  const useMatch = t.match(/^Use the (?:procedures from|package)\s+"([^"]+)"(?:\s+(?:version\s+"[^"]+"))?(?:\s+and call it\s+(\w+))?/i);
  if (useMatch) {
    return { type: T.USE, source: useMatch[1], alias: useMatch[2] || null };
  }

  // ── Remember x as "..." ─────────────────────────────────────────────────
  const remMatch = t.match(/^Remember\s+(.+?)\s+as\s+"([^"]+)"$/i);
  if (remMatch) {
    return { type: T.REMEMBER, value: parseExpression(remMatch[1]), key: remMatch[2] };
  }

  // ── Recall memories similar to "..." and call the result x ──────────────
  const recMatch = t.match(/^Recall memories similar to\s+"([^"]+)"\s+and call the result\s+(\w+)/i);
  if (recMatch) {
    return { type: T.RECALL, query: recMatch[1], result: recMatch[2] };
  }


  // ── Filter / Map / Sort / Group / Reduce ────────────────────────────────
  const filterMatch = t.match(/^Filter\s+(\w+)\s+where\s+(.+?)\s+and call the result\s+(\w+)$/i);
  if (filterMatch) {
    return { type: T.FILTER, annotations, collection: ident(filterMatch[1]), condition: parseCondition(filterMatch[2]), result: filterMatch[3] };
  }

  const mapMatch = t.match(/^Map\s+(\w+)\s+to\s+(\w+(?:\.\w+)*)\s+and call the result\s+(\w+)$/i);
  if (mapMatch) {
    return { type: T.MAP_COLLECT, annotations, collection: ident(mapMatch[1]), transform: parseExpression(mapMatch[2]), result: mapMatch[3] };
  }

  const sortMatch = t.match(/^Sort\s+(\w+)\s+by\s+(\w+(?:\.\w+)*)\s+(ascending|descending|asc|desc)?\s*and call the result\s+(\w+)$/i);
  if (sortMatch) {
    return {
      type: T.SORT_COLLECT, annotations,
      collection: ident(sortMatch[1]),
      field: sortMatch[2],
      direction: (sortMatch[3] || 'asc').toLowerCase().startsWith('desc') ? 'desc' : 'asc',
      result: sortMatch[4],
    };
  }

  const groupMatch = t.match(/^Group\s+(\w+)\s+by\s+(\w+(?:\.\w+)*)\s+and call the result\s+(\w+)$/i);
  if (groupMatch) {
    return { type: T.GROUP_COLLECT, annotations, collection: ident(groupMatch[1]), field: groupMatch[2], result: groupMatch[3] };
  }

  const reduceMatch = t.match(/^Reduce\s+(\w+)\s+to\s+(sum|count|product|min|max|average|avg)\s+and call the result\s+(\w+)$/i);
  if (reduceMatch) {
    return { type: T.REDUCE_COLLECT, annotations, collection: ident(reduceMatch[1]), operation: reduceMatch[2].toLowerCase(), result: reduceMatch[3] };
  }

  // ── Fetch / Post / Pipe / Append / Emit ─────────────────────────────────
  const fetchMatch = t.match(/^Fetch\s+"([^"]+)"\s+and call the result\s+(\w+)$/i) ||
                     t.match(/^Fetch\s+(\w+)\s+and call the result\s+(\w+)$/i);
  if (fetchMatch) {
    return { type: T.FETCH, annotations, url: fetchMatch[1], method: 'GET', result: fetchMatch[2] };
  }

  const postMatch = t.match(/^Post\s+to\s+"([^"]+)"\s+with\s+body\s+(\w+)\s+and call the result\s+(\w+)$/i);
  if (postMatch) {
    return { type: T.HTTP_POST, annotations, url: postMatch[1], body: ident(postMatch[2]), result: postMatch[3] };
  }

  const pipeMatch = t.match(/^Pass\s+(\w+)\s+through\s+(.+?)\s+and call the result\s+(\w+)$/i);
  if (pipeMatch) {
    const steps = pipeMatch[2].split(/,\s*then\s+through\s+|,\s*then\s+/i).map(s => s.replace(/^through\s+/i,'').trim());
    return { type: T.PIPE, annotations, input: ident(pipeMatch[1]), steps, result: pipeMatch[3] };
  }

  const appendMatch = t.match(/^Append\s+(\w+)\s+to\s+"([^"]+)"$/i);
  if (appendMatch) {
    return { type: T.APPEND_FILE, annotations, value: ident(appendMatch[1]), path: appendMatch[2] };
  }

  const emitMatch = t.match(/^Emit\s+"([^"]+)"(?:\s+with\s+(\w+))?$/i);
  if (emitMatch) {
    return { type: T.EMIT, annotations, event: emitMatch[1], data: emitMatch[2] ? ident(emitMatch[2]) : null };
  }

  // ── Expect ... (inside test blocks) ─────────────────────────────────────
  const expectMatch = t.match(/^Expect\s+(.+?)\s+to\s+(.+)$/i);
  if (expectMatch) {
    return { type: T.EXPECT, subject: parseExpression(expectMatch[1]), assertion: expectMatch[2].trim() };
  }

  // ── If condition, then ... [Otherwise, ...] ──────────────────────────────
  // (handled at block level — see parseBlocks)


  // ── Run agent with goal ──────────────────────────────────────────────────
  const agentMatch = t.match(/^Run\s+agent\s+with\s+goal\s+"([^"]+)"(?:\s+and\s+call\s+the\s+outcome\s+(\w+))?$/i) ||
                     t.match(/^Run\s+agent\s+(\w+)\s+with\s+goal\s+"([^"]+)"(?:\s+and\s+call\s+the\s+outcome\s+(\w+))?$/i);
  if (agentMatch) {
    const isNamed = agentMatch[2] && !/^with$/i.test(agentMatch[2]);
    return {
      type: T.RUN_AGENT, annotations,
      goal:   agentMatch[1],
      agent:  null,
      result: agentMatch[2] || null,
    };
  }

  // ── Run multi-agent team ─────────────────────────────────────────────────
  const teamMatch = t.match(/^Run\s+multi-agent\s+team\s+(.+?)\s+on\s+(?:project\s+)?(.+?)\s+and\s+call\s+the\s+outcome\s+(\w+)$/i);
  if (teamMatch) {
    return {
      type: T.RUN_AGENT, annotations,
      goal:   teamMatch[2].replace(/^"(.*)"$/, '$1'),
      agents: teamMatch[1].split(/,\s*/),
      result: teamMatch[3],
    };
  }

  // ── Raw fallthrough ──────────────────────────────────────────────────
  return { type: T.RAW, annotations, text: t };
}

// ── Block-level parser ────────────────────────────────────────────────────────
// Handles If/For-each/While/In-parallel/To blocks which contain nested statements.
// Input: flat array of groups; Output: AST nodes

function parseGroups(groups) {
  const nodes = [];
  let i = 0;

  while (i < groups.length) {
    const group = groups[i];
    const text = group.lines.join(' ').trim();

    // ── If / When conditional ────────────────────────────────────────────
    const ifMatch = text.match(/^(?:If|When)\s+(.+?),?\s+then\s+(.+)$/i);
    if (ifMatch) {
      const condStr = ifMatch[1];
      const thenText = ifMatch[2].replace(/\.$/, '').trim();
      // Otherwise clause — next group
      let otherwise = null;
      if (i + 1 < groups.length) {
        const nextText = groups[i + 1].lines.join(' ').trim();
        if (/^Otherwise/i.test(nextText)) {
          const otherwiseMatch = nextText.match(/^Otherwise(?:,\s*|\s+)(.+)$/i);
          if (otherwiseMatch) {
            otherwise = parseStatement({ annotations: [], lines: [otherwiseMatch[1]] });
            i++;
          }
        }
      }
      nodes.push({
        type: T.IF,
        annotations: parseAnnotations(group.annotations || []),
        condition: parseCondition(condStr),
        then: parseStatement({ annotations: [], lines: [thenText] }),
        otherwise,
      });
      i++;
      continue;
    }

    // ── Try to ... If that fails, ... ───────────────────────────────────
    const tryMatch = text.match(/^Try to\s+(.+?)(?:\.\s*)?$/i);
    if (tryMatch) {
      const tryBody = parseStatement({ annotations: [], lines: [tryMatch[1]] });
      const fallbacks = [];
      while (i + 1 < groups.length) {
        const nextText = groups[i + 1].lines.join(' ').trim();
        const failMatch = nextText.match(/^If that(?:\s+also)?\s+fails?,\s+(.+)$/i);
        if (failMatch) {
          fallbacks.push(parseStatement({ annotations: [], lines: [failMatch[1]] }));
          i++;
        } else break;
      }
      nodes.push({ type: T.TRY, annotations: parseAnnotations(group.annotations || []), body: tryBody, fallbacks });
      i++;
      continue;
    }

    // ── For each x in y: ... End loop. ──────────────────────────────────
    const forMatch = text.match(/^(?:In parallel,\s+)?For each\s+(\w+)\s+in\s+(\w[\w.]*)\s*:(.*)$/i);
    if (forMatch) {
      const parallel = /^In parallel/i.test(text);
      const iterVar = forMatch[1];
      const collection = parseExpression(forMatch[2]);
      const inlineBody = forMatch[3].trim();
      const bodyGroups = [];
      if (inlineBody) bodyGroups.push({ annotations: [], lines: [inlineBody] });
      // Consume until "End loop"
      i++;
      while (i < groups.length) {
        const bt = groups[i].lines.join(' ').trim();
        if (/^End (?:parallel\s+)?loop\s*\.?$/i.test(bt)) { i++; break; }
        bodyGroups.push(groups[i]);
        i++;
      }
      nodes.push({ type: T.FOR_EACH, annotations: parseAnnotations(group.annotations || []), iterVar, collection, body: parseGroups(bodyGroups), parallel });
      continue;
    }

    // ── While cond: ... End while. ───────────────────────────────────────
    const whileMatch = text.match(/^While\s+(.+?)\s*:(.*)$/i);
    if (whileMatch) {
      const condition = parseCondition(whileMatch[1]);
      const bodyGroups = [];
      const inline = whileMatch[2].trim();
      if (inline) bodyGroups.push({ annotations: [], lines: [inline] });
      i++;
      while (i < groups.length) {
        const bt = groups[i].lines.join(' ').trim();
        if (/^End while\s*\.?$/i.test(bt)) { i++; break; }
        bodyGroups.push(groups[i]);
        i++;
      }
      nodes.push({ type: T.WHILE, annotations: parseAnnotations(group.annotations || []), condition, body: parseGroups(bodyGroups) });
      continue;
    }

    // ── In parallel: ... End parallel. ──────────────────────────────────
    const parallelMatch = text.match(/^In parallel\s*:\s*(.*)$/i);
    if (parallelMatch) {
      const bodyGroups = [];
      const inline = parallelMatch[1].trim();
      if (inline) bodyGroups.push({ annotations: [], lines: [inline] });
      i++;
      while (i < groups.length) {
        const bt = groups[i].lines.join(' ').trim();
        if (/^End parallel\s*\.?$/i.test(bt)) { i++; break; }
        bodyGroups.push(groups[i]);
        i++;
      }
      nodes.push({ type: T.PARALLEL, annotations: parseAnnotations(group.annotations || []), body: parseGroups(bodyGroups) });
      continue;
    }

    // ── To verb (params): ... End of verb. ──────────────────────────────
    const toMatch = text.match(/^To\s+(.+?)(?:\s*\(([^)]*)\))?\s*:\s*(.*)$/i);
    if (toMatch) {
      const verbPhrase = toMatch[1].trim();
      const paramsStr = toMatch[2] || '';
      const params = paramsStr ? paramsStr.split(',').map(p => p.trim()).filter(Boolean) : [];
      const bodyGroups = [];
      const inline = toMatch[3].trim();
      if (inline) bodyGroups.push({ annotations: [], lines: [inline] });
      i++;
      while (i < groups.length) {
        const bt = groups[i].lines.join(' ').trim();
        if (/^End of\s+.+\.?$/i.test(bt)) { i++; break; }
        bodyGroups.push(groups[i]);
        i++;
      }
      nodes.push({ type: T.FUNCTION_DEF, annotations: parseAnnotations(group.annotations || []), verb: verbPhrase, params, body: parseGroups(bodyGroups) });
      continue;
    }

    // ── Test "name": ... End test. ───────────────────────────────────────
    const testMatch = text.match(/^Test\s+"([^"]+)"\s*:\s*(.*)$/i);
    if (testMatch) {
      const testName = testMatch[1];
      const bodyGroups = [];
      const inline = testMatch[2].trim();
      if (inline) bodyGroups.push({ annotations: [], lines: [inline] });
      i++;
      while (i < groups.length) {
        const bt = groups[i].lines.join(' ').trim();
        if (/^End test\s*\.?$/i.test(bt)) { i++; break; }
        bodyGroups.push(groups[i]);
        i++;
      }
      nodes.push({ type: T.TEST_BLOCK, name: testName, body: parseGroups(bodyGroups) });
      continue;
    }

    // ── Validate x: ... End validate. ───────────────────────────────────
    const validateMatch = text.match(/^Validate\s+(\w+)\s*:\s*(.*)$/i);
    if (validateMatch) {
      const target = validateMatch[1];
      const bodyGroups = [];
      const inline = validateMatch[2].trim();
      if (inline) bodyGroups.push({ annotations: [], lines: [inline] });
      i++;
      while (i < groups.length) {
        const bt = groups[i].lines.join(' ').trim();
        if (/^End validate\s*\.?$/i.test(bt)) { i++; break; }
        bodyGroups.push(groups[i]);
        i++;
      }
      nodes.push({ type: T.VALIDATE, target: ident(target), body: parseGroups(bodyGroups) });
      continue;
    }

    // ── Otherwise (top-level; skip if hanging) ───────────────────────────
    if (/^Otherwise/i.test(text)) { i++; continue; }


    // ── Match x: When "a": ... Otherwise: ... End match. ─────────────────
    const matchKeyword = text.match(/^Match\s+(.+?)\s*:\s*(.*)$/i);
    if (matchKeyword) {
      const subjectStr = matchKeyword[1];
      const inlineRest = matchKeyword[2].trim(); // may contain "When ... : ..."
      const cases = [];
      let otherwise = null;

      // Helper to parse one When/Otherwise line
      function parseWhenLine(ct) {
        const wq = ct.match(/^When\s+"([^"]+)"\s*:\s*(.+)$/i);
        if (wq) { cases.push({ value: strLit(wq[1]), body: [parseStatement({ annotations: [], lines: [wq[2]] })] }); return true; }
        const wu = ct.match(/^When\s+(\S+)\s*:\s*(.+)$/i);
        if (wu) { cases.push({ value: parseExpression(wu[1]), body: [parseStatement({ annotations: [], lines: [wu[2]] })] }); return true; }
        const ow = ct.match(/^Otherwise\s*:\s*(.+)$/i);
        if (ow) { otherwise = parseStatement({ annotations: [], lines: [ow[1]] }); return true; }
        const ow2 = ct.match(/^Otherwise\s*:\s*$/i);
        if (ow2) { return true; }
        return false;
      }

      // If the Match line itself carried a When clause after the colon, parse it first
      if (inlineRest) parseWhenLine(inlineRest);

      i++;
      while (i < groups.length) {
        const ct = groups[i].lines.join(' ').trim();
        if (/^End\s+match\.?$/i.test(ct)) { i++; break; }
        parseWhenLine(ct);
        i++;
      }
      nodes.push({ type: T.MATCH, annotations: parseAnnotations(group.annotations || []), subject: parseExpression(subjectStr), cases, otherwise });
      continue;
    }

    // ── Repeat N times: ... End repeat. ──────────────────────────────────
    const repeatM = text.match(/^Repeat\s+(\d+|\w+)\s+times?\s*:\s*(.*)$/i);
    if (repeatM) {
      const countExpr = isNaN(repeatM[1]) ? ident(repeatM[1]) : numLit(parseInt(repeatM[1]));
      const bodyGroups = [];
      if (repeatM[2].trim()) bodyGroups.push({ annotations: [], lines: [repeatM[2].trim()] });
      i++;
      while (i < groups.length) {
        const bt = groups[i].lines.join(' ').trim();
        if (/^End\s+repeat\.?$/i.test(bt)) { i++; break; }
        bodyGroups.push(groups[i]); i++;
      }
      nodes.push({ type: T.REPEAT, annotations: parseAnnotations(group.annotations || []), count: countExpr, body: parseGroups(bodyGroups) });
      continue;
    }

    // ── Unless condition: ... End unless. ─────────────────────────────────
    const unlessM = text.match(/^Unless\s+(.+?)\s*:\s*(.*)$/i);
    if (unlessM) {
      const bodyGroups = [];
      if (unlessM[2].trim()) bodyGroups.push({ annotations: [], lines: [unlessM[2].trim()] });
      i++;
      while (i < groups.length) {
        const bt = groups[i].lines.join(' ').trim();
        if (/^End\s+unless\.?$/i.test(bt)) { i++; break; }
        bodyGroups.push(groups[i]); i++;
      }
      nodes.push({ type: T.UNLESS, annotations: parseAnnotations(group.annotations || []), condition: parseCondition(unlessM[1]), body: parseGroups(bodyGroups) });
      continue;
    }

    // ── Using model x [with temp 0]: ... End using. ───────────────────────
    const usingM = text.match(/^Using\s+model\s+(\w+)(?:\s+with\s+(.+?))?\s*:\s*(.*)$/i);
    if (usingM) {
      const alias = usingM[1];
      const opts = {};
      if (usingM[2]) {
        const tM = usingM[2].match(/temperature\s+([\d.]+)/i);
        if (tM) opts.temperature = parseFloat(tM[1]);
        const mM = usingM[2].match(/max_tokens\s+(\d+)/i);
        if (mM) opts.max_tokens = parseInt(mM[1]);
      }
      const bodyGroups = [];
      if (usingM[3].trim()) bodyGroups.push({ annotations: [], lines: [usingM[3].trim()] });
      i++;
      while (i < groups.length) {
        const bt = groups[i].lines.join(' ').trim();
        if (/^End\s+using\.?$/i.test(bt)) { i++; break; }
        bodyGroups.push(groups[i]); i++;
      }
      nodes.push({ type: T.USING_MODEL, annotations: parseAnnotations(group.annotations || []), alias, options: opts, body: parseGroups(bodyGroups) });
      continue;
    }

    // ── Single-line statement ────────────────────────────────────────────
    nodes.push(parseStatement(group));
    i++;
  }

  return nodes;
}

// ── Main parse entry point ────────────────────────────────────────────────────
function parse(source) {
  const groups = preprocess(source);
  const body   = parseGroups(groups);
  return { type: T.PROGRAM, body };
}

module.exports = { parse, T };
