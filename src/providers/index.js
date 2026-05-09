'use strict';
/**
 * FLUENT Provider Registry
 * Unified interface over Anthropic, OpenAI, Google, Mistral, Groq, and OpenAI-compatible APIs.
 */

const fetch = require('node-fetch');

// ── Default model aliases ─────────────────────────────────────────────────────
const ALIASES = {
  claude:      { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  anthropic:   { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  gpt:         { provider: 'openai',    model: 'gpt-4o' },
  openai:      { provider: 'openai',    model: 'gpt-4o' },
  gemini:      { provider: 'google',    model: 'gemini-2.0-flash' },
  google:      { provider: 'google',    model: 'gemini-2.0-flash' },
  mistral:     { provider: 'mistral',   model: 'mistral-large-latest' },
  llama:       { provider: 'groq',      model: 'llama-3.3-70b-versatile' },
  meta:        { provider: 'groq',      model: 'llama-3.3-70b-versatile' },
  groq:        { provider: 'groq',      model: 'llama-3.3-70b-versatile' },
  deepseek:    { provider: 'deepseek',  model: 'deepseek-chat' },
  grok:        { provider: 'xai',       model: 'grok-3-mini' },
  xai:         { provider: 'xai',       model: 'grok-3-mini' },
  perplexity:  { provider: 'perplexity',model: 'sonar-pro' },
};

// ── Pricing table (per 1M tokens, USD) ───────────────────────────────────────
const PRICING = {
  'anthropic/claude-opus-4':         { input: 15.0,  output: 75.0  },
  'anthropic/claude-sonnet-4-6':     { input: 3.0,   output: 15.0  },
  'anthropic/claude-haiku-4-5':      { input: 0.8,   output: 4.0   },
  'openai/gpt-4o':                   { input: 2.5,   output: 10.0  },
  'openai/gpt-4.1':                  { input: 2.0,   output: 8.0   },
  'openai/o4-mini':                  { input: 1.1,   output: 4.4   },
  'google/gemini-2.0-flash':         { input: 0.1,   output: 0.4   },
  'google/gemini-2.5-pro':           { input: 1.25,  output: 10.0  },
  'mistral/mistral-large-latest':    { input: 2.0,   output: 6.0   },
  'groq/llama-3.3-70b-versatile':    { input: 0.59,  output: 0.79  },
  'deepseek/deepseek-chat':          { input: 0.27,  output: 1.1   },
  'xai/grok-3-mini':                 { input: 0.3,   output: 0.5   },
};

// ── Custom provider registry ──────────────────────────────────────────────────
const customProviders = {};
const customAliases   = {};

function registerProvider(name, config) {
  customProviders[name] = config;
}

function registerAlias(alias, ref) {
  customAliases[alias] = ref;
}

// ── Resolve model ref to {provider, model} ────────────────────────────────────
function resolveModel(modelRef) {
  if (modelRef.provider && modelRef.model) return modelRef;
  const alias = modelRef.alias ? modelRef.alias.toLowerCase() : null;
  if (alias) {
    if (customAliases[alias]) return customAliases[alias];
    if (ALIASES[alias]) return ALIASES[alias];
  }
  // Default
  return { provider: 'anthropic', model: 'claude-sonnet-4-6' };
}

// ── Estimate token count (rough heuristic) ───────────────────────────────────
function estimateTokens(text) {
  if (typeof text !== 'string') text = JSON.stringify(text);
  return Math.ceil(text.length / 4);
}

function estimateCost(provider, model, inputTokens, outputTokens) {
  const key = `${provider}/${model}`;
  const price = PRICING[key];
  if (!price) return { input: 0, output: 0, total: 0, unknown: true };
  const inputCost  = (inputTokens  / 1_000_000) * price.input;
  const outputCost = (outputTokens / 1_000_000) * price.output;
  return { input: inputCost, output: outputCost, total: inputCost + outputCost };
}

// ── Core call function ────────────────────────────────────────────────────────
async function call(modelRef, instruction, inputs = [], options = {}) {
  const resolved = resolveModel(modelRef);
  const { provider, model } = resolved;

  // Build the messages array
  const systemPrompt = options.system || null;
  let userContent = '';

  if (typeof instruction === 'string') {
    userContent = instruction;
  } else {
    // instruction is an expression result
    userContent = String(instruction);
  }

  // Append input data to user content
  for (const inp of inputs) {
    const val = typeof inp.value === 'object' ? JSON.stringify(inp.value, null, 2) : String(inp.value ?? '');
    if (inp.kind === 'text') userContent += `\n\n${val}`;
    else if (inp.kind === 'data') userContent += `\n\nData:\n${val}`;
    else if (inp.kind === 'context') userContent += `\n\nContext:\n${val}`;
    else if (inp.kind === 'document') userContent += `\n\nDocument:\n${val}`;
    else if (inp.kind === 'question') userContent += `\n\nQuestion: ${val}`;
    else userContent += `\n\n[${inp.kind}]: ${val}`;
  }

  const callOpts = {
    temperature:  options.temperature  ?? 0.7,
    max_tokens:   options.max_tokens   ?? 1024,
    systemPrompt: options.system       ?? null,
    format:       options.format       ?? null,
  };

  if (options.format === 'json') {
    userContent += '\n\nRespond with valid JSON only. No markdown, no explanation.';
  }

  let result;
  try {
    result = await callProvider(provider, model, systemPrompt, userContent, callOpts);
  } catch (err) {
    // If provider key missing, return a descriptive mock
    if (err.code === 'NO_KEY') {
      return {
        text: `[FLUENT MOCK — set ${err.envKey} to call ${provider}/${model}] Simulated response for: "${userContent.slice(0, 80)}..."`,
        model: `${provider}/${model}`,
        input_tokens: estimateTokens(userContent),
        output_tokens: 50,
        mock: true,
      };
    }
    throw err;
  }

  return result;
}

// ── Per-provider API calls ────────────────────────────────────────────────────
async function callProvider(provider, model, systemPrompt, userContent, opts) {
  if (customProviders[provider]) {
    return callOpenAICompatible(customProviders[provider].url, model, systemPrompt, userContent, opts, null);
  }

  switch (provider) {
    case 'anthropic': return callAnthropic(model, systemPrompt, userContent, opts);
    case 'openai':    return callOpenAI(model, systemPrompt, userContent, opts);
    case 'google':    return callGoogle(model, systemPrompt, userContent, opts);
    case 'mistral':   return callMistral(model, systemPrompt, userContent, opts);
    case 'groq':      return callOpenAICompatible('https://api.groq.com/openai/v1', model, systemPrompt, userContent, opts, 'GROQ_API_KEY');
    case 'deepseek':  return callOpenAICompatible('https://api.deepseek.com/v1', model, systemPrompt, userContent, opts, 'DEEPSEEK_API_KEY');
    case 'xai':       return callOpenAICompatible('https://api.x.ai/v1', model, systemPrompt, userContent, opts, 'XAI_API_KEY');
    case 'perplexity':return callOpenAICompatible('https://api.perplexity.ai', model, systemPrompt, userContent, opts, 'PERPLEXITY_API_KEY');
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function requireKey(envKey) {
  const val = process.env[envKey];
  if (!val) {
    const err = new Error(`Missing API key: set ${envKey} environment variable`);
    err.code = 'NO_KEY';
    err.envKey = envKey;
    throw err;
  }
  return val;
}

async function callAnthropic(model, systemPrompt, userContent, opts) {
  const apiKey = requireKey('ANTHROPIC_API_KEY');
  const body = {
    model,
    max_tokens: opts.max_tokens,
    messages: [{ role: 'user', content: userContent }],
  };
  if (systemPrompt) body.system = systemPrompt;
  if (opts.temperature !== undefined) body.temperature = opts.temperature;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Anthropic API error ${res.status}: ${err.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return {
    text: data.content[0]?.text ?? '',
    model: `anthropic/${model}`,
    input_tokens:  data.usage?.input_tokens  ?? 0,
    output_tokens: data.usage?.output_tokens ?? 0,
  };
}

async function callOpenAI(model, systemPrompt, userContent, opts) {
  const apiKey = requireKey('OPENAI_API_KEY');
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userContent });

  const body = { model, messages, max_tokens: opts.max_tokens };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenAI API error ${res.status}: ${err.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return {
    text: data.choices[0]?.message?.content ?? '',
    model: `openai/${model}`,
    input_tokens:  data.usage?.prompt_tokens     ?? 0,
    output_tokens: data.usage?.completion_tokens ?? 0,
  };
}

async function callGoogle(model, systemPrompt, userContent, opts) {
  const apiKey = requireKey('GOOGLE_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const contents = [{ role: 'user', parts: [{ text: userContent }] }];
  const body = { contents };
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };
  body.generationConfig = { maxOutputTokens: opts.max_tokens, temperature: opts.temperature };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Google API error ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    model: `google/${model}`,
    input_tokens:  data.usageMetadata?.promptTokenCount     ?? 0,
    output_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

async function callMistral(model, systemPrompt, userContent, opts) {
  const apiKey = requireKey('MISTRAL_API_KEY');
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userContent });

  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: opts.max_tokens, temperature: opts.temperature }),
  });

  if (!res.ok) throw new Error(`Mistral API error ${res.status}`);
  const data = await res.json();
  return {
    text: data.choices[0]?.message?.content ?? '',
    model: `mistral/${model}`,
    input_tokens:  data.usage?.prompt_tokens     ?? 0,
    output_tokens: data.usage?.completion_tokens ?? 0,
  };
}

async function callOpenAICompatible(baseUrl, model, systemPrompt, userContent, opts, envKey) {
  const apiKey = envKey ? requireKey(envKey) : 'local';
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userContent });

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: opts.max_tokens, temperature: opts.temperature }),
  });

  if (!res.ok) throw new Error(`API error ${res.status} from ${baseUrl}`);
  const data = await res.json();
  return {
    text: data.choices[0]?.message?.content ?? '',
    model: `${baseUrl.split('/')[2]}/${model}`,
    input_tokens:  data.usage?.prompt_tokens     ?? 0,
    output_tokens: data.usage?.completion_tokens ?? 0,
  };
}

module.exports = {
  call,
  resolveModel,
  registerProvider,
  registerAlias,
  estimateTokens,
  estimateCost,
  ALIASES,
  PRICING,
};
