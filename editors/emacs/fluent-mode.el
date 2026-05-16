;;; fluent-mode.el --- Major mode for FLUENT Natural Language AI Programs -*- lexical-binding: t; -*-
;;
;; Copyright (C) 2026 Datacules LLC
;;
;; Author: Datacules LLC
;; URL: https://github.com/hvrcharon1/fluent-lang
;; Version: 1.2.0
;; Package-Requires: ((emacs "27.1") (lsp-mode "8.0"))
;; Keywords: languages, AI, natural-language, LLM
;;
;; SPDX-License-Identifier: MIT
;;
;;; Commentary:
;;
;; Emacs major mode for the FLUENT natural language AI programming language.
;;
;; Features:
;;   - Syntax highlighting (font-lock)
;;   - Indentation
;;   - LSP support via lsp-mode or eglot
;;   - Completion via company-mode
;;   - Run / estimate / lint commands
;;
;; Installation:
;;   1. Install fluent runtime:  npm install -g fluent-lang
;;   2. Add to your init.el:
;;
;;        (add-to-list 'load-path "/path/to/fluent-lang/editors/emacs/")
;;        (require 'fluent-mode)
;;
;;      Or with use-package:
;;
;;        (use-package fluent-mode
;;          :load-path "~/fluent-lang/editors/emacs"
;;          :mode "\\.fl\\'"
;;          :hook (fluent-mode . lsp-deferred))
;;
;;; Code:

(require 'rx)
(require 'font-lock)

;; ── Customization ─────────────────────────────────────────────────────────────
(defgroup fluent nil
  "FLUENT natural language AI programming language."
  :group 'languages
  :prefix "fluent-")

(defcustom fluent-executable "fluent"
  "Path to the fluent CLI executable."
  :type 'string :group 'fluent)

(defcustom fluent-language-server-executable "fluent-language-server"
  "Path to the fluent-language-server (LSP)."
  :type 'string :group 'fluent)

(defcustom fluent-indent-level 4
  "Number of spaces for indentation in FLUENT programs."
  :type 'integer :group 'fluent)

;; ── Syntax table ──────────────────────────────────────────────────────────────
(defvar fluent-mode-syntax-table
  (let ((table (make-syntax-table)))
    ;; -- starts a line comment
    (modify-syntax-entry ?- ". 12" table)
    (modify-syntax-entry ?\n ">" table)
    ;; Strings
    (modify-syntax-entry ?\" "\"" table)
    ;; Word characters
    (modify-syntax-entry ?_ "w" table)
    table)
  "Syntax table for `fluent-mode'.")

;; ── Font-lock keywords ────────────────────────────────────────────────────────
(defconst fluent-keywords
  '("Let" "Set" "Ask" "Output" "Return" "If" "Otherwise" "For each"
    "While" "Match" "When" "Repeat" "Unless" "Using model" "To"
    "Define model" "In parallel" "Test" "Expect" "Try to" "If that fails"
    "End loop" "End while" "End match" "End repeat" "End unless"
    "End using" "End test" "End of" "End parallel"))

(defconst fluent-pipeline-keywords
  '("Filter" "Map" "Sort" "Group" "Reduce" "Fetch" "Post"
    "Pass" "Append" "Emit" "Run agent with goal"))

(defconst fluent-model-aliases
  '("claude" "gpt" "gemini" "mistral" "llama" "groq"
    "deepseek" "grok" "perplexity" "cohere"))

(defconst fluent-operators
  '("and call the result" "and call the outcome" "the result of"
    "be the result of" "using text" "using data" "using image"
    "using audio" "using document" "is greater than" "is less than"
    "is at least" "is at most" "is not" "contains" "ascending" "descending"
    "plus" "minus" "times" "divided by"))

(defconst fluent-stdlib
  '("the length of" "the word count of" "uppercase of" "lowercase of"
    "slugify" "truncate" "the sum of" "the average of" "the first item of"
    "the last item of" "unique items from" "a range from" "the current date"
    "days between" "converted to" "square root of" "absolute value of"
    "ceiling of" "floor of" "round"))

