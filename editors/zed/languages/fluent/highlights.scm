; FLUENT highlights for Zed editor
; Reuses the tree-sitter-fluent grammar queries

; Comments
(comment) @comment

; Annotations
(annotation_marker) @attribute
(annotation_args)   @string.special

; Core keywords
[
  "Let" "Set" "be" "to"
] @keyword

"Ask"   @function.call
"Output" @function.builtin
"Return" @keyword.return

; Control flow
[
  "If" "Unless" "Otherwise" "Match" "When"
  "For each" "While" "Repeat" "In parallel"
  "Try to" "If that fails"
] @keyword.control

; Block ends
[
  "End loop" "End while" "End match" "End repeat"
  "End unless" "End using" "End test" "End of" "End parallel"
] @keyword

; Collection pipeline
[ "Filter" "Map" "Sort" "Group" "Reduce" "Fetch" "Post" "Pass" "Append" "Emit" ]
  @function.builtin

; Model aliases
(model_alias)  @type.builtin
(provider)     @namespace

; Function definitions
"To"           @keyword.function
"Define model" @keyword.function
"Using model"  @keyword

; Agent
"Run agent with goal" @keyword.function

; Test
"Test"   @keyword.function
"Expect" @function.builtin

; Operators
[
  "and call the result" "and call the outcome"
  "using text" "using data" "using image" "using audio" "using document"
  "the result of" "be the result of"
] @keyword.operator

; Comparison operators
[
  "is greater than" "is less than" "is at least" "is at most"
  "is not" "contains" "does not contain" "ascending" "descending"
  "plus" "minus" "times" "divided by"
] @operator

; Literals
(string)       @string
(number)       @number
(boolean)      @boolean
(null_literal) @constant.builtin

; Variable declarations
(declaration name: (identifier) @variable.declaration)
(ask_statement result: (identifier) @variable.declaration)
(filter_statement result: (identifier) @variable.declaration)
(map_statement    result: (identifier) @variable.declaration)
(sort_statement   result: (identifier) @variable.declaration)
(group_statement  result: (identifier) @variable.declaration)
(reduce_statement result: (identifier) @variable.declaration)

; Field access
(field_access (identifier) @variable (identifier) @property)

; Test name
(test_block name: (string) @string.special)
