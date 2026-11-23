// Checks the statements under "Structure check" in docs/LAYOUT.md.
// Run it from anywhere, with the submodules checked out: node tools/structure-check.mjs
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STANDARD = 'docs/LAYOUT.md';
const MANIFEST = 'version-manifest.yaml';
const GITMODULES = '.gitmodules';
const GITATTRIBUTES = '.gitattributes';
const LINE_ENDING_RULE = '* text=auto eol=lf';
const CONTRACTS = 'contracts';
const DEPLOYABLE_PARENTS = ['services', 'platform', 'apps'];
const WORKERS = 'workers';
const SANDBOXES = 'platform/workers/sandboxes';
const NEVER_TRACKED = ['go.work', 'go.work.sum'];
const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', '.nx']);

const isDeployable = (project) => DEPLOYABLE_PARENTS.includes(project.dir.split('/')[0]);
// The deployables and the contracts each have a repository of their own.
const isSubRepository = (project) => isDeployable(project) || project.name === CONTRACTS;
const subRepository = (name) => `contelys-cloud-${name}`;

// The "Projects" table of the standard is the list of projects. Nothing is repeated here.
function readProjects(root) {
  const lines = readFileSync(path.join(root, STANDARD), 'utf8').split(/\r?\n/);
  const start = lines.indexOf('## Projects');
  if (start === -1) throw new Error(`${STANDARD} has no "## Projects" section`);
  const projects = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    const row = line.match(/^\| `([^`]+)` \| `([^`]+)` \| ([^|]+?) \|$/);
    if (row) projects.push({ name: row[1], dir: row[2], language: row[3] });
  }
  if (projects.length === 0) throw new Error(`the "Projects" table of ${STANDARD} has no rows`);
  return projects;
}

// Parses one flow mapping of the manifest, such as {version: null, digest: "sha256:..."}.
// Values are null, a quoted string, a plain word or a nested mapping.
function parseFlowMapping(text) {
  let i = 0;
  const skipSpaces = () => {
    while (text[i] === ' ') i++;
  };
  const value = () => {
    skipSpaces();
    if (text[i] === '{') return mapping();
    if (text[i] === '"') {
      const end = text.indexOf('"', i + 1);
      if (end === -1) throw new Error('a quote is not closed');
      const quoted = text.slice(i + 1, end);
      i = end + 1;
      return quoted;
    }
    const start = i;
    while (i < text.length && text[i] !== ',' && text[i] !== '}') i++;
    const plain = text.slice(start, i).trim();
    if (plain === '') throw new Error('a value is missing');
    return plain === 'null' ? null : plain;
  };
  const mapping = () => {
    const result = {};
    i++;
    skipSpaces();
    if (text[i] === '}') {
      i++;
      return result;
    }
    for (;;) {
      skipSpaces();
      const key = text.slice(i).match(/^([A-Za-z0-9_-]+):/);
      if (!key) throw new Error('a key is missing');
      i += key[0].length;
      result[key[1]] = value();
      skipSpaces();
      if (text[i] === ',') i++;
      else if (text[i] === '}') {
        i++;
        return result;
      } else throw new Error('a comma or a closing brace is missing');
    }
  };
  skipSpaces();
  if (text[i] !== '{') throw new Error('an opening brace is missing');
  const result = mapping();
  skipSpaces();
  if (i !== text.length) throw new Error('there is text after the closing brace');
  return result;
}

// Reads the manifest in the form the standard gives it: the version of the contracts and one
// line per deployable. Without a line for the contracts, `contracts` is undefined.
function readManifest(root) {
  const entries = new Map();
  const unreadable = [];
  let contracts;
  const lines = readFileSync(path.join(root, MANIFEST), 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.trim() === '' || line.trim().startsWith('#')) return;
    if (/^(productVersion: \S.*|deployables:)$/.test(line)) return;
    const contractsLine = line.match(/^contracts: (\S+)$/);
    if (contractsLine) {
      contracts = contractsLine[1] === 'null' ? null : contractsLine[1];
      return;
    }
    try {
      const entry = line.match(/^  ([a-z0-9-]+): (\{.*\})\s*$/);
      if (!entry) throw new Error('it is not of the form "  <slug>: {version: ..., digest: ...}"');
      if (entries.has(entry[1])) throw new Error(`${entry[1]} is listed twice`);
      entries.set(entry[1], parseFlowMapping(entry[2]));
    } catch (error) {
      unreadable.push(`${MANIFEST}:${index + 1} cannot be read: ${error.message}`);
    }
  });
  return { entries, unreadable, contracts };
}

