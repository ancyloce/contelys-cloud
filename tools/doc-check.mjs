// Checks Markdown documents for the mistakes that review rounds kept finding: a code fence that is
// never closed, a second title or a skipped heading level, a table row with the wrong number of cells
// or an escaped pipe, a semicolon in a Mermaid sequence message, a relative link to a missing file,
// and a citation of a decision record that does not exist ("ADR 0045", "Edge ADR 0003").
//
//   node tools/doc-check.mjs <file>...           findings on stdout, exit code 1 if there are any
//   node tools/doc-check.mjs --as <path> <file>  checks a staged copy as if it lived at <path>
//   node tools/doc-check.mjs --hook <file>       for the PostToolUse hook: findings on stderr and exit
//                                                code 2, so that the agent sees them. A file outside
//                                                this repository, in one of its worktrees or not
//                                                ending in .md passes
//
// A document under docs/archive/ keeps its original links and citations, so neither is checked there.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEPLOYABLE_PARENTS = ['services', 'platform', 'apps'];
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const HEADING = /^ {0,3}(#{1,6})(?:\s|$)/;
const TABLE_ROW = /^ {0,3}\|/;
const DELIMITER_ROW = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;
const INLINE_LINK = /!?\[[^\]]*\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
const REFERENCE_DEFINITION = /^ {0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)/;
const CITATION = /((?:[A-Z][A-Za-z]* )*)ADR (\d{4})\b/g;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const MERMAID_ENTITY = /#\w+;/g;
const WORKTREES = path.join('.claude', 'worktrees');
const USAGE = 'usage: node tools/doc-check.mjs [--hook] [--as <path>] <file>...\n';

// Inline code is literal text: a link or a citation inside it is not one.
const withoutCode = (line) => line.replace(/(`+)[\s\S]*?\1/g, (span) => ' '.repeat(span.length));

// The cells of a table row. A pipe inside a code span still separates cells, as GitHub renders it.
function cellCount(line) {
  let body = line.trim();
  if (body.startsWith('|')) body = body.slice(1);
  if (body.endsWith('|') && !body.endsWith('\\|')) body = body.slice(0, -1);
  return body.split(/(?<!\\)\|/).length;
}

function linkTarget(raw) {
  let target = raw.startsWith('<') ? raw.slice(1, -1) : raw;
  if (target === '' || target.startsWith('#') || SCHEME.test(target)) return undefined;
  target = target.split('#')[0].split('?')[0];
  try {
    target = decodeURIComponent(target);
  } catch {
    // An undecodable target is checked as written.
  }
  return target;
}

// "Edge ADR 0003" names a record of the sub-repository mounted at platform/edge, "ADR 0045" one of
// the parent repository. The longest run of words before "ADR" that names a deployable's directory
// decides, so "Write Edge ADR 0003" still names Edge's record.
function recordDirectory(root, words) {
  for (let take = words.length; take > 0; take--) {
    const name = words.slice(words.length - take);
    const slug = name.join('-').toLowerCase();
    for (const parent of DEPLOYABLE_PARENTS) {
      if (existsSync(path.join(root, parent, slug))) {
        return { dir: path.join(root, parent, slug, 'docs', 'adr'), owner: `${name.join(' ')} ` };
      }
    }
  }
  return { dir: path.join(root, 'docs', 'adr'), owner: '' };
}

export function checkDocument(text, { file, root }) {
  const findings = [];
  const report = (line, message) => findings.push({ line, message });
  const relative = path.relative(root, file).split(path.sep).join('/');
  const archived = /(^|\/)docs\/archive\//.test(relative);
  const records = new Map();
  const recordExists = (dir, number) => {
    if (!records.has(dir)) {
      try {
        records.set(dir, readdirSync(dir));
      } catch {
        records.set(dir, []);
      }
    }
    return records.get(dir).some((name) => name.startsWith(`${number}-`) && name.endsWith('.md'));
  };

  let fence;
  let table;
  let titles = 0;
  let previousLevel = 0;
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const number = index + 1;
    const opener = FENCE.exec(line);
    if (fence) {
      if (opener && opener[1][0] === fence.char && opener[1].length >= fence.length && opener[2].trim() === '') {
        fence = undefined;
        return;
      }
      const content = line.trim();
      if (fence.mermaid && content !== '' && !content.startsWith('%%')) {
        if (fence.kind === undefined) {
          fence.kind = content.split(/\s/)[0];
        } else if (fence.kind === 'sequenceDiagram') {
          const colon = content.indexOf(':');
          if (colon !== -1 && content.slice(colon + 1).replace(MERMAID_ENTITY, '').includes(';')) {
            report(number, 'a semicolon in a Mermaid sequence message ends the statement: write a comma or #59;');
          }
        }
      }
      return;
    }
    if (opener) {
      fence = { char: opener[1][0], length: opener[1].length, line: number, mermaid: opener[2].trim() === 'mermaid' };
      table = undefined;
      return;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length;
      if (level === 1 && ++titles === 2) report(number, 'a second level-1 heading: a document has one title');
      if (previousLevel !== 0 && level > previousLevel + 1) {
        report(number, `the heading skips from level ${previousLevel} to level ${level}`);
      }
      previousLevel = level;
    }

    if (TABLE_ROW.test(line)) {
      if (!table) table = { start: number, columns: cellCount(line), rows: 0 };
      table.rows++;
      if (table.rows === 2 && !DELIMITER_ROW.test(line.trim())) {
        report(table.start, 'a table needs a delimiter row, such as | --- | --- |, as its second line');
      }
      const cells = cellCount(line);
      if (cells !== table.columns) report(number, `this table row has ${cells} cells and its header ${table.columns}`);
      if (line.includes('\\|')) report(number, 'an escaped pipe in a table cell: write "or" instead');
    } else {
      table = undefined;
    }

    if (archived) return;
    const prose = withoutCode(line);
    const targets = [...prose.matchAll(INLINE_LINK)].map((match) => match[1]);
    const definition = REFERENCE_DEFINITION.exec(prose);
    if (definition) targets.push(definition[1]);
    for (const raw of targets) {
      const target = linkTarget(raw);
      if (target === undefined) continue;
      const resolved = target.startsWith('/') ? path.join(root, target) : path.resolve(path.dirname(file), target);
      if (!existsSync(resolved)) report(number, `the link target does not exist: ${raw}`);
    }
    for (const match of prose.matchAll(CITATION)) {
      const words = match[1].trim().split(' ').filter(Boolean);
      const { dir, owner } = recordDirectory(root, words);
      if (!recordExists(dir, match[2])) {
        report(number, `"${owner}ADR ${match[2]}" names no record in ${path.relative(root, dir).split(path.sep).join('/')}`);
      }
    }
  });
  if (fence) report(fence.line, 'this code fence is never closed');
  return findings;
}

// The hook checks only this repository's own Markdown files. A worktree holds no documents, so its
// links to them would all fail.
export function isHookTarget(file, root) {
  if (!file.endsWith('.md')) return false;
  if (root.split(path.sep).join('/').includes('/.claude/worktrees/')) return false;
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return false;
  return !(relative === WORKTREES || relative.startsWith(WORKTREES + path.sep));
}

export function main(args, { root, out = process.stdout, err = process.stderr }) {
  let hook = false;
  let as;
  const files = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--hook') hook = true;
    else if (args[i] === '--as') as = args[++i];
    else files.push(args[i]);
  }
  if (files.length === 0 || (as !== undefined && (as === '' || files.length !== 1))) {
    err.write(USAGE);
    return 2;
  }
  const lines = [];
  for (const given of files) {
    const file = path.resolve(given);
    if (hook && !isHookTarget(file, root)) continue;
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch (error) {
      if (!hook) lines.push(`${given}: cannot be read (${error.code})`);
      continue;
    }
    const placed = as === undefined ? file : path.resolve(as);
    const shown = path.relative(root, placed).startsWith('..') ? placed : path.relative(root, placed);
    for (const finding of checkDocument(text, { file: placed, root })) {
      lines.push(`${shown}:${finding.line}: ${finding.message}`);
    }
  }
  if (lines.length === 0) return 0;
  (hook ? err : out).write(`${lines.join('\n')}\n`);
  return hook ? 2 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  process.exitCode = main(process.argv.slice(2), { root });
}
