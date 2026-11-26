// Tests for the structure check. Run: node --test tools/structure-check.test.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { checkStructure } from './structure-check.mjs';

const STANDARD = `# Repository layout standard

## Projects

| Project | Directory | Language |
| --- | --- | --- |
| \`collaboration\` | \`services/collaboration\` | Node/TypeScript |
| \`projects\` | \`services/projects\` | Go |
| \`edge\` | \`platform/edge\` | APISIX configuration |
| \`workers\` | \`platform/workers\` | Go |
| \`libs-service\` | \`libs/service\` | Go |
| \`authoring\` | \`apps/authoring\` | TypeScript |
| \`contracts\` | \`contracts\` | OpenAPI and Protobuf |

## Naming convention
`;

const deployable = (name, dependencies = ['contracts']) => JSON.stringify({ name, implicitDependencies: dependencies });
const manifest = (lines, contracts = 'null') =>
  ['productVersion: 0.0.0', `contracts: ${contracts}`, 'deployables:', ...lines, ''].join('\n');
const MANIFEST_LINES = {
  authoring: '  authoring: {version: null, digest: null}',
  collaboration: '  collaboration: {version: null, digest: null}',
  edge: '  edge: {version: null, digest: null}',
  projects: '  projects: {version: null, digest: null}',
  workers: '  workers: {version: null, digest: null, sandboxes: {}}',
};
const manifestWith = (changes, contracts) =>
  manifest(Object.values({ ...MANIFEST_LINES, ...changes }).filter(Boolean), contracts);
const GO_MOD = 'module github.com/example/contelys-cloud-projects\n\ngo 1.27\n';
const ATTRIBUTES = '* text=auto eol=lf\n';
const submodule = (dir, name) => `[submodule "${dir}"]\n\tpath = ${dir}\n\turl = ../contelys-cloud-${name}.git\n`;
const GITMODULES = {
  authoring: submodule('apps/authoring', 'authoring'),
  collaboration: submodule('services/collaboration', 'collaboration'),
  contracts: submodule('contracts', 'contracts'),
  edge: submodule('platform/edge', 'edge'),
  library: submodule('libs/service', 'libs-service'),
  projects: submodule('services/projects', 'projects'),
  workers: submodule('platform/workers', 'workers'),
};
const gitmodulesWith = (changes) => Object.values({ ...GITMODULES, ...changes }).filter(Boolean).join('');

// A small tree that satisfies every statement. A test changes one thing in it.
const BASE = {
  'docs/LAYOUT.md': STANDARD,
  'version-manifest.yaml': manifestWith({}),
  '.gitmodules': gitmodulesWith({}),
  'services/collaboration/project.json': deployable('collaboration'),
  'services/projects/project.json': deployable('projects'),
  'platform/edge/project.json': deployable('edge'),
  'platform/workers/project.json': deployable('workers'),
  'apps/authoring/project.json': deployable('authoring'),
  'libs/service/project.json': JSON.stringify({ name: 'libs-service' }),
  'contracts/project.json': JSON.stringify({ name: 'contracts' }),
  'services/collaboration/.gitattributes': ATTRIBUTES,
  'services/projects/.gitattributes': ATTRIBUTES,
  'platform/edge/.gitattributes': ATTRIBUTES,
  'platform/workers/.gitattributes': ATTRIBUTES,
  'apps/authoring/.gitattributes': ATTRIBUTES,
  'libs/service/.gitattributes': ATTRIBUTES,
  'contracts/.gitattributes': ATTRIBUTES,
  CODEOWNERS: [
    '# shared paths of the parent repository',
    '/deploy/ @example/platform',
    '',
  ].join('\n'),
};

