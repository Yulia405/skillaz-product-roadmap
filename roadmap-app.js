const ROADMAP_API = 'https://skillaz-roadmap-api.skillaz-sales-bot.workers.dev';

const statuses = {
  done: { label: 'Готово', color: '#16846b' },
  acceptance: { label: 'Приемка', color: '#8b5da8' },
  in_progress: { label: 'В работе', color: '#3569c8' },
  planned: { label: 'Запланировано', color: '#7a858d' },
  risk: { label: 'Есть риск', color: '#c45b43' },
};

const data = window.ROADMAP_DATA;
const params = new URLSearchParams(location.search);
const state = {
  release: data.releases[0].id,
  editMode: false,
  selected: null,
  selectedPromo: null,
  selectedMethodology: null,
  snapshot: false,
  viewer: params.get('view') === '1',
  owner: false,
  sessionToken: '',
  overrides: {},
  promo: data.promo.map((item) => ({ ...item })),
  methodology: (data.methodology || []).map((item) => ({ ...item })),
  sharedUpdatedAt: null,
};

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[char]);
const formatDate = (value) => new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit', month: '2-digit', year: 'numeric',
}).format(new Date(value));
const currentFeature = (feature) => ({ ...feature, ...(state.overrides[feature.id] || {}) });
const laneById = (id) => data.lanes.find((item) => item.id === id);
const releaseById = (id) => data.releases.find((item) => item.id === id);

