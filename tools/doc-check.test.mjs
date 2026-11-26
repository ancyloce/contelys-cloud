// Tests for the Markdown document check. Run: node --test tools/doc-check.test.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { checkDocument, isHookTarget, main } from './doc-check.mjs';

// A repository with a parent record, two sub-repositories' records and one placeholder deployable.
const root = mkdtempSync(path.join(tmpdir(), 'doc-check-'));
const files = {
  'docs/adr/0045-parent-repository-with-submodules.md': '# 0045\n',
  'docs/DESIGN.md': '# Design\n',
  'platform/edge/docs/adr/0003-edge-record.md': '# Edge 0003\n',
  'services/organization-access/docs/adr/0003-organization-access-record.md': '# OA 0003\n',
  'services/projects/project.json': '{}\n',
};
for (const [file, content] of Object.entries(files)) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
}
after(() => rmSync(root, { recursive: true, force: true }));

const doc = path.join(root, 'docs', 'note.md');
const findings = (text, file = doc) => checkDocument(text, { file, root }).map((f) => `${f.line}: ${f.message}`);

test('a clean document has no findings', () => {
  const text = [
    '# Title',
    '',
    'See [the design](./DESIGN.md), [the record](adr/0045-parent-repository-with-submodules.md) and [a site](https://example.com).',
    'ADR 0045, Edge ADR 0003, Organization Access ADR 0003 and Write Edge ADR 0003 all resolve.',
    '',
    '## Section',
    '',
    '| A | B |',
    '| --- | :-: |',
    '| `x` | [design](/docs/DESIGN.md) |',
    '',
    '```mermaid',
    'sequenceDiagram',
    '    A->>B: first, then second#59; done',
    '```',
    '',
    '[ref]: ./DESIGN.md',
  ].join('\n');
  assert.deepEqual(findings(text), []);
});

test('a link to a missing file is reported, an external link and an anchor are not', () => {
  assert.deepEqual(findings('[x](./missing.md) [y](https://example.com) [z](#here)'), [
    '1: the link target does not exist: ./missing.md',
  ]);
});

test('a reference definition to a missing file is reported', () => {
  assert.deepEqual(findings('[ref]: ../nowhere.md'), ['1: the link target does not exist: ../nowhere.md']);
});

test('links and citations inside inline code or a code fence are not checked', () => {
  assert.deepEqual(findings('`[x](./missing.md)` and `ADR 9999`\n\n```\n[y](./missing.md) ADR 9999\n```'), []);
});

test('a citation of a parent record that does not exist is reported', () => {
  assert.deepEqual(findings('As ADR 0099 says.'), ['1: "ADR 0099" names no record in docs/adr']);
});

test("a citation of a sub-repository's record looks in that sub-repository", () => {
  assert.deepEqual(findings('Edge ADR 0045 and Organization Access ADR 0004.'), [
    '1: "Edge ADR 0045" names no record in platform/edge/docs/adr',
    '1: "Organization Access ADR 0004" names no record in services/organization-access/docs/adr',
  ]);
});

test('a placeholder deployable without records reports its citation', () => {
  assert.deepEqual(findings('Projects ADR 0001.'), ['1: "Projects ADR 0001" names no record in services/projects/docs/adr']);
});

test('a document under docs/archive/ keeps its links and citations unchecked', () => {
  const archived = path.join(root, 'docs', 'archive', 'old.md');
  assert.deepEqual(findings('[x](./missing.md) ADR 0099', archived), []);
});

test('a table row with the wrong number of cells is reported', () => {
  assert.deepEqual(findings('| A | B |\n| --- | --- |\n| 1 | 2 | 3 |'), ['3: this table row has 3 cells and its header 2']);
});

test('a table without a delimiter row is reported', () => {
  assert.deepEqual(findings('| A | B |\n| 1 | 2 |'), [
    '1: a table needs a delimiter row, such as | --- | --- |, as its second line',
  ]);
});

