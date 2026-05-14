'use strict';
/**
 * FLUENT Agent Loop
 * Implements goal-directed autonomous execution:
 *   Run agent with goal "..." and call the outcome result.
 *
 * The agent is given a goal, a set of tools, and a model.
 * It reasons → acts → observes in a loop until done or max_steps reached.
 */

const providers = require('../providers');

// ── Built-in agent tools ──────────────────────────────────────────────────────
const BUILTIN_TOOLS = {
  read_file: {
    description: 'Read a file from disk and return its contents.',
    params: { path: 'string' },
    async execute({ path: p }) {
      const fs = require('fs');
      if (!fs.existsSync(p)) return { error: `File not found: ${p}` };
      return { content: fs.readFileSync(p, 'utf8') };
    },
  },
  write_file: {
    description: 'Write content to a file on disk.',
    params: { path: 'string', content: 'string' },
    async execute({ path: p, content }) {
      const fs   = require('fs');
      const path = require('path');
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, content);
      return { success: true, path: p };
    },
  },
  list_files: {
    description: 'List files in a directory.',
    params: { directory: 'string' },
    async execute({ directory }) {
      const fs = require('fs');
      if (!fs.existsSync(directory)) return { error: `Directory not found: ${directory}` };
      const files = fs.readdirSync(directory);
      return { files };
    },
  },
  run_calculation: {
    description: 'Evaluate a safe mathematical expression.',
    params: { expression: 'string' },
    async execute({ expression }) {
      try {
        // Safe eval: only allow math chars
        if (/[^0-9+\-*/().% ]/.test(expression)) return { error: 'Unsafe expression' };
        // eslint-disable-next-line no-new-func
        const result = Function(`'use strict'; return (${expression})`)();
        return { result };
      } catch (e) {
        return { error: e.message };
      }
    },
  },
  web_search: {
    description: 'Search the web for information. Returns a summary.',
    params: { query: 'string' },
    async execute({ query }) {
      // In production, this would call a search API.
      // Here we return a mock with clear labelling.
      return {
        mock: true,
        note: 'Set BRAVE_API_KEY or SERP_API_KEY for real search.',
        query,
        results: [
          { title: `Search result 1 for: ${query}`, snippet: 'Mock snippet.' },
          { title: `Search result 2 for: ${query}`, snippet: 'Mock snippet.' },
        ],
      };
    },
  },
  http_get: {
    description: 'Fetch a URL and return the response body.',
    params: { url: 'string' },
    async execute({ url }) {
      const fetch = require('node-fetch');
      try {
        const res  = await fetch(url, { timeout: 10000 });
        const text = await res.text();
        let body;
        try { body = JSON.parse(text); } catch { body = text.slice(0, 2000); }
        return { status: res.status, ok: res.ok, body };
      } catch (e) {
        return { error: e.message };
      }
    },
  },
  remember: {
    description: 'Store a value in agent memory for later use.',
    params: { key: 'string', value: 'string' },
    async execute({ key, value }, memory) {
      memory[key] = value;
      return { stored: true, key };
    },
  },
  recall: {
    description: 'Retrieve a value from agent memory.',
    params: { key: 'string' },
    async execute({ key }, memory) {
      return { key, value: memory[key] ?? null };
    },
  },
};

// ── Agent executor ────────────────────────────────────────────────────────────
async function runAgent(opts, scope, tracer) {
  const {
    goal,
    model      = { alias: 'claude' },
    tools      = ['read_file', 'write_file', 'run_calculation', 'web_search'],
    max_steps  = 20,
    verbose    = false,
  } = opts;

  const chalk     = require('chalk');
  const memory    = {};
  const history   = [];   // conversation history for the agent
  const log       = [];   // step log for the outcome
  let   step      = 0;
  let   completed = false;
  let   finalAnswer = null;

  // Build tool registry
  const toolRegistry = {};
  for (const name of tools) {
    if (BUILTIN_TOOLS[name]) toolRegistry[name] = BUILTIN_TOOLS[name];
    // Custom tools from scope
    const custom = scope.get(`tool_${name}`);
    if (custom) toolRegistry[name] = custom;
  }

  // ── System prompt ───────────────────────────────────────────────────────
  const toolDescriptions = Object.entries(toolRegistry)
    .map(([name, t]) =>
      `- ${name}(${Object.keys(t.params || {}).join(', ')}): ${t.description}`)
    .join('\n');

  const systemPrompt = `You are an autonomous agent completing a goal.

GOAL: ${goal}

AVAILABLE TOOLS:
${toolDescriptions}
- done(answer): Call this when the goal is fully completed.

INSTRUCTIONS:
- Think step by step about what to do next.
- Call exactly ONE tool per response.
- Respond ONLY with valid JSON: {"thought": "...", "tool": "tool_name", "args": {...}}
- When the goal is complete, call done: {"thought": "...", "tool": "done", "args": {"answer": "..."}}
- Be concise. Be precise. Complete the goal efficiently.`;

  if (verbose) console.log(chalk.dim(`\n  [Agent] Goal: ${goal}`));

  // ── Agent loop ──────────────────────────────────────────────────────────
  while (step < max_steps && !completed) {
    step++;

    // Build user message with history
    const userMsg = history.length === 0
      ? `Begin working on the goal. What is your first action?`
      : `Continue. Previous steps:\n${history.slice(-6).map(h =>
          `Step ${h.step}: ${h.thought}\nTool: ${h.tool}(${JSON.stringify(h.args)})\nResult: ${JSON.stringify(h.result)}`
        ).join('\n\n')}`;

    // Call the model
    let raw;
    try {
      const response = await providers.call(
        model,
        userMsg,
        [],
        { system: systemPrompt, temperature: 0.2, max_tokens: 500 }
      );
      raw = response.text.trim();
    } catch (err) {
      log.push({ step, error: err.message });
      break;
    }

    // Parse model response
    let parsed;
    try {
      const clean = raw.replace(/```json\n?|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      // Model didn't produce valid JSON — try to extract
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); }
        catch { parsed = { thought: raw, tool: 'done', args: { answer: raw } }; }
      } else {
        parsed = { thought: raw, tool: 'done', args: { answer: raw } };
      }
    }

    const { thought = '', tool = 'done', args = {} } = parsed;

    if (verbose) {
      console.log(chalk.dim(`\n  [Agent Step ${step}]`));
      console.log(chalk.dim(`  Thought: ${thought.slice(0, 100)}`));
      console.log(chalk.dim(`  Tool:    ${tool}(${JSON.stringify(args).slice(0, 80)})`));
    }

    // ── Execute tool ──────────────────────────────────────────────────────
    let result;
    if (tool === 'done') {
      finalAnswer = args.answer || args.result || thought;
      completed   = true;
      result      = { done: true, answer: finalAnswer };
    } else if (toolRegistry[tool]) {
      try {
        result = await toolRegistry[tool].execute(args, memory);
      } catch (e) {
        result = { error: `Tool execution failed: ${e.message}` };
      }
    } else {
      result = { error: `Unknown tool: ${tool}. Available: ${Object.keys(toolRegistry).join(', ')}` };
    }

    if (verbose) {
      console.log(chalk.dim(`  Result:  ${JSON.stringify(result).slice(0, 120)}`));
    }

    history.push({ step, thought, tool, args, result });
    log.push({ step, thought, tool, args, result });
  }

  return {
    success:     completed,
    answer:      finalAnswer,
    steps_taken: step,
    goal,
    reason:      completed ? 'Goal completed' : `Stopped after ${step} steps (max_steps limit)`,
    history:     log,
    memory,
  };
}

module.exports = { runAgent, BUILTIN_TOOLS };