async function readState() {
  if (state.viewer) document.body.classList.add('view-mode');
  const hash = location.hash.startsWith('#snapshot=') ? location.hash.slice(10) : '';
  if (hash) {
    try {
      const snapshot = JSON.parse(decodeURIComponent(escape(atob(hash))));
      state.overrides = snapshot.overrides || snapshot;
      if (Array.isArray(snapshot.promo)) state.promo = snapshot.promo;
      if (Array.isArray(snapshot.methodology)) state.methodology = snapshot.methodology;
      state.snapshot = true;
      document.body.classList.add('snapshot-mode');
      $('#snapshotNote').classList.add('visible');
      return;
    } catch (error) {
      console.warn('Не удалось прочитать снимок', error);
    }
  }

  try {
    let response = await fetch(`${ROADMAP_API}/roadmap?v=${Date.now()}`, { cache: 'no-store' });
    if (response.status === 404) {
      response = await fetch(`roadmap-overrides.json?v=${Date.now()}`, { cache: 'no-store' });
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const shared = await response.json();
    state.overrides = shared.overrides || {};
    state.sharedUpdatedAt = shared.updatedAt || null;
    if (Array.isArray(shared.promo) && shared.promo.length) state.promo = shared.promo;
    if (Array.isArray(shared.methodology) && shared.methodology.length) state.methodology = shared.methodology;
  } catch (error) {
    console.warn('Общие обновления временно недоступны', error);
  }
}

function renderHeader() {
  const features = data.features.map(currentFeature);
  $('#projectTitle').textContent = data.project.title;
  $('#projectSubtitle').textContent = data.project.subtitle;
  $('#featureCount').textContent = features.length;
  $('#doneCount').textContent = features.filter((feature) => ['done', 'acceptance'].includes(feature.status)).length;
  $('#avgProgress').textContent = `${Math.round(features.reduce((sum, feature) => sum + Number(feature.progress || 0), 0) / features.length)}%`;
  const localLatest = Object.values(state.overrides).map((item) => item.updatedAt).filter(Boolean).sort().at(-1);
  $('#lastUpdated').textContent = formatDate(state.sharedUpdatedAt || localLatest || data.project.updatedAt).slice(0, 5);
  const today = new Date();
  const next = data.releases.find((release) => new Date(`${release.date}T23:59:59`) >= today) || data.releases.at(-1);
  $('#nextReleaseDate').textContent = next.shortDate;
  $('#nextReleaseLabel').textContent = next.title;
}

function renderFilters() {
  $('#filters').innerHTML = data.releases.map((release) => `<button class="filter ${state.release === release.id ? 'active' : ''}" data-release="${release.id}" aria-pressed="${state.release === release.id}">${escapeHtml(release.shortDate)}<small>${escapeHtml(release.version)}</small></button>`).join('');
  $('#filters').querySelectorAll('[data-release]').forEach((button) => button.addEventListener('click', () => selectRelease(button.dataset.release)));
  const index = data.releases.findIndex((release) => release.id === state.release);
  $('#prevRelease').disabled = index <= 0;
  $('#nextRelease').disabled = index >= data.releases.length - 1;
}

function selectRelease(id) {
  if (!releaseById(id)) return;
  state.release = id;
  renderFilters();
  renderRoadmap();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function shiftRelease(step) {
  const index = data.releases.findIndex((release) => release.id === state.release);
  const next = data.releases[index + step];
  if (next) selectRelease(next.id);
}

function featureCard(feature) {
  const current = currentFeature(feature);
  const lane = laneById(current.lane);
  const status = statuses[current.status] || statuses.planned;
  return `<button class="feature" data-feature="${current.id}" data-lane="${current.lane}" style="--lane:${lane.color};--status-color:${status.color};--progress-value:${Number(current.progress || 0)}%"><span class="feature-top"><span class="status">${status.label}</span><span class="feature-progress">${Number(current.progress || 0)}%</span></span><span class="feature-lane">${escapeHtml(lane.title)}</span><h3>${escapeHtml(current.title)}</h3><p>${escapeHtml(current.outcome)}</p><span class="progress-line"><i></i></span></button>`;
}

function renderRoadmap() {
  const release = releaseById(state.release);
  const index = data.releases.findIndex((item) => item.id === release.id);
  const features = data.features.filter((feature) => feature.release === release.id);
  $('#roadmap').innerHTML = `<section class="release-section" id="${release.id}"><header class="release-head"><div><div class="release-kicker"><span class="phase-number">${index + 1}</span>${escapeHtml(release.development)}</div><div class="release-date"><time datetime="${release.date}">${release.shortDate}</time><span>${escapeHtml(release.version)}</span></div></div><div class="release-copy"><h2>${escapeHtml(release.title)}</h2><p>${escapeHtml(release.promise)}</p></div></header><div class="feature-grid">${features.map(featureCard).join('')}</div></section>`;
  document.querySelectorAll('[data-feature]').forEach((button) => button.addEventListener('click', () => openFeature(button.dataset.feature)));
  refreshIcons();
}

function renderPromo() {
  $('#promoTimeline').innerHTML = state.promo.map((item, index) => `<article class="promo-event"><button class="promo-edit" data-promo-index="${index}" title="Редактировать активность" aria-label="Редактировать ${escapeHtml(item.title)}"><i data-lucide="pencil"></i></button><span class="promo-date">${escapeHtml(item.date)}</span>${item.time ? `<span class="promo-time">${escapeHtml(item.time)}</span>` : ''}<h3>${escapeHtml(item.title)}</h3><p class="promo-format">${escapeHtml(item.format)}</p><p class="promo-audience">${escapeHtml(item.audience)}</p></article>`).join('');
  document.querySelectorAll('[data-promo-index]').forEach((button) => button.addEventListener('click', () => openPromo(Number(button.dataset.promoIndex))));
  refreshIcons();
}

function renderMethodology() {
  $('#methodologyTimeline').innerHTML = state.methodology.map((item, index) => {
    const status = statuses[item.status] || statuses.planned;
    return `<article class="methodology-card" style="--status-color:${status.color}"><button class="promo-edit" data-methodology-index="${index}" title="Редактировать материал" aria-label="Редактировать ${escapeHtml(item.title)}"><i data-lucide="pencil"></i></button><div class="methodology-top"><span class="status">${status.label}</span>${item.date ? `<time>${escapeHtml(item.date)}</time>` : ''}</div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></article>`;
  }).join('');
  document.querySelectorAll('[data-methodology-index]').forEach((button) => button.addEventListener('click', () => openMethodology(Number(button.dataset.methodologyIndex))));
  refreshIcons();
}

function renderPlaceholders() {
  $('#placeholderList').innerHTML = data.placeholders.map((item) => `<div class="placeholder"><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></div><i data-lucide="plus"></i></div>`).join('');
}

function openFeature(id) {
  state.selected = id;
  state.selectedPromo = null;
  state.selectedMethodology = null;
  const feature = currentFeature(data.features.find((item) => item.id === id));
  const lane = laneById(feature.lane);
  const release = releaseById(feature.release);
  $('#drawerMeta').textContent = `${lane.title} · ${release.development} · релиз ${release.shortDate}`;
  $('#drawerTitle').textContent = feature.title;
  $('#drawerBody').innerHTML = `<p class="drawer-outcome">${escapeHtml(feature.outcome)}</p><section class="drawer-section"><h3>Что входит</h3><ul class="scope">${feature.scope.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section><section class="drawer-section"><h3>Ответственный поток</h3><p style="margin:0;color:#44515a;font-size:13px">${escapeHtml(feature.owner)}</p></section>${feature.note ? `<div class="note"><strong>Комментарий к статусу</strong><br>${escapeHtml(feature.note)}</div>` : ''}<section class="drawer-section"><h3>Первоисточники</h3><div class="source-links">${feature.sources.map((source) => `<a class="source-link" href="${source.url}" target="_blank" rel="noreferrer"><i data-lucide="external-link"></i>${escapeHtml(source.label)}</a>`).join('')}</div></section><section class="drawer-section edit-panel"><h3>Обновить состояние</h3><div class="edit-grid"><div class="field"><label for="statusSelect">Статус</label><select id="statusSelect">${Object.entries(statuses).map(([key, item]) => `<option value="${key}" ${feature.status === key ? 'selected' : ''}>${item.label}</option>`).join('')}</select></div><div class="field"><label for="progressInput">Готовность</label><div class="range-row"><input id="progressInput" type="range" min="0" max="100" step="1" value="${Number(feature.progress || 0)}"><output id="progressOutput">${Number(feature.progress || 0)}%</output></div></div><div class="field full"><label for="noteInput">Комментарий для стейкхолдера</label><textarea id="noteInput" placeholder="Например: срок подтвержден, идет приемка">${escapeHtml(feature.note || '')}</textarea></div><div class="field full"><button class="button primary" id="saveFeature"><i data-lucide="check"></i>Сохранить для всех</button></div></div></section>`;
  openDrawer();
  const range = $('#progressInput');
  if (range) range.addEventListener('input', () => { $('#progressOutput').textContent = `${range.value}%`; });
  $('#saveFeature')?.addEventListener('click', saveFeature);
  refreshIcons();
}

function openPromo(index) {
  if (!state.editMode) return;
  state.selected = null;
  state.selectedPromo = index;
  state.selectedMethodology = null;
  const item = state.promo[index];
  $('#drawerMeta').textContent = 'Промо и активности';
  $('#drawerTitle').textContent = item.title;
  $('#drawerBody').innerHTML = `<section class="edit-panel" style="display:block"><h3>Редактировать карточку</h3><div class="edit-grid"><div class="field"><label for="promoDate">Дата</label><input id="promoDate" value="${escapeHtml(item.date)}"></div><div class="field"><label for="promoTime">Время или уточнение</label><input id="promoTime" value="${escapeHtml(item.time || '')}"></div><div class="field full"><label for="promoTitle">Название</label><input id="promoTitle" value="${escapeHtml(item.title)}"></div><div class="field full"><label for="promoFormat">Формат</label><input id="promoFormat" value="${escapeHtml(item.format)}"></div><div class="field full"><label for="promoAudience">Для кого</label><textarea id="promoAudience">${escapeHtml(item.audience)}</textarea></div><div class="field full"><button class="button primary" id="savePromo"><i data-lucide="check"></i>Сохранить для всех</button></div></div></section>`;
  openDrawer();
  $('#savePromo').addEventListener('click', savePromo);
  refreshIcons();
}

function openMethodology(index) {
  if (!state.editMode) return;
  state.selected = null;
  state.selectedPromo = null;
  state.selectedMethodology = index;
  const item = state.methodology[index];
  $('#drawerMeta').textContent = 'Методика и наполнение';
  $('#drawerTitle').textContent = item.title;
  $('#drawerBody').innerHTML = `<section class="edit-panel" style="display:block"><h3>Редактировать карточку</h3><div class="edit-grid"><div class="field"><label for="methodologyDate">Срок</label><input id="methodologyDate" value="${escapeHtml(item.date || '')}"></div><div class="field"><label for="methodologyStatus">Статус</label><select id="methodologyStatus">${Object.entries(statuses).map(([key, status]) => `<option value="${key}" ${item.status === key ? 'selected' : ''}>${status.label}</option>`).join('')}</select></div><div class="field full"><label for="methodologyTitle">Название</label><input id="methodologyTitle" value="${escapeHtml(item.title)}"></div><div class="field full"><label for="methodologyText">Описание</label><textarea id="methodologyText">${escapeHtml(item.text)}</textarea></div><div class="field full"><button class="button primary" id="saveMethodology"><i data-lucide="check"></i>Сохранить для всех</button></div></div></section>`;
  openDrawer();
  $('#saveMethodology').addEventListener('click', saveMethodology);
  refreshIcons();
}

function openDrawer() {
  $('#drawerShell').classList.add('open');
  $('#drawerShell').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  $('#drawerShell').classList.remove('open');
  $('#drawerShell').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  state.selected = null;
  state.selectedPromo = null;
  state.selectedMethodology = null;
}

async function persistShared(nextOverrides, nextPromo, nextMethodology) {
  if (!state.owner || !state.sessionToken) throw new Error('Сначала войдите в режим администрирования');
  const payload = {
    overrides: nextOverrides,
    promo: nextPromo,
    methodology: nextMethodology,
  };
  const response = await fetch(`${ROADMAP_API}/roadmap`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${state.sessionToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 401) {
      state.owner = false;
      state.sessionToken = '';
      setEditMode(false);
    }
    throw new Error(error.error || `Не удалось сохранить: HTTP ${response.status}`);
  }
  const saved = await response.json();
  state.overrides = nextOverrides;
  state.promo = nextPromo;
  state.methodology = nextMethodology;
  state.sharedUpdatedAt = saved.updatedAt;
}

async function saveFeature() {
  if (!state.owner || !state.selected || state.snapshot) return;
  const button = $('#saveFeature');
  button.disabled = true;
  const next = {
    ...state.overrides,
    [state.selected]: {
      status: $('#statusSelect').value,
      progress: Number($('#progressInput').value),
      note: $('#noteInput').value.trim(),
      updatedAt: new Date().toISOString(),
    },
  };
  try {
    await persistShared(next, state.promo, state.methodology);
    renderHeader();
    renderRoadmap();
    openFeature(state.selected);
    toast('Обновление сохранено для всех');
  } catch (error) {
    toast(error.message);
    button.disabled = false;
  }
}

async function savePromo() {
  if (!state.owner || state.selectedPromo === null || state.snapshot) return;
  const button = $('#savePromo');
  button.disabled = true;
  const next = state.promo.map((item, index) => index === state.selectedPromo ? {
    date: $('#promoDate').value.trim(),
    time: $('#promoTime').value.trim(),
    title: $('#promoTitle').value.trim(),
    format: $('#promoFormat').value.trim(),
    audience: $('#promoAudience').value.trim(),
  } : item);
  try {
    await persistShared(state.overrides, next, state.methodology);
    renderHeader();
    renderPromo();
    closeDrawer();
    toast('Промо обновлено для всех');
  } catch (error) {
    toast(error.message);
    button.disabled = false;
  }
}

async function saveMethodology() {
  if (!state.owner || state.selectedMethodology === null || state.snapshot) return;
  const button = $('#saveMethodology');
  button.disabled = true;
  const next = state.methodology.map((item, index) => index === state.selectedMethodology ? {
    date: $('#methodologyDate').value.trim(),
    status: $('#methodologyStatus').value,
    title: $('#methodologyTitle').value.trim(),
    text: $('#methodologyText').value.trim(),
  } : item);
  try {
    await persistShared(state.overrides, state.promo, next);
    renderHeader();
    renderMethodology();
    closeDrawer();
    toast('Методический материал обновлён для всех');
  } catch (error) {
    toast(error.message);
    button.disabled = false;
  }
}

function setEditMode(enabled) {
  state.editMode = enabled;
  document.body.classList.toggle('edit-mode', enabled);
  $('#editBtn').classList.toggle('active', enabled);
  $('#editBtn').innerHTML = enabled
    ? '<i data-lucide="lock-open"></i><span class="icon-fallback" aria-hidden="true">✓</span><span class="edit-label">Редактирование включено</span>'
    : '<i data-lucide="square-pen"></i><span class="icon-fallback" aria-hidden="true">✎</span><span class="edit-label">Администрирование</span>';
  if (state.selected) openFeature(state.selected);
  renderPromo();
  renderMethodology();
  refreshIcons();
}

function toggleEdit() {
  if (state.snapshot || state.viewer) return;
  if (!state.owner) {
    openAuth();
    return;
  }
  setEditMode(!state.editMode);
}

function openShare() {
  if (state.snapshot || state.viewer) return;
  $('#shareShell').classList.add('open');
  $('#shareShell').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  refreshIcons();
}

function closeShare() {
  $('#shareShell').classList.remove('open');
  $('#shareShell').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

async function copyLink(url, message) {
  try {
    await navigator.clipboard.writeText(url);
    closeShare();
    toast(message);
  } catch {
    prompt('Скопируйте ссылку на план', url);
  }
}

function shareLive() {
  copyLink(`${location.origin}${location.pathname}?view=1`, 'Ссылка на актуальный план скопирована');
}

function shareSnapshot() {
  const capturedAt = new Date().toISOString();
  const overrides = Object.fromEntries(data.features.map((feature) => {
    const current = currentFeature(feature);
    return [current.id, {
      status: current.status,
      progress: Number(current.progress || 0),
      note: current.note || '',
      updatedAt: capturedAt,
    }];
  }));
  const snapshot = { overrides, promo: state.promo, methodology: state.methodology };
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(snapshot))));
  copyLink(`${location.origin}${location.pathname}?view=1#snapshot=${encoded}`, 'Ссылка на снимок плана скопирована');
}