// Writes BASE with the changes applied and checks it, and returns the failures and the pending
// findings. A change of null leaves the file out, and a path that ends in a slash makes an empty
// directory.
function run(t, changes = {}, git = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'structure-check-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [relative, content] of Object.entries({ ...BASE, ...changes })) {
    if (content === null) continue;
    if (relative.endsWith('/')) {
      mkdirSync(path.join(root, relative), { recursive: true });
      continue;
    }
    mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    writeFileSync(path.join(root, relative), content);
  }
  return checkStructure(root, { trackedFiles: [], pointers: {}, tagCommit: () => null, ...git });
}

// The failures alone.
const check = (t, changes, git) => run(t, changes, git).failures;

test('a tree that follows the standard passes', (t) => {
  assert.deepEqual(check(t), []);
});

test('1: a directory that the table does not list fails', (t) => {
  assert.deepEqual(check(t, { 'services/billing/project.json': deployable('billing') }), [
    '1. services/billing/ is not a deployable in the "Projects" table of docs/LAYOUT.md',
  ]);
});

test('1: a deployable that .gitmodules lists but that has no directory fails', (t) => {
  const failures = check(t, { 'platform/edge/project.json': null, 'platform/edge/.gitattributes': null });
  assert.ok(failures.includes('1. platform/edge/ is in the "Projects" table of docs/LAYOUT.md but does not exist'));
});

test('1, 2: a project that is neither committed nor mounted waits in statement 10', (t) => {
  const result = run(t, {
    'platform/workers/project.json': null,
    'platform/workers/.gitattributes': null,
    'libs/service/project.json': null,
    'libs/service/.gitattributes': null,
    '.gitmodules': gitmodulesWith({ workers: null, library: null }),
  });
  assert.deepEqual(result, {
    failures: [],
    pending: ['10. .gitmodules has no entry for platform/workers', '10. .gitmodules has no entry for libs/service'],
  });
});

test('1: a manifest that misses a deployable or lists an unknown one fails', (t) => {
  const changed = manifestWith({ edge: null, ghost: '  ghost: {version: null, digest: null}' });
  assert.deepEqual(check(t, { 'version-manifest.yaml': changed }), [
    '1. version-manifest.yaml lists ghost, which is not a deployable',
    '1. version-manifest.yaml does not list edge',
  ]);
});

test('1: a manifest line in another form fails', (t) => {
  const failures = check(t, { 'version-manifest.yaml': manifestWith({ edge: '  edge:' }) });
  assert.match(failures[0], /^1\. version-manifest\.yaml:6 cannot be read: /);
});

test('1: a manifest without a line for the contracts fails', (t) => {
  const without = manifestWith({}).replace('contracts: null\n', '');
  assert.deepEqual(check(t, { 'version-manifest.yaml': without }), ['1. version-manifest.yaml has no "contracts:" line']);
});

test('1: a manifest line with extra fields passes', (t) => {
  const line = '  edge: {version: null, digest: null, routes: "sha256:abc", extra: {a: b}}';
  assert.deepEqual(check(t, { 'version-manifest.yaml': manifestWith({ edge: line }) }), []);
});

test('2: a project directory without project.json fails', (t) => {
  const changes = { 'platform/edge/project.json': null, 'platform/edge/apisix.yaml': '' };
  assert.deepEqual(check(t, changes), ['2. platform/edge/project.json does not exist']);
});

test('2: a submodule that is not checked out is named as such', (t) => {
  const changes = { 'platform/edge/project.json': null, 'platform/edge/.gitattributes': null, 'platform/edge/': '' };
  assert.deepEqual(check(t, changes), [
    '2. platform/edge/ is a submodule that is not checked out: run "git submodule update --init"',
  ]);
});

test('2: a project.json with a name outside the convention fails', (t) => {
  assert.deepEqual(check(t, { 'libs/service/project.json': JSON.stringify({ name: 'service' }) }), [
    '2. libs/service/project.json has the name "service" instead of "libs-service"',
  ]);
});