// Returns the path and address of every submodule in .gitmodules, or null without the file.
function readGitmodules(root) {
  const file = path.join(root, GITMODULES);
  if (!existsSync(file)) return null;
  const entries = [];
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (/^\[submodule ".*"\]$/.test(line)) entries.push({});
    const setting = line.match(/^(path|url)\s*=\s*(.+)$/);
    if (setting && entries.length > 0) entries.at(-1)[setting[1]] = setting[2];
  }
  return entries;
}

// Returns the targets of replace directives and the module paths of require directives.
function readGoMod(text) {
  const replaces = [];
  const requires = [];
  const unquote = (word) => word.replace(/^"|"$/g, '');
  const collect = (directive, entry) => {
    if (directive === 'require') requires.push(unquote(entry.split(/\s+/)[0]));
    else if (entry.includes('=>')) replaces.push(unquote(entry.split('=>')[1].trim().split(/\s+/)[0]));
  };
  let block = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (line === '') continue;
    if (block) {
      if (line === ')') block = null;
      else collect(block, line);
      continue;
    }
    const opening = line.match(/^(replace|require)\s*\($/);
    const single = line.match(/^(replace|require)\s+(.+)$/);
    if (opening) block = opening[1];
    else if (single) collect(single[1], single[2]);
  }
  return { replaces, requires };
}

function findFiles(root, name, relative = '') {
  const found = [];
  for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) found.push(...findFiles(root, name, child));
    } else if (entry.name === name) found.push(child);
  }
  return found;
}

