'use strict';
const fs   = require('fs');
const path = require('path');
const chalk = require('chalk');

async function init(name, opts = {}) {
  const projectName = name || path.basename(process.cwd());
  const projectDir  = name ? path.resolve(name) : process.cwd();

  // ── Create directories ────────────────────────────────────────────────────
  const dirs = [
    projectDir,
    path.join(projectDir, 'examples'),
    path.join(projectDir, 'tests'),
    path.join(projectDir, 'traces'),
  ];
  dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));

  // ── Write files ───────────────────────────────────────────────────────────
  const files = buildFiles(projectName);
  const created = [];

  for (const [relPath, content] of Object.entries(files)) {
    const abs = path.join(projectDir, relPath);
    if (fs.existsSync(abs) && !opts.force) {
      console.log(chalk.yellow(`  skip  ${relPath} (already exists)`));
      continue;
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    created.push(relPath);
    console.log(chalk.green(`  create  ${relPath}`));
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('');
  console.log(chalk.bold(`  ✓ ${projectName} initialised`));
  console.log('');
  console.log(chalk.dim('  Next steps:'));
  if (name) console.log(chalk.dim(`    cd ${name}`));
  console.log(chalk.dim('    fluent env set ANTHROPIC_API_KEY=sk-ant-...'));
  console.log(chalk.dim('    fluent run examples/hello.fl'));
  console.log(chalk.dim('    fluent test ./tests/'));
  console.log('');
}

// ── File templates ────────────────────────────────────────────────────────────
function buildFiles(name) {
  return {
    // Main program
    'main.fl': `-- main.fl — ${name}
-- Run: fluent run main.fl

Let greeting be "Hello from ${name}!".
Output greeting.

-- Uncomment to use AI:
-- Ask claude to "say hello in a creative way" and call the result hello.
-- Output hello.
`,

    // Example programs
    'examples/hello.fl': `-- examples/hello.fl — Hello World
Let name be "${name}".
Output "Hello from".
Output name.
`,

    'examples/pipeline.fl': `-- examples/pipeline.fl — Data pipeline example
-- Run: fluent run examples/pipeline.fl

Let items be a list containing
    a record with name "Alice" score 92,
    a record with name "Bob"   score 74,
    a record with name "Carol" score 88.

-- Filter high scorers
Filter items where score is greater than 80 and call the result top_performers.

-- Sort by score
Sort top_performers by score descending and call the result ranked.

-- Map to names
Map ranked to name and call the result names.

Output "Top performers:".
Output names.

-- Stats
Reduce items to average and call the result avg_score.
Let rounded be the result of round avg_score to 1 decimal places.
Output "Average score:".
Output rounded.
`,

    'examples/ai-demo.fl': `-- examples/ai-demo.fl — AI capabilities demo
-- Run: fluent run examples/ai-demo.fl
-- Requires: ANTHROPIC_API_KEY

Let topic be "natural language programming".

@model(temperature: 0.5, max_tokens: 200)
Ask claude to "Write a one-paragraph introduction to" using text topic and call the result intro.
Output intro.

@model(temperature: 0, max_tokens: 50)
Ask claude to "Summarise that in one sentence." using text intro and call the result summary.
Output summary.
`,

    // Tests
    'tests/test_basics.fl': `-- tests/test_basics.fl — Basic tests
-- Run: fluent test ./tests/

Test "string operations work":
    Let text be "Hello, ${name}!".
    Let n be the result of the length of text.
    Expect n to be greater than 5.
End test.

Test "arithmetic works":
    Let a be 10.
    Let b be 32.
    Let total be a plus b.
    Expect total to be greater than 40.
End test.

Test "list operations work":
    Let scores be a list containing 80, 90, 100.
    Let total be the result of the sum of scores.
    Expect total to be greater than 260.
End test.

Test "filter works":
    Let items be a list containing
        a record with value 50,
        a record with value 90,
        a record with value 30.
    Filter items where value is greater than 60 and call the result filtered.
    Expect filtered to not be empty.
End test.

Test "match works":
    Let status be "active".
    Let label be "unknown".
    Match status:
        When "active": Set label to "running".
        When "stopped": Set label to "idle".
        Otherwise: Set label to "unknown".
    End match.
    Expect label to not be empty.
End test.
`,

    // Config
    '.fluentrc': JSON.stringify({
      version: '1.1',
      defaults: { model: 'claude', temperature: 0.7, max_tokens: 1024 },
      providers: {
        anthropic: { key_env: 'ANTHROPIC_API_KEY' },
        openai:    { key_env: 'OPENAI_API_KEY'    },
        google:    { key_env: 'GOOGLE_API_KEY'    },
      },
      trace: { enabled: false, dir: './traces' },
      test:  { dir: './tests', reporter: 'pretty' },
    }, null, 2),

    // fluent.pkg
    'fluent.pkg': JSON.stringify({
      name:        name.toLowerCase().replace(/\s+/g, '-'),
      version:     '0.1.0',
      description: `${name} — a FLUENT project`,
      author:      '',
      license:     'MIT',
      fluent_version: '>=1.1.0',
      main:        'main.fl',
      scripts: {
        run:  'fluent run main.fl',
        test: 'fluent test ./tests/',
      },
    }, null, 2),

    // README
    'README.md': `# ${name}

A [FLUENT](https://github.com/hvrcharon1/fluent-lang) project.

## Quick Start

\`\`\`bash
# Set API credentials
fluent env set ANTHROPIC_API_KEY=sk-ant-...

# Run the main program
fluent run main.fl

# Run examples
fluent run examples/hello.fl
fluent run examples/pipeline.fl

# Run tests (no API key needed)
fluent test ./tests/

# Estimate cost before running
fluent estimate examples/ai-demo.fl
\`\`\`

## Project Structure

\`\`\`
${name}/
├── main.fl              Main program
├── examples/            Example programs
│   ├── hello.fl
│   ├── pipeline.fl
│   └── ai-demo.fl
├── tests/               Test files
│   └── test_basics.fl
├── traces/              Execution traces (gitignored)
├── .fluentrc            Runtime config
├── fluent.pkg           Project manifest
└── README.md
\`\`\`

## Language Reference

- [FLUENT Spec Part I](https://github.com/hvrcharon1/fluent-lang/blob/main/index.html)
- [FLUENT Spec Part II](https://github.com/hvrcharon1/fluent-lang/blob/main/advanced.html)
`,

    // .gitignore
    '.gitignore': `node_modules/
traces/
dist/
*.log
.env
.env.*
`,
  };
}

module.exports = { init };