test('3: a Go deployable with a version needs a Dockerfile, go.mod and go.sum', (t) => {
  const versioned = manifestWith({ projects: '  projects: {version: v1.0.0, digest: "sha256:abc"}' });
  const git = { pointers: { 'services/projects': 'c0ffee' }, tagCommit: () => 'c0ffee' };
  assert.deepEqual(check(t, { 'version-manifest.yaml': versioned }, git), [
    '3. projects has the version v1.0.0 but services/projects/Dockerfile does not exist',
    '3. projects has the version v1.0.0 but services/projects/go.mod does not exist',
    '3. projects has the version v1.0.0 but services/projects/go.sum does not exist',
  ]);
  const files = { 'services/projects/Dockerfile': '', 'services/projects/go.mod': GO_MOD, 'services/projects/go.sum': '' };
  assert.deepEqual(check(t, { 'version-manifest.yaml': versioned, ...files }, git), []);
});

test('3: a Node deployable with a version needs package.json and package-lock.json', (t) => {
  const versioned = manifestWith({ collaboration: '  collaboration: {version: v0.1.0, digest: "sha256:abc"}' });
  const files = { 'services/collaboration/Dockerfile': '', 'services/collaboration/package.json': '{}' };
  const git = { pointers: { 'services/collaboration': 'c0ffee' }, tagCommit: () => 'c0ffee' };
  assert.deepEqual(check(t, { 'version-manifest.yaml': versioned, ...files }, git), [
    '3. collaboration has the version v0.1.0 but services/collaboration/package-lock.json does not exist',
  ]);
});

test('4: a deployable that does not depend on contracts fails', (t) => {
  assert.deepEqual(check(t, { 'services/projects/project.json': deployable('projects', []) }), [
    '4. services/projects/project.json does not list contracts in implicitDependencies',
  ]);
});

test('4: a deployable that depends on another deployable or on libs-service fails', (t) => {
  const changed = deployable('projects', ['contracts', 'workers', 'libs-service']);
  assert.deepEqual(check(t, { 'services/projects/project.json': changed }), [
    '4. services/projects/project.json lists workers in implicitDependencies',
    '4. services/projects/project.json lists libs-service in implicitDependencies',
  ]);
});

test('5: a replace directive that points at a local path fails', (t) => {
  const single = `${GO_MOD}\nreplace github.com/example/contelys-cloud/libs/service => ../../libs/service\n`;
  assert.deepEqual(check(t, { 'services/projects/go.mod': single }), [
    '5. services/projects/go.mod replaces a module with the local path ../../libs/service',
  ]);
  const block = `${GO_MOD}\nreplace (\n\texample.com/a v1.0.0 => /opt/a // local\n\texample.com/b => example.com/c v1.2.0\n)\n`;
  assert.deepEqual(check(t, { 'libs/service/go.mod': block }), [
    '5. libs/service/go.mod replaces a module with the local path /opt/a',
  ]);
});

test("5: a deployable that requires another deployable's module fails", (t) => {
  const allowed = '\tgithub.com/example/contelys-cloud/libs/service v1.2.0\n\tgithub.com/example/contelys-cloud-contracts v1.0.0\n';
  const changed = `${GO_MOD}\nrequire (\n${allowed}\tgithub.com/example/contelys-cloud-workers/v2 v2.0.1\n)\n`;
  assert.deepEqual(check(t, { 'services/projects/go.mod': changed }), [
    '5. services/projects/go.mod requires github.com/example/contelys-cloud-workers/v2, the module of workers',
  ]);
});

test('6: a tracked go.work or go.work.sum file fails, and .gitmodules does not', (t) => {
  const git = { trackedFiles: ['.gitmodules', 'services/projects/go.work', 'go.work.sum', 'docs/DESIGN.md'] };
  assert.deepEqual(check(t, {}, git), ['6. services/projects/go.work is tracked', '6. go.work.sum is tracked']);
});