function openAuth() {
  $('#authShell').classList.add('open');
  $('#authShell').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('#accessPassword').focus(), 0);
  refreshIcons();
}

function closeAuth() {
  $('#authShell').classList.remove('open');
  $('#authShell').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

async function connectAdmin() {
  const password = $('#accessPassword').value;
  const button = $('#connectAdmin');
  if (!password) {
    toast('Введите пароль доступа');
    return;
  }
  button.disabled = true;
  try {
    const response = await fetch(`${ROADMAP_API}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Не удалось войти');
    state.sessionToken = result.token;
    state.owner = true;
    $('#accessPassword').value = '';
    closeAuth();
    setEditMode(true);
    toast('Администрирование включено');
  } catch (error) {
    state.sessionToken = '';
    toast(error.message);
  } finally {
    button.disabled = false;
  }
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 3000);
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
    document.documentElement.classList.add('icons-ready');
  }
}

async function init() {
  await readState();
  renderHeader();
  renderFilters();
  renderRoadmap();
  renderPromo();
  renderMethodology();
  renderPlaceholders();
  refreshIcons();
}

$('#editBtn').addEventListener('click', toggleEdit);
$('#shareBtn').addEventListener('click', openShare);
$('#shareLive').addEventListener('click', shareLive);
$('#shareSnapshot').addEventListener('click', shareSnapshot);
$('#closeShare').addEventListener('click', closeShare);
$('#shareBackdrop').addEventListener('click', closeShare);
$('#closeAuth').addEventListener('click', closeAuth);
$('#authBackdrop').addEventListener('click', closeAuth);
$('#connectAdmin').addEventListener('click', connectAdmin);
$('#accessPassword').addEventListener('keydown', (event) => { if (event.key === 'Enter') connectAdmin(); });
$('#prevRelease').addEventListener('click', () => shiftRelease(-1));
$('#nextRelease').addEventListener('click', () => shiftRelease(1));
$('#closeDrawer').addEventListener('click', closeDrawer);
$('#backdrop').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if ($('#authShell').classList.contains('open')) closeAuth();
    else if ($('#shareShell').classList.contains('open')) closeShare();
    else closeDrawer();
  }
  const overlaysOpen = $('#drawerShell').classList.contains('open') || $('#shareShell').classList.contains('open') || $('#authShell').classList.contains('open');
  if (event.key === 'ArrowLeft' && !overlaysOpen) shiftRelease(-1);
  if (event.key === 'ArrowRight' && !overlaysOpen) shiftRelease(1);
});

init();