// A CODEOWNERS pattern covers a directory when it is `*` or a path to that directory or to one
// above it. These are the forms the standard prescribes. Any other pattern counts as no match,
// so the check fails instead of guessing.
function covers(pattern, dir) {
  if (pattern === '*') return true;
  const base = pattern.replace(/^\//, '').replace(/\/$/, '');
  return !/[*?[\]]/.test(base) && (dir === base || dir.startsWith(`${base}/`));
}

// Returns a function that tells whether a directory has an owner, or null without a CODEOWNERS
// file. The last matching line decides, and a line without an owner removes ownership.
function readCodeowners(root) {
  const file = path.join(root, 'CODEOWNERS');
  if (!existsSync(file)) return null;
  const rules = [];
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const [pattern, ...owners] = raw.replace(/#.*$/, '').trim().split(/\s+/);
    if (pattern) rules.push({ pattern, owned: owners.length > 0 });
  }
  return (dir) => rules.findLast(({ pattern }) => covers(pattern, dir))?.owned === true;
}

// Returns one line per false statement, each starting with the number of the statement.
// The second argument comes from Git, and the tests pass their own: the tracked files that
// statement 6 forbids, the submodule pointers by project directory, and a function that gives
// the commit a version tag names in the sub-repository mounted at a directory, or null.
export function checkStructure(root, { trackedFiles, pointers, tagCommit }) {
  const failures = [];
  const fail = (statement, message) => failures.push(`${statement}. ${message}`);
  const at = (relative) => path.join(root, relative);
  const isDirectory = (relative) => existsSync(at(relative)) && statSync(at(relative)).isDirectory();
  const isFile = (relative) => existsSync(at(relative)) && statSync(at(relative)).isFile();
  const directoriesIn = (relative) =>
    isDirectory(relative)
      ? readdirSync(at(relative), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
      : [];

  const projects = readProjects(root);
  const deployables = projects.filter(isDeployable);
  const subRepositories = projects.filter(isSubRepository);
  const slugs = new Set(deployables.map((project) => project.name));
  const manifest = readManifest(root);
  const submodules = readGitmodules(root);

  // 1. The directories and the manifest list exactly the deployables of the table.
  for (const problem of manifest.unreadable) fail(1, problem);
  const listed = new Set(deployables.map((project) => project.dir));
  const present = DEPLOYABLE_PARENTS.flatMap((parent) => directoriesIn(parent).map((name) => `${parent}/${name}`));
  for (const dir of present) {
    if (!listed.has(dir)) fail(1, `${dir}/ is not a deployable in the "Projects" table of ${STANDARD}`);
  }
  for (const dir of listed) {
    if (!present.includes(dir)) fail(1, `${dir}/ is in the "Projects" table of ${STANDARD} but does not exist`);
  }
  for (const slug of manifest.entries.keys()) {
    if (!slugs.has(slug)) fail(1, `${MANIFEST} lists ${slug}, which is not a deployable`);
  }
  for (const slug of slugs) {
    if (!manifest.entries.has(slug)) fail(1, `${MANIFEST} does not list ${slug}`);
  }
  if (manifest.contracts === undefined) fail(1, `${MANIFEST} has no "${CONTRACTS}:" line`);

  // 2. Every project directory has a project.json named by the naming convention.
  const projectFiles = new Map();
  for (const project of projects) {
    const expected = isDeployable(project) ? path.posix.basename(project.dir) : project.dir.replaceAll('/', '-');
    if (project.name !== expected) {
      fail(2, `the "Projects" table of ${STANDARD} names ${project.dir} "${project.name}" instead of "${expected}"`);
    }
    const file = `${project.dir}/project.json`;
    if (!isFile(file)) {
      const notCheckedOut =
        submodules?.some((entry) => entry.path === project.dir) &&
        isDirectory(project.dir) &&
        readdirSync(at(project.dir)).length === 0;
      if (notCheckedOut) fail(2, `${project.dir}/ is a submodule that is not checked out: run "git submodule update --init"`);
      else fail(2, `${file} does not exist`);
      continue;
    }
    let json;
    try {
      json = JSON.parse(readFileSync(at(file), 'utf8'));
    } catch {
      fail(2, `${file} is not valid JSON`);
      continue;
    }
    projectFiles.set(project.name, json);
    if (json.name !== expected) fail(2, `${file} has the name "${json.name}" instead of "${expected}"`);
  }

  // 3. A deployable with a version has a Dockerfile and its dependency manifest and lock file.
  for (const project of deployables) {
    const version = manifest.entries.get(project.name)?.version;
    if (version == null) continue;
    const required = ['Dockerfile'];
    if (project.language.startsWith('Go')) required.push('go.mod', 'go.sum');
    if (/Node|TypeScript/.test(project.language)) required.push('package.json', 'package-lock.json');
    for (const name of required) {
      if (!isFile(`${project.dir}/${name}`)) {
        fail(3, `${project.name} has the version ${version} but ${project.dir}/${name} does not exist`);
      }
    }
  }

  // 4. A deployable depends on contracts and on no deployable or libs-service.
  const forbidden = new Set([...slugs, 'libs-service']);
  for (const project of deployables) {
    const json = projectFiles.get(project.name);
    if (!json) continue;
    const dependencies = json.implicitDependencies ?? [];
    if (!dependencies.includes(CONTRACTS)) {
      fail(4, `${project.dir}/project.json does not list contracts in implicitDependencies`);
    }
    for (const dependency of dependencies) {
      if (forbidden.has(dependency)) fail(4, `${project.dir}/project.json lists ${dependency} in implicitDependencies`);
    }
  }

  // 5. No go.mod replaces a module with a local path or requires another deployable's module.
  for (const file of findFiles(root, 'go.mod')) {
    const { replaces, requires } = readGoMod(readFileSync(at(file), 'utf8'));
    for (const target of replaces) {
      if (/^(\.{1,2}(\/|$)|\/)/.test(target)) fail(5, `${file} replaces a module with the local path ${target}`);
    }
    const owner = deployables.find((project) => file.startsWith(`${project.dir}/`));
    if (!owner) continue;
    for (const required of requires) {
      const modulePath = required.replace(/\/v\d+$/, '');
      const other = deployables.find((project) => project !== owner && modulePath.endsWith(`/${subRepository(project.name)}`));
      if (other) fail(5, `${file} requires ${required}, the module of ${other.name}`);
    }
  }

  // 6. No go.work or go.work.sum file is tracked.
  for (const file of trackedFiles) {
    if (NEVER_TRACKED.includes(path.posix.basename(file))) fail(6, `${file} is tracked`);
  }

  // 7. The submodule pointer of a sub-repository with a version in the manifest is the commit
  // that its version tag names.
  for (const project of subRepositories) {
    const version = project.name === CONTRACTS ? manifest.contracts : manifest.entries.get(project.name)?.version;
    if (version == null) continue;
    const pointer = pointers[project.dir];
    if (!pointer) {
      fail(7, `${project.name} has the version ${version} but ${project.dir} is not a submodule`);
      continue;
    }
    const tagged = tagCommit(project.dir, version);
    if (!tagged) {
      fail(7, `${project.name} has the version ${version} but its sub-repository has no tag ${version}`);
    } else if (tagged !== pointer) {
      fail(7, `${project.name} has the version ${version}, whose tag names ${tagged}, but its submodule pointer is ${pointer}`);
    }
  }

  // 8. In CODEOWNERS every project directory that is not a sub-repository has an owner, and
  // no sub-repository's directory has one: its content is owned in the sub-repository.
  const hasOwner = readCodeowners(root);
  if (hasOwner === null) fail(8, 'CODEOWNERS does not exist, so no path of the parent repository has an owning team');
  else {
    for (const project of projects) {
      if (isSubRepository(project)) {
        if (hasOwner(project.dir)) fail(8, `${project.dir}/ has an owner in CODEOWNERS, but a sub-repository is owned in its own repository`);
      } else if (!hasOwner(project.dir)) {
        fail(8, `${project.dir}/ is not matched by a pattern with an owner in CODEOWNERS`);
      }
    }
  }

  // 9. The sandbox images of Workers have a Dockerfile and are exactly those the manifest lists.
  const workerClasses = directoriesIn(SANDBOXES);
  for (const workerClass of workerClasses) {
    if (!isFile(`${SANDBOXES}/${workerClass}/Dockerfile`)) fail(9, `${SANDBOXES}/${workerClass}/Dockerfile does not exist`);
  }
  if (manifest.entries.has(WORKERS)) {
    const pinned = manifest.entries.get(WORKERS).sandboxes;
    if (pinned === null || typeof pinned !== 'object') {
      fail(9, `the line of ${WORKERS} in ${MANIFEST} has no sandboxes mapping`);
    } else {
      for (const workerClass of workerClasses) {
        if (!(workerClass in pinned)) fail(9, `${MANIFEST} does not list the sandbox image of the worker class ${workerClass}`);
      }
      for (const workerClass of Object.keys(pinned)) {
        if (!workerClasses.includes(workerClass)) {
          fail(9, `${MANIFEST} lists the worker class ${workerClass}, but ${SANDBOXES}/${workerClass}/ does not exist`);
        }
      }
    }
  }

  // 10. .gitmodules lists exactly the sub-repositories, and none has submodules of its own.
  if (submodules === null) fail(10, `${GITMODULES} does not exist, so nothing is a submodule`);
  else {
    for (const project of subRepositories) {
      const entry = submodules.find((candidate) => candidate.path === project.dir);
      const address = `../${subRepository(project.name)}.git`;
      if (!entry) fail(10, `${GITMODULES} has no entry for ${project.dir}`);
      else if (entry.url !== address) fail(10, `${GITMODULES} gives ${project.dir} the address ${entry.url} instead of ${address}`);
    }
    for (const entry of submodules) {
      if (!subRepositories.some((project) => project.dir === entry.path)) {
        fail(10, `${GITMODULES} lists ${entry.path}, which is not a sub-repository`);
      }
    }
  }
  for (const project of subRepositories) {
    if (isFile(`${project.dir}/${GITMODULES}`)) {
      fail(10, `${project.dir}/${GITMODULES} exists, but a sub-repository has no submodules of its own`);
    }
  }

  // 11. Every directory that .gitmodules lists forces LF line endings with its own .gitattributes,
  // because the file of the parent repository does not apply inside a submodule. A submodule
  // that is not checked out is left to statement 2.
  for (const { path: dir } of submodules ?? []) {
    if (!dir || !isDirectory(dir) || readdirSync(at(dir)).length === 0) continue;
    const file = `${dir}/${GITATTRIBUTES}`;
    const hasRule = isFile(file) && readFileSync(at(file), 'utf8').split(/\r?\n/).some((line) => line.trim() === LINE_ENDING_RULE);
    if (!hasRule) fail(11, `${file} does not contain the line "${LINE_ENDING_RULE}"`);
  }

  return failures;
}

function git(root, ...args) {
  const output = execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return output.split('\n').filter(Boolean);
}

// The commit that a tag names in the repository mounted at a directory. A directory that is
// not a repository of its own gives null, so that the parent repository's tags never answer.
function tagCommitIn(root, dir, tag) {
  if (!existsSync(path.join(root, dir, '.git'))) return null;
  try {
    const args = ['rev-parse', '--quiet', '--verify', `refs/tags/${tag}^{commit}`];
    return execFileSync('git', args, { cwd: path.join(root, dir), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const gitlinks = git(root, 'ls-files', '--stage', '--', ...DEPLOYABLE_PARENTS, CONTRACTS)
    .map((line) => line.match(/^160000 ([0-9a-f]+) \d\t(.+)$/))
    .filter(Boolean);
  const failures = checkStructure(root, {
    trackedFiles: git(root, 'ls-files', '--', ...NEVER_TRACKED.map((name) => `:(glob)**/${name}`)),
    pointers: Object.fromEntries(gitlinks.map(([, commit, dir]) => [dir, commit])),
    tagCommit: (dir, tag) => tagCommitIn(root, dir, tag),
  });
  if (failures.length === 0) console.log('structure check passed');
  else {
    console.error(`structure check failed:\n${failures.join('\n')}`);
    process.exitCode = 1;
  }
}