test('7: a version needs a submodule pointer at the commit its tag names', (t) => {
  const versioned = manifestWith({ edge: '  edge: {version: v1.0.0, digest: "sha256:abc"}' });
  const changes = { 'version-manifest.yaml': versioned, 'platform/edge/Dockerfile': '' };
  const tagCommit = (dir, tag) => (dir === 'platform/edge' && tag === 'v1.0.0' ? 'aaa111' : null);
  assert.deepEqual(check(t, changes), ['7. edge has the version v1.0.0 but platform/edge is not a submodule']);
  assert.deepEqual(check(t, changes, { pointers: { 'platform/edge': 'aaa111' } }), [
    '7. edge has the version v1.0.0 but its sub-repository has no tag v1.0.0',
  ]);
  assert.deepEqual(check(t, changes, { pointers: { 'platform/edge': 'bbb222' }, tagCommit }), [
    '7. edge has the version v1.0.0, whose tag names aaa111, but its submodule pointer is bbb222',
  ]);
  assert.deepEqual(check(t, changes, { pointers: { 'platform/edge': 'aaa111' }, tagCommit }), []);
});

test('7: the version of the contracts needs its pointer at the commit its tag names', (t) => {
  const changes = { 'version-manifest.yaml': manifestWith({}, 'v1.3.0') };
  const tagCommit = (dir, tag) => (dir === 'contracts' && tag === 'v1.3.0' ? 'ccc333' : null);
  assert.deepEqual(check(t, changes), ['7. contracts has the version v1.3.0 but contracts is not a submodule']);
  assert.deepEqual(check(t, changes, { pointers: { contracts: 'ddd444' }, tagCommit }), [
    '7. contracts has the version v1.3.0, whose tag names ccc333, but its submodule pointer is ddd444',
  ]);
  assert.deepEqual(check(t, changes, { pointers: { contracts: 'ccc333' }, tagCommit }), []);
});

test('8: a missing CODEOWNERS file waits for the owner and does not fail', (t) => {
  assert.deepEqual(run(t, { CODEOWNERS: null }), {
    failures: [],
    pending: ['8. CODEOWNERS does not exist, so no path of the parent repository has an owning team'],
  });
});

test('8: a project directory of the parent repository without an owner fails', (t) => {
  // Every project of the table is a sub-repository, so the test adds one that the parent holds.
  const standard = STANDARD.replace('| `contracts` |', '| `tools-sample` | `tools/sample` | Go |\n| `contracts` |');
  const changes = { 'docs/LAYOUT.md': standard, 'tools/sample/project.json': JSON.stringify({ name: 'tools-sample' }) };
  const unowned = ['8. tools/sample/ is not matched by a pattern with an owner in CODEOWNERS'];
  assert.deepEqual(check(t, changes), unowned);
  const owned = `${BASE.CODEOWNERS}/tools/ @example/platform\n`;
  assert.deepEqual(check(t, { ...changes, CODEOWNERS: owned }), []);
  assert.deepEqual(check(t, { ...changes, CODEOWNERS: `${owned}/tools/sample/\n` }), unowned);
});

test("8: a sub-repository's directory with an owner fails", (t) => {
  const owned = `${BASE.CODEOWNERS}/services/projects/ @example/projects\n/platform/ @example/platform\n/libs/ @example/platform\n/contracts/ @example/platform\n`;
  const reason = 'has an owner in CODEOWNERS, but a sub-repository is owned in its own repository';
  assert.deepEqual(check(t, { CODEOWNERS: owned }), [
    `8. services/projects/ ${reason}`,
    `8. platform/edge/ ${reason}`,
    `8. platform/workers/ ${reason}`,
    `8. libs/service/ ${reason}`,
    `8. contracts/ ${reason}`,
  ]);
});

test('8: a pattern for everything is allowed when later lines take the sub-repositories out', (t) => {
  const everything = '* @example/platform\n';
  assert.equal(check(t, { CODEOWNERS: everything }).length, 7);
  assert.deepEqual(check(t, { CODEOWNERS: `${everything}/services/\n/platform/\n/apps/\n/libs/service/\n/contracts/\n` }), []);
});

