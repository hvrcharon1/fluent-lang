; FLUENT tree-sitter highlight queries
; Used by: Neovim (nvim-treesitter), Helix, Zed, GitHub

; ── Comments ──────────────────────────────────────────────────────────────────
(comment) @comment

; ── Annotations ───────────────────────────────────────────────────────────────
(annotation_marker) @attribute
(annotation_args)   @string.special

; ── Keywords — declarations ───────────────────────────────────────────────────
"Let"    @keyword
"Set"    @keyword
"be"     @keyword
"to"     @keyword

; ── Keywords — model invocation ───────────────────────────────────────────────
"Ask"                  @keyword.function
"and call the result"  @keyword.operator
"and call the outcome" @keyword.operator
"using text"           @keyword.operator
"using data"           @keyword.operator
"using image"          @keyword.operator
"using audio"          @keyword.operator
"using document"       @keyword.operator

; ── Model aliases ─────────────────────────────────────────────────────────────
(model_alias) @type.builtin
(provider)    @namespace

; ── Keywords — control flow ───────────────────────────────────────────────────
"If"        @keyword.control
"Unless"    @keyword.control
"Otherwise" @keyword.control
"Match"     @keyword.control
"When"      @keyword.control
"For each"  @keyword.control
"While"     @keyword.control
"Repeat"    @keyword.control
"In parallel" @keyword.control
"Try to"    @keyword.control
"If that fails" @keyword.control

; ── Keywords — block openers/closers ─────────────────────────────────────────
"End loop"    @keyword
"End while"   @keyword
"End match"   @keyword
"End repeat"  @keyword
"End unless"  @keyword
"End using"   @keyword
"End test"    @keyword
"End of"      @keyword
"End parallel" @keyword

; ── Keywords — collection ops ─────────────────────────────────────────────────
"Filter" @function.builtin
"Map"    @function.builtin
"Sort"   @function.builtin
"Group"  @function.builtin
"Reduce" @function.builtin
"Fetch"  @function.builtin
"Post"   @function.builtin
"Pass"   @function.builtin

; ── Aggregate operations ──────────────────────────────────────────────────────
(reduce_statement operation: _ @constant.builtin)

; ── Keywords — IO ─────────────────────────────────────────────────────────────
"Output" @function.builtin
"Return" @keyword.return
"Emit"   @function.builtin
"Append" @function.builtin

; ── Keywords — definitions ────────────────────────────────────────────────────
"To"           @keyword.function
"Define model" @keyword.function
"Using model"  @keyword.operator

; ── Keywords — agent ─────────────────────────────────────────────────────────
"Run agent with goal" @keyword.function

; ── Keywords — test ───────────────────────────────────────────────────────────
"Test"   @keyword.function
"Expect" @function.builtin

; ── Literals ─────────────────────────────────────────────────────────────────
(string)       @string
(number)       @number
(boolean)      @boolean
(null_literal) @constant.builtin

; ── Variables and fields ─────────────────────────────────────────────────────
(declaration name: (identifier) @variable.declaration)
(assignment  name: (identifier) @variable)
(field_access (identifier) @variable (identifier) @property)

; ── Function definitions ──────────────────────────────────────────────────────
(function_definition verb: _ @function)
(test_block name: (string) @string.special)

; ── Results (variable names assigned from model calls) ───────────────────────
(ask_statement result: (identifier) @variable.declaration)
(filter_statement result: (identifier) @variable.declaration)
(map_statement    result: (identifier) @variable.declaration)
(sort_statement   result: (identifier) @variable.declaration)
(group_statement  result: (identifier) @variable.declaration)
(reduce_statement result: (identifier) @variable.declaration)
(fetch_statement  result: (identifier) @variable.declaration)

; ── Operators ─────────────────────────────────────────────────────────────────
"is greater than"            @operator
"is less than"               @operator
"is at least"                @operator
"is at most"                 @operator
"is not"                     @operator
"contains"                   @operator
"does not contain"           @operator
"ascending"                  @keyword.operator
"descending"                 @keyword.operator
"plus"                       @operator
"minus"                      @operator
"times"                      @operator
"divided by"                 @operator

; ── Stdlib calls ─────────────────────────────────────────────────────────────
(stdlib_call) @function.call
