/**
 * tree-sitter-fluent — Grammar for the FLUENT Natural Language AI Programming Language
 *
 * Used by: Neovim (nvim-treesitter), Helix, Zed, GitHub syntax highlighting,
 *          GitHub Linguist, CodeMirror 6, Monaco Editor.
 *
 * Install in Neovim:
 *   Add to your nvim-treesitter config, then: :TSInstall fluent
 *
 * GitHub Linguist submission:
 *   See tree-sitter-fluent/README.md for submission instructions.
 */

module.exports = grammar({
  name: 'fluent',

  extras: $ => [$.comment, /\s/],

  word: $ => $.identifier,

  rules: {
    // ── Top-level program ───────────────────────────────────────────────────
    source_file: $ => repeat($._statement),

    _statement: $ => choice(
      $.declaration,
      $.assignment,
      $.ask_statement,
      $.output_statement,
      $.if_statement,
      $.for_each_statement,
      $.while_statement,
      $.match_statement,
      $.repeat_statement,
      $.unless_statement,
      $.using_model_statement,
      $.function_definition,
      $.test_block,
      $.try_statement,
      $.filter_statement,
      $.map_statement,
      $.sort_statement,
      $.group_statement,
      $.reduce_statement,
      $.fetch_statement,
      $.post_statement,
      $.pipe_statement,
      $.append_statement,
      $.emit_statement,
      $.run_agent_statement,
      $.define_model,
      $.annotation,
      $.comment,
    ),

    // ── Annotations ─────────────────────────────────────────────────────────
    annotation: $ => seq(
      $.annotation_marker,
      optional(seq('(', $.annotation_args, ')')),
    ),
    annotation_marker: _ => /@\w+/,
    annotation_args:   _ => /[^)]+/,

    // ── Comments ─────────────────────────────────────────────────────────────
    comment: _ => token(seq('--', /.*/)),

    // ── Declarations ─────────────────────────────────────────────────────────
    declaration: $ => seq(
      'Let', field('name', $.identifier), 'be', field('value', $._expression), '.',
    ),
    assignment: $ => seq(
      'Set', field('name', $.identifier), 'to', field('value', $._expression), '.',
    ),

    // ── Ask (model invocation) ───────────────────────────────────────────────
    ask_statement: $ => seq(
      'Ask',
      field('model', $._model_ref),
      'to',
      field('instruction', $.string),
      optional(seq(field('input_kind', $.input_kind), field('input', $._expression))),
      'and call the result',
      field('result', $.identifier),
      '.',
    ),
    _model_ref: $ => choice(
      $.model_alias,
      $.qualified_model,
      $.identifier,
    ),
    model_alias: _ => token(choice(
      'claude', 'gpt', 'gemini', 'mistral', 'llama', 'groq',
      'deepseek', 'grok', 'perplexity', 'cohere',
    )),
    qualified_model: $ => seq($.provider, '/', $.identifier),
    provider: _ => token(choice(
      'anthropic', 'openai', 'google', 'mistral', 'groq', 'meta',
      'deepseek', 'xai', 'perplexity', 'cohere', 'huggingface', 'hf',
    )),
    input_kind: _ => token(choice(
      'using text', 'using data', 'using image', 'using images',
      'using audio', 'using video', 'using document', 'using context',
    )),

    // ── Output / Return ───────────────────────────────────────────────────────
    output_statement: $ => seq('Output', $._expression, '.'),

    // ── If / Otherwise ────────────────────────────────────────────────────────
    if_statement: $ => seq(
      'If', field('condition', $._condition), ',', 'then', field('then', $._statement),
      optional(seq('Otherwise', ',', field('otherwise', $._statement))),
    ),

    // ── For each ─────────────────────────────────────────────────────────────
    for_each_statement: $ => seq(
      'For each', field('item', $.identifier), 'in', field('collection', $._expression), ':',
      repeat($._statement),
      'End loop', '.',
    ),

    // ── While ────────────────────────────────────────────────────────────────
    while_statement: $ => seq(
      'While', field('condition', $._condition), ':',
      repeat($._statement),
      'End while', '.',
    ),

    // ── Match ─────────────────────────────────────────────────────────────────
    match_statement: $ => seq(
      'Match', field('subject', $._expression), ':',
      repeat($.when_clause),
      optional($.otherwise_clause),
      'End match', '.',
    ),
    when_clause: $ => seq(
      'When', field('value', $._expression), ':', field('body', $._statement),
    ),
    otherwise_clause: $ => seq('Otherwise', ':', $._statement),

    // ── Repeat ───────────────────────────────────────────────────────────────
    repeat_statement: $ => seq(
      'Repeat', field('count', $._expression), 'times', ':',
      repeat($._statement),
      'End repeat', '.',
    ),

    // ── Unless ───────────────────────────────────────────────────────────────
    unless_statement: $ => seq(
      'Unless', field('condition', $._condition), ':',
      repeat($._statement),
      'End unless', '.',
    ),

    // ── Using model ───────────────────────────────────────────────────────────
    using_model_statement: $ => seq(
      'Using model', field('alias', $._model_ref),
      optional(seq('with', field('options', $._expression))), ':',
      repeat($._statement),
      'End using', '.',
    ),

    // ── Function definition ───────────────────────────────────────────────────
    function_definition: $ => seq(
      'To', field('verb', /[^:(]+/),
      optional(seq('(', field('params', $.param_list), ')')), ':',
      repeat($._statement),
      'End of', /[^.]+/, '.',
    ),
    param_list: $ => seq($.identifier, repeat(seq(',', $.identifier))),

    // ── Test block ────────────────────────────────────────────────────────────
    test_block: $ => seq(
      'Test', field('name', $.string), ':',
      repeat($._statement),
      'End test', '.',
    ),

    // ── Try / fallback ────────────────────────────────────────────────────────
    try_statement: $ => seq(
      'Try to', $._statement,
      'If that fails', ',', $._statement,
    ),

    // ── Collection pipeline ───────────────────────────────────────────────────
    filter_statement: $ => seq(
      'Filter', field('collection', $.identifier),
      'where', field('condition', $._condition),
      'and call the result', field('result', $.identifier), '.',
    ),
    map_statement: $ => seq(
      'Map', field('collection', $.identifier),
      'to', field('transform', $._expression),
      'and call the result', field('result', $.identifier), '.',
    ),
    sort_statement: $ => seq(
      'Sort', field('collection', $.identifier),
      'by', field('field', $._expression),
      optional(field('direction', choice('ascending', 'descending', 'asc', 'desc'))),
      'and call the result', field('result', $.identifier), '.',
    ),
    group_statement: $ => seq(
      'Group', field('collection', $.identifier),
      'by', field('field', $._expression),
      'and call the result', field('result', $.identifier), '.',
    ),
    reduce_statement: $ => seq(
      'Reduce', field('collection', $.identifier),
      'to', field('operation', choice('sum','count','average','avg','min','max','product')),
      'and call the result', field('result', $.identifier), '.',
    ),

    // ── HTTP ─────────────────────────────────────────────────────────────────
    fetch_statement: $ => seq(
      'Fetch', field('url', $._expression),
      'and call the result', field('result', $.identifier), '.',
    ),
    post_statement: $ => seq(
      'Post to', field('url', $._expression),
      'with body', field('body', $.identifier),
      'and call the result', field('result', $.identifier), '.',
    ),

    // ── Pipe ─────────────────────────────────────────────────────────────────
    pipe_statement: $ => seq(
      'Pass', field('input', $.identifier),
      'through', field('steps', $._expression),
      'and call the result', field('result', $.identifier), '.',
    ),

    // ── File / Events ─────────────────────────────────────────────────────────
    append_statement: $ => seq(
      'Append', field('value', $.identifier), 'to', field('path', $.string), '.',
    ),
    emit_statement: $ => seq(
      'Emit', field('event', $.string),
      optional(seq('with', field('data', $.identifier))), '.',
    ),

    // ── Agent ─────────────────────────────────────────────────────────────────
    run_agent_statement: $ => seq(
      'Run agent with goal', field('goal', $.string),
      optional(seq('and call the outcome', field('result', $.identifier))), '.',
    ),

    // ── Define model ─────────────────────────────────────────────────────────
    define_model: $ => seq(
      'Define model', field('alias', $.identifier),
      'as', field('provider_model', $._expression),
      /[^.]*/, '.',
    ),

    // ── Expressions ──────────────────────────────────────────────────────────
    _expression: $ => choice(
      $.string,
      $.number,
      $.boolean,
      $.null_literal,
      $.list_expr,
      $.record_expr,
      $.field_access,
      $.stdlib_call,
      $.function_call,
      $.identifier,
    ),
    string:         _ => /"(?:[^"\\]|\\.)*"/,
    number:         _ => /-?\d+(\.\d+)?/,
    boolean:        _ => token(choice('true', 'false', 'yes', 'no')),
    null_literal:   _ => token(choice('nothing', 'null', 'empty')),
    list_expr:      $ => seq('a list containing', $._expression, repeat(seq(',', $._expression))),
    record_expr:    $ => seq('a record with', /[^.]+/),
    field_access:   $ => seq($.identifier, '.', $.identifier),
    stdlib_call:    $ => seq('the result of', /[^.]+/),
    function_call:  $ => seq('the result of', $.identifier, /[^.]*/),
    identifier:     _ => /[a-zA-Z_][a-zA-Z0-9_]*/,

    // ── Conditions ────────────────────────────────────────────────────────────
    _condition: $ => /[^:]+/,
  },
});