test('9: a sandbox directory needs a Dockerfile and an entry in the manifest', (t) => {
  assert.deepEqual(check(t, { 'platform/workers/sandboxes/image/README.md': '' }), [
    '9. platform/workers/sandboxes/image/Dockerfile does not exist',
    '9. version-manifest.yaml does not list the sandbox image of the worker class image',
  ]);
  const listed = manifestWith({ workers: '  workers: {version: null, digest: null, sandboxes: {image: null}}' });
  const changes = { 'platform/workers/sandboxes/image/Dockerfile': '', 'version-manifest.yaml': listed };
  assert.deepEqual(check(t, changes), []);
});

test('10: a missing .gitmodules file fails', (t) => {
  assert.deepEqual(check(t, { '.gitmodules': null }), [
    '10. .gitmodules does not exist, so nothing is a submodule',
  ]);
});

test('10: .gitmodules lists exactly the sub-repositories, each with its relative address', (t) => {
  const absolute = submodule('services/projects', 'projects').replace('../', 'https://example.test/');
  const changed = gitmodulesWith({ edge: null, projects: absolute, ansible: submodule('deploy/ansible', 'ansible') });
  assert.deepEqual(run(t, { '.gitmodules': changed }), {
    failures: [
      '10. .gitmodules gives services/projects the address https://example.test/contelys-cloud-projects.git instead of ../contelys-cloud-projects.git',
      '10. .gitmodules lists deploy/ansible, which is not a sub-repository',
    ],
    pending: ['10. .gitmodules has no entry for platform/edge'],
  });
});

test('10: a deployable without an entry fails when it is committed or has a submodule pointer', (t) => {
  const changes = { '.gitmodules': gitmodulesWith({ edge: null }) };
  const missing = '10. .gitmodules has no entry for platform/edge';
  assert.ok(check(t, changes, { committed: ['platform/edge'] }).includes(missing));
  assert.ok(check(t, changes, { pointers: { 'platform/edge': 'eee555' } }).includes(missing));
});

test('10: the shared service library committed in the parent repository fails', (t) => {
  const changes = { '.gitmodules': gitmodulesWith({ library: null }), 'libs/service/.gitattributes': null };
  assert.deepEqual(check(t, changes, { committed: ['libs/service'] }), ['10. .gitmodules has no entry for libs/service']);
});

test('11: a sub-repository without the line-ending rule in its .gitattributes fails', (t) => {
  const changes = { 'contracts/.gitattributes': null, 'platform/edge/.gitattributes': '*.png binary\n' };
  assert.deepEqual(check(t, changes), [
    '11. contracts/.gitattributes does not contain the line "* text=auto eol=lf"',
    '11. platform/edge/.gitattributes does not contain the line "* text=auto eol=lf"',
  ]);
});

test('11: a directory that .gitmodules does not list needs no .gitattributes', (t) => {
  const changes = { '.gitmodules': gitmodulesWith({ edge: null }), 'platform/edge/.gitattributes': null };
  assert.deepEqual(run(t, changes), { failures: [], pending: ['10. .gitmodules has no entry for platform/edge'] });
});

test('10: a sub-repository with submodules of its own fails', (t) => {
  assert.deepEqual(check(t, { 'services/projects/.gitmodules': '' }), [
    '10. services/projects/.gitmodules exists, but a sub-repository has no submodules of its own',
  ]);
});

test('9: a sandbox entry without a directory, or no sandboxes mapping, fails', (t) => {
  const extra = manifestWith({ workers: '  workers: {version: null, digest: null, sandboxes: {video: "sha256:abc"}}' });
  assert.deepEqual(check(t, { 'version-manifest.yaml': extra }), [
    '9. version-manifest.yaml lists the worker class video, but platform/workers/sandboxes/video/ does not exist',
  ]);
  const missing = manifestWith({ workers: '  workers: {version: null, digest: null}' });
  assert.deepEqual(check(t, { 'version-manifest.yaml': missing }), [
    '9. the line of workers in version-manifest.yaml has no sandboxes mapping',
  ]);
});
