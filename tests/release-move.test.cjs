const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'roadmap-app.js'), 'utf8');

function setup({ failure = false } = {}) {
  const nodes = new Map();
  const node = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, {
      value: '', innerHTML: '', textContent: '', disabled: false, style: {},
      classList: { add() {}, remove() {}, contains() { return false; } },
      addEventListener() {}, setAttribute() {}, querySelectorAll() { return []; },
      closest() { return this; },
      insertAdjacentHTML(position, html) { this.insertedHTML = html; },
    });
    return nodes.get(selector);
  };
  const requests = [];
  const context = vm.createContext({
    window: {}, location: { search: '', hash: '' }, URLSearchParams, URL, Intl,
    console, setTimeout() {}, clearTimeout() {},
    document: { querySelector: node, querySelectorAll() { return []; },
      addEventListener() {}, body: node('body'), documentElement: node('html') },
    fetch: async (url, options) => {
      requests.push(JSON.parse(options.body));
      return { ok: !failure, status: failure ? 500 : 200,
        json: async () => failure ? { error: 'Save failed' } : { updatedAt: new Date().toISOString() } };
    },
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'roadmap-data.js'), 'utf8'), context);
  vm.runInContext(source.replace(/\ninit\(\);\s*$/, ''), context);
  vm.runInContext(`state.owner = true; state.sessionToken = 'test-only';
    state.selected = data.features[0].id; state.release = data.features[0].release;`, context);
  const target = vm.runInContext('data.releases.find(r => r.id !== state.release).id', context);
  node('#releaseSelect').value = target;
  node('#statusSelect').value = 'acceptance';
  node('#progressInput').value = '71';
  node('#noteInput').value = '  Updated note  ';
  return { context, node, target, requests, run: (code) => vm.runInContext(code, context) };
}

test('editor includes every release and selects the current release', () => {
  const app = setup();
  app.run('openFeature(state.selected)');
  const html = app.node('#statusSelect').insertedHTML;
  assert.match(html, /label for="releaseSelect"/);
  for (const id of app.run('data.releases.map(r => r.id)')) assert.ok(html.includes(`value="${id}"`));
  assert.ok(html.includes(`value="${app.run('state.release')}" selected`));
});

test('saved move persists release, preserves overrides and changes the visible release', async () => {
  const app = setup();
  app.run(`state.overrides[state.selected] = { owner: 'Keep owner' }`);
  await app.run('saveFeature()');
  const saved = Object.values(app.requests[0].overrides)[0];
  assert.equal(saved.release, app.target);
  assert.equal(saved.owner, 'Keep owner');
  assert.equal(saved.status, 'acceptance');
  assert.equal(saved.progress, 71);
  assert.equal(saved.note, 'Updated note');
  assert.equal(app.run('state.release'), app.target);
  const id = app.run('state.selected');
  assert.ok(app.node('#roadmap').innerHTML.includes(`data-feature="${id}"`));
  app.run('state.release = data.features[0].release; renderRoadmap()');
  assert.ok(!app.node('#roadmap').innerHTML.includes(`data-feature="${id}"`));
});

test('custom features move using the same shared override mechanism', async () => {
  const app = setup();
  app.run(`state.customFeatures = [{ ...data.features[0], id: 'custom-test' }]; state.selected = 'custom-test'`);
  await app.run('saveFeature()');
  assert.equal(app.requests[0].overrides['custom-test'].release, app.target);
  assert.ok(app.node('#roadmap').innerHTML.includes('data-feature="custom-test"'));
});

test('administrator-created releases are selectable and survive a card move', async () => {
  const app = setup();
  app.run(`state.overrides[RELEASE_SETTINGS_KEY] = { items: {
    'future-release': { id: 'future-release', date: '2027-01-15', version: 'Future',
      title: 'Future release', development: 'Future period', promise: 'Future outcome' }
  } }; applyReleaseSettings(); openFeature(state.selected)`);
  assert.ok(app.node('#statusSelect').insertedHTML.includes('value="future-release"'));
  app.node('#releaseSelect').value = 'future-release';
  await app.run('saveFeature()');
  assert.equal(app.run('state.release'), 'future-release');
  assert.ok(app.run("state.overrides[RELEASE_SETTINGS_KEY].items['future-release']"));
});

test('failed persistence does not move the card and allows retry', async () => {
  const app = setup({ failure: true });
  const original = app.run('state.release');
  await app.run('saveFeature()');
  assert.equal(app.run('state.release'), original);
  assert.equal(app.run('Object.keys(state.overrides).length'), 0);
  assert.equal(app.node('#saveFeature').disabled, false);
});

test('invalid releases and read-only access cannot save moves', async () => {
  const app = setup();
  app.node('#releaseSelect').value = 'missing-release';
  await app.run('saveFeature()');
  app.node('#releaseSelect').value = app.target;
  app.run('state.owner = false');
  await app.run('saveFeature()');
  app.run('state.owner = true; state.snapshot = true');
  await app.run('saveFeature()');
  assert.equal(app.requests.length, 0);
});