test('an escaped pipe in a table cell is reported', () => {
  assert.deepEqual(findings('| A | B |\n| --- | --- |\n| a \\| b | c |'), [
    '3: an escaped pipe in a table cell: write "or" instead',
  ]);
});

test('a code fence that is never closed is reported', () => {
  assert.deepEqual(findings('# Title\n\n```sh\nls\n'), ['3: this code fence is never closed']);
});

test('a longer closing fence closes, a different fence character does not', () => {
  assert.deepEqual(findings('````\nx\n`````\n'), []);
  assert.deepEqual(findings('```\nx\n~~~\n'), ['1: this code fence is never closed']);
});

test('a second title and a skipped heading level are reported', () => {
  assert.deepEqual(findings('# One\n\n### Three\n\n# Two'), [
    '3: the heading skips from level 1 to level 3',
    '5: a second level-1 heading: a document has one title',
  ]);
});

test('a semicolon in a Mermaid sequence message is reported, outside sequence diagrams it is not', () => {
  const sequence = '```mermaid\nsequenceDiagram\n    A->>B: read; then write\n    Note over A: fine, #59; here\n```';
  assert.deepEqual(findings(sequence), [
    '3: a semicolon in a Mermaid sequence message ends the statement: write a comma or #59;',
  ]);
  assert.deepEqual(findings('```mermaid\nflowchart LR\n    A --> B; B --> C\n```'), []);
});

test('the hook checks only Markdown files of this repository outside its worktrees', () => {
  assert.equal(isHookTarget(path.join(root, 'docs', 'note.md'), root), true);
  assert.equal(isHookTarget(path.join(root, 'tools', 'x.mjs'), root), false);
  assert.equal(isHookTarget('/tmp/stage/docs/note.md', root), false);
  assert.equal(isHookTarget(path.join(root, '.claude', 'worktrees', 't05', 'docs', 'x.md'), root), false);
  assert.equal(isHookTarget(path.join(root, 'docs', 'x.md'), path.join('/r', '.claude', 'worktrees', 't05')), false);
});

function capture(args) {
  const streams = { out: '', err: '' };
  const code = main(args, {
    root,
    out: { write: (text) => (streams.out += text) },
    err: { write: (text) => (streams.err += text) },
  });
  return { code, ...streams };
}

test('the command line reports on stdout with exit code 1, the hook on stderr with exit code 2', () => {
  const broken = path.join(root, 'docs', 'broken.md');
  writeFileSync(broken, '[x](./missing.md)\n');
  assert.deepEqual(capture([broken]), {
    code: 1,
    out: 'docs/broken.md:1: the link target does not exist: ./missing.md\n',
    err: '',
  });
  assert.deepEqual(capture(['--hook', broken]), {
    code: 2,
    out: '',
    err: 'docs/broken.md:1: the link target does not exist: ./missing.md\n',
  });
  assert.equal(capture([path.join(root, 'docs', 'DESIGN.md')]).code, 0);
});

test('the hook lets a file outside the repository pass', () => {
  const outside = mkdtempSync(path.join(tmpdir(), 'doc-check-outside-'));
  const file = path.join(outside, 'note.md');
  writeFileSync(file, '[x](./missing.md)\n');
  try {
    assert.deepEqual(capture(['--hook', file]), { code: 0, out: '', err: '' });
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});

test('--as checks a staged copy as if it lived at its place in the repository', () => {
  const stage = mkdtempSync(path.join(tmpdir(), 'doc-check-stage-'));
  const staged = path.join(stage, 'note.md');
  writeFileSync(staged, '[design](./DESIGN.md) [x](./missing.md)\n');
  try {
    assert.deepEqual(capture(['--as', path.join(root, 'docs', 'note.md'), staged]), {
      code: 1,
      out: 'docs/note.md:1: the link target does not exist: ./missing.md\n',
      err: '',
    });
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
});

test('a call without files, or --as with several files, prints the usage', () => {
  assert.equal(capture([]).code, 2);
  assert.equal(capture(['--as', 'x.md', 'a.md', 'b.md']).code, 2);
});