(defvar fluent-font-lock-keywords
  `(;; Comments
    ("--.*$" . font-lock-comment-face)
    ;; Annotations
    ("@\\w+" . font-lock-preprocessor-face)
    ;; Strings
    ("\"[^\"]*\"" . font-lock-string-face)
    ;; Numbers
    ("-?\\b[0-9]+\\(\\.[0-9]+\\)?\\b" . font-lock-constant-face)
    ;; Booleans / null
    (,(rx word-start (or "true" "false" "yes" "no" "nothing" "null" "empty") word-end)
     . font-lock-constant-face)
    ;; Model aliases
    (,(regexp-opt fluent-model-aliases 'words) . font-lock-type-face)
    ;; Pipeline keywords
    (,(regexp-opt fluent-pipeline-keywords 'words) . font-lock-builtin-face)
    ;; Main keywords
    (,(regexp-opt fluent-keywords 'words) . font-lock-keyword-face)
    ;; Stdlib
    (,(regexp-opt fluent-stdlib) . font-lock-builtin-face)
    ;; Operators
    (,(regexp-opt fluent-operators) . font-lock-keyword-face)
    ;; Variable declarations: "Let NAME be"
    ("\\bLet\\s-+\\(\\w+\\)\\s-+be\\b" 1 font-lock-variable-name-face)
    ;; Result names: "and call the result NAME"
    ("\\band call the result\\s-+\\(\\w+\\)" 1 font-lock-variable-name-face)
    ("\\band call the outcome\\s-+\\(\\w+\\)" 1 font-lock-variable-name-face)
    ;; Function definitions: "To VERB"
    ("\\bTo\\s-+\\(.+?\\)\\s-*(" 1 font-lock-function-name-face)
    ;; Field access: var.field
    ("\\b\\(\\w+\\)\\.\\(\\w+\\)\\b"
     (1 font-lock-variable-name-face)
     (2 font-lock-variable-name-face)))
  "Font-lock keywords for `fluent-mode'.")

;; ── Indentation ───────────────────────────────────────────────────────────────
(defun fluent-indent-line ()
  "Indent current line in `fluent-mode'."
  (interactive)
  (let ((indent (fluent-calculate-indent)))
    (when indent
      (save-excursion
        (beginning-of-line)
        (delete-horizontal-space)
        (indent-to indent)))))

(defun fluent-calculate-indent ()
  "Calculate the correct indentation for the current line."
  (let ((block-open-re (rx bol (* space) (or "For each" "While" "Match" "When:"
                                              "Repeat" "Unless" "Using model"
                                              "In parallel" "Test" "To " "If ")
                           (* nonl) ":"))
        (block-close-re (rx bol (* space) (or "End loop" "End while" "End match"
                                               "End repeat" "End unless" "End using"
                                               "End test" "End of" "End parallel"
                                               "Otherwise"))))
    (save-excursion
      (beginning-of-line)
      (let ((current-col (current-indentation)))
        (forward-line -1)
        (let ((prev-line (buffer-substring-no-properties
                          (line-beginning-position) (line-end-position))))
          (cond
           ;; Closing keyword — dedent
           ((string-match-p block-close-re
                             (buffer-substring-no-properties
                              (save-excursion (beginning-of-line) (point))
                              (line-end-position)))
            (max 0 (- (current-indentation) fluent-indent-level)))
           ;; Previous line opens a block — indent
           ((string-match-p block-open-re prev-line)
            (+ (current-indentation) fluent-indent-level))
           ;; Default — same as previous
           (t (current-indentation))))))))

;; ── Commands ──────────────────────────────────────────────────────────────────
(defun fluent-run-file ()
  "Run the current .fl file with `fluent run'."
  (interactive)
  (save-buffer)
  (compile (concat fluent-executable " run " (shell-quote-argument (buffer-file-name)))))

(defun fluent-estimate-cost ()
  "Estimate API cost for the current .fl file."
  (interactive)
  (save-buffer)
  (shell-command (concat fluent-executable " estimate " (shell-quote-argument (buffer-file-name)))))

(defun fluent-lint-file ()
  "Lint the current .fl file."
  (interactive)
  (save-buffer)
  (compile (concat fluent-executable " lint " (shell-quote-argument (buffer-file-name)))))

(defun fluent-dry-run ()
  "Validate the current .fl file without executing."
  (interactive)
  (save-buffer)
  (shell-command (concat fluent-executable " run --dry-run " (shell-quote-argument (buffer-file-name)))))

(defun fluent-open-repl ()
  "Open the FLUENT REPL in a terminal."
  (interactive)
  (let ((buf (get-buffer-create "*fluent-repl*")))
    (with-current-buffer buf
      (term fluent-executable)
      (term-send-string (get-buffer-process buf) "repl\n"))
    (switch-to-buffer-other-window buf)))

;; ── LSP (eglot) registration ─────────────────────────────────────────────────
(with-eval-after-load 'eglot
  (add-to-list 'eglot-server-programs
               `(fluent-mode . (,fluent-language-server-executable "--stdio"))))

;; ── LSP (lsp-mode) registration ──────────────────────────────────────────────
(with-eval-after-load 'lsp-mode
  (lsp-register-client
   (make-lsp-client
    :new-connection (lsp-stdio-connection
                     (lambda () (list fluent-language-server-executable "--stdio")))
    :major-modes '(fluent-mode)
    :server-id 'fluent-ls
    :priority 1)))

;; ── Keymap ────────────────────────────────────────────────────────────────────
(defvar fluent-mode-map
  (let ((map (make-sparse-keymap)))
    (define-key map (kbd "C-c C-r") #'fluent-run-file)
    (define-key map (kbd "C-c C-e") #'fluent-estimate-cost)
    (define-key map (kbd "C-c C-l") #'fluent-lint-file)
    (define-key map (kbd "C-c C-d") #'fluent-dry-run)
    (define-key map (kbd "C-c C-z") #'fluent-open-repl)
    (define-key map (kbd "TAB")     #'fluent-indent-line)
    map)
  "Keymap for `fluent-mode'.")

;; ── Mode definition ───────────────────────────────────────────────────────────
;;;###autoload
(define-derived-mode fluent-mode prog-mode "FLUENT"
  "Major mode for FLUENT natural language AI programs.

Keybindings:
  C-c C-r  Run the current file
  C-c C-e  Estimate API cost
  C-c C-l  Lint the file
  C-c C-d  Dry-run validation
  C-c C-z  Open REPL

LSP:
  Activate with M-x eglot or M-x lsp"
  :syntax-table fluent-mode-syntax-table
  (setq-local font-lock-defaults '(fluent-font-lock-keywords t))
  (setq-local comment-start "-- ")
  (setq-local comment-end   "")
  (setq-local indent-line-function #'fluent-indent-line)
  (setq-local tab-width fluent-indent-level)
  (font-lock-mode 1))

;;;###autoload
(add-to-list 'auto-mode-alist '("\\.fl\\'" . fluent-mode))

(provide 'fluent-mode)
;;; fluent-mode.el ends here
