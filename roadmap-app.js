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
  selectedDiscovery: null,
  snapshot: false,
  viewer: params.get('view') === '1',
  owner: false,
  sessionToken: '',
  overrides: {},
  promo: data.promo.map((item) => ({ ...item })),
  methodology: (data.methodology || []).map((item) => ({ ...item })),
  discovery: (data.discovery || []).map((item) => ({ ...item })),
  customFeatures: [],
  sharedUpdatedAt: null,
};

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[char]);
const discoveryTimeline = (timeline = []) => timeline.length
  ? `<ol class="discovery-timeline">${timeline.map((item) => `<li><span>${escapeHtml(item.stage)}</span><time>${escapeHtml(item.date)}</time></li>`).join('')}</ol>`
  : '';
const formatDate = (value) => new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit', month: '2-digit', year: 'numeric',
}).format(new Date(value));
const externalUrl = (value) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
};
const sourcesToText = (sources = []) => sources.map((source) => `${source.label} | ${source.url}`).join('\n');
const textToSources = (value) => {
  const sources = [];
  for (const line of value.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const separator = line.indexOf('|');
    const label = separator >= 0 ? line.slice(0, separator).trim() : 'Артефакт';
    const rawUrl = separator >= 0 ? line.slice(separator + 1).trim() : line;
    const url = externalUrl(rawUrl);
    if (!url) return { error: `Проверьте ссылку: ${rawUrl}` };
    sources.push({ label: label || 'Артефакт', url });
  }
  return { sources };
};
const timelineToText = (timeline = []) => timeline.map((item) => `${item.stage} | ${item.date}`).join('\n');
const textToTimeline = (value) => {
  const timeline = [];
  for (const line of value.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const separator = line.indexOf('|');
    if (separator < 0) return { error: `Добавьте срок через «|»: ${line}` };
    const stage = line.slice(0, separator).trim();
    const date = line.slice(separator + 1).trim();
    if (!stage || !date) return { error: `Заполните этап и срок: ${line}` };
    timeline.push({ stage, date });
  }
  return { timeline };
};
const safeImageSource = (value) => {
  const source = value.trim();
  if (!source) return '';
  const remote = externalUrl(source);
  if (remote) return remote;
  return /^(?:assets|q4-2026\/assets)\/[A-Za-z0-9._/-]+$/.test(source) ? source : '';
};
const allFeatures = () => [...data.features, ...state.customFeatures];
const featureById = (id) => allFeatures().find((item) => item.id === id);
const uniqueId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const requiredFields = (fields) => {
  let firstInvalid = null;
  const values = {};
  fields.forEach(({ id, label }) => {
    const element = $(`#${id}`);
    const value = element?.value.trim() || '';
    values[id] = value;
    element?.setAttribute('aria-invalid', value ? 'false' : 'true');
    if (!value && !firstInvalid) firstInvalid = { element, label };
  });
  if (firstInvalid) {
    firstInvalid.element?.focus();
    toast(`Заполните поле «${firstInvalid.label}»`);
    return null;
  }
  return values;
};
const currentFeature = (feature) => ({ ...feature, ...(state.overrides[feature.id] || {}) });
const laneById = (id) => data.lanes.find((item) => item.id === id);
const releaseById = (id) => data.releases.find((item) => item.id === id);
const withDiscoveryDefaults = (item) => {
  const legacyIds = { 'Оценочные полевые листы': 'field-assessment-sheets' };
  const fallback = (data.discovery || []).find((candidate) => candidate.id === item.id || candidate.id === legacyIds[item.title] || candidate.title === item.title);
  return fallback ? { ...fallback, ...item, timeline: item.timeline?.length ? item.timeline : (fallback.timeline || []) } : item;
};

async function readState() {
  if (state.viewer) document.body.classList.add('view-mode');
  const hash = location.hash.startsWith('#snapshot=') ? location.hash.slice(10) : '';
  if (hash) {
    try {
      const snapshot = JSON.parse(decodeURIComponent(escape(atob(hash))));
      state.overrides = snapshot.overrides || snapshot;
      if (Array.isArray(snapshot.promo)) state.promo = snapshot.promo;
      if (Array.isArray(snapshot.methodology)) state.methodology = snapshot.methodology;
      if (Array.isArray(snapshot.discovery)) state.discovery = snapshot.discovery.map(withDiscoveryDefaults);
      if (Array.isArray(snapshot.customFeatures)) state.customFeatures = snapshot.customFeatures;
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
    if (Array.isArray(shared.customFeatures)) state.customFeatures = shared.customFeatures;
    if (Array.isArray(shared.discovery)) {
      const sharedDiscovery = (shared.discovery.length ? shared.discovery : state.discovery).map(withDiscoveryDefaults);
      const pinned = (data.discovery || []).filter((item) => item.pinned);
      const pinnedIds = new Set(pinned.map((item) => item.id));
      const pinnedTitles = new Set([
        ...pinned.map((item) => item.title),
        'Автоматизация назначения ролей',
        'Офлайн-прохождение обучения',
      ]);
      state.discovery = [
        ...sharedDiscovery.filter((item) => !pinnedIds.has(item.id) && !pinnedTitles.has(item.title)),
        ...pinned,
      ];
    }
  } catch (error) {
    console.warn('Общие обновления временно недоступны', error);
  }
}

function renderHeader() {
  const features = allFeatures().map(currentFeature);
  const estimatedFeatures = features.filter((feature) => !feature.unestimated);
  $('#projectTitle').textContent = data.project.title;
  $('#projectSubtitle').textContent = data.project.subtitle;
  $('#featureCount').textContent = features.length;
  $('#doneCount').textContent = features.filter((feature) => ['done', 'acceptance'].includes(feature.status)).length;
  const averageProgress = estimatedFeatures.length
    ? Math.round(estimatedFeatures.reduce((sum, feature) => sum + Number(feature.progress || 0), 0) / estimatedFeatures.length)
    : 0;
  $('#avgProgress').textContent = `${averageProgress}%`;
  const localLatest = Object.values(state.overrides).map((item) => item.updatedAt).filter(Boolean).sort().at(-1);
  const latestUpdate = [state.sharedUpdatedAt, localLatest, data.project.updatedAt]
    .filter(Boolean)
    .sort((left, right) => new Date(left) - new Date(right))
    .at(-1);
  $('#lastUpdated').textContent = formatDate(latestUpdate).slice(0, 5);
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
  const progress = current.unestimated ? 'Без оценки' : `${Number(current.progress || 0)}%`;
  return `<button class="feature" data-feature="${current.id}" data-lane="${current.lane}" style="--lane:${lane.color};--status-color:${status.color};--progress-value:${Number(current.progress || 0)}%"><span class="feature-top"><span class="status">${status.label}</span><span class="feature-progress">${progress}</span></span><span class="feature-lane">${escapeHtml(lane.title)}</span><h3>${escapeHtml(current.title)}</h3><p>${escapeHtml(current.outcome)}</p>${current.unestimated ? '' : '<span class="progress-line"><i></i></span>'}</button>`;
}

function renderRoadmap() {
  const release = releaseById(state.release);
  const index = data.releases.findIndex((item) => item.id === release.id);
  const features = allFeatures().filter((feature) => feature.release === release.id);
  $('#roadmap').innerHTML = `<section class="release-section" id="${release.id}"><header class="release-head"><div><div class="release-kicker"><span class="phase-number">${index + 1}</span>${escapeHtml(release.development)}</div><div class="release-date"><time datetime="${release.date}">${release.shortDate}</time><span>${escapeHtml(release.version)}</span></div></div><div class="release-copy"><h2>${escapeHtml(release.title)}</h2><p>${escapeHtml(release.promise)}</p><button class="button admin-only release-admin-action" data-add-feature="${release.id}"><i data-lucide="plus"></i>Добавить карточку</button></div></header><div class="feature-grid">${features.length ? features.map(featureCard).join('') : '<div class="empty-release">В этой поставке пока нет карточек.</div>'}</div></section>`;
  document.querySelectorAll('[data-feature]').forEach((button) => button.addEventListener('click', () => openFeature(button.dataset.feature)));
  document.querySelectorAll('[data-add-feature]').forEach((button) => button.addEventListener('click', () => openNewFeature(button.dataset.addFeature)));
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

function renderDiscovery() {
  const container = $('#discoveryGrid');
  if (!state.discovery.length) {
    container.innerHTML = '<div class="discovery-empty">Активности дискавери пока не добавлены.</div>';
    return;
  }
  container.innerHTML = state.discovery.map((item, index) => {
    const status = statuses[item.status] || statuses.planned;
    return `<button class="discovery-card" data-discovery-index="${index}" style="--status-color:${status.color};--progress-value:${Number(item.progress || 0)}%"><span class="feature-top"><span class="status">${status.label}</span><span class="feature-progress">${Number(item.progress || 0)}%</span></span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.outcome || '')}</p>${discoveryTimeline(item.timeline)}<span class="discovery-meta">${escapeHtml(item.owner || 'Ответственный не указан')}</span><span class="progress-line"><i></i></span></button>`;
  }).join('');
  document.querySelectorAll('[data-discovery-index]').forEach((button) => button.addEventListener('click', () => openDiscovery(Number(button.dataset.discoveryIndex))));
  refreshIcons();
}

function renderPlaceholders() {
  $('#placeholderList').innerHTML = data.placeholders.map((item) => `<div class="placeholder"><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></div><i data-lucide="plus"></i></div>`).join('');
}

function openNewFeature(releaseId = state.release) {
  if (!state.editMode) return;
  const release = releaseById(releaseId);
  if (!release) return;
  state.selected = null;
  state.selectedPromo = null;
  state.selectedMethodology = null;
  state.selectedDiscovery = null;
  $('#drawerMeta').textContent = `${release.development} · релиз ${release.shortDate}`;
  $('#drawerTitle').textContent = 'Новая карточка поставки';
  $('#drawerBody').innerHTML = `<section class="edit-panel create-panel"><h3>Карточка релиза</h3><div class="edit-grid"><div class="field"><label for="featureRelease">Поставка <span class="required-mark">*</span></label><select id="featureRelease" required>${data.releases.map((item) => `<option value="${item.id}" ${item.id === release.id ? 'selected' : ''}>${escapeHtml(item.shortDate)} · ${escapeHtml(item.version)}</option>`).join('')}</select></div><div class="field"><label for="featureLane">Направление <span class="required-mark">*</span></label><select id="featureLane" required>${data.lanes.map((item) => `<option value="${item.id}">${escapeHtml(item.title)}</option>`).join('')}</select></div><div class="field full"><label for="featureTitle">Название <span class="required-mark">*</span></label><input id="featureTitle" required placeholder="Короткое название изменения"></div><div class="field full"><label for="featureOutcome">Что изменится для пользователя <span class="required-mark">*</span></label><textarea id="featureOutcome" required placeholder="Один понятный бизнес-результат"></textarea></div><div class="field full"><label for="featureScope">Что входит <span class="required-mark">*</span></label><textarea id="featureScope" required placeholder="Каждый пункт с новой строки"></textarea></div><div class="field"><label for="featureOwner">Ответственный поток <span class="required-mark">*</span></label><input id="featureOwner" required placeholder="Команда или владелец"></div><div class="field"><label for="featureStatus">Статус <span class="required-mark">*</span></label><select id="featureStatus" required>${Object.entries(statuses).map(([key, status]) => `<option value="${key}" ${key === 'planned' ? 'selected' : ''}>${status.label}</option>`).join('')}</select></div><div class="field full"><label for="featureProgress">Готовность</label><div class="range-row"><input id="featureProgress" type="range" min="0" max="100" step="1" value="0"><output id="featureProgressOutput">0%</output></div><label class="check-row" for="featureUnestimated"><input id="featureUnestimated" type="checkbox">Без оценки, не учитывать в средней готовности</label></div><div class="field full"><label for="featureNote">Комментарий к статусу</label><textarea id="featureNote" placeholder="Риск, зависимость или пояснение к готовности"></textarea></div><div class="field full"><label for="featureSources">Первоисточники</label><textarea id="featureSources" placeholder="Название | https://ссылка — каждый источник с новой строки"></textarea></div><div class="field full"><label for="featureImage">Изображение</label><input id="featureImage" placeholder="https://... или assets/image.jpg"></div><div class="field full"><button class="button primary" id="createFeature"><i data-lucide="check"></i>Добавить в поставку</button></div></div></section>`;
  openDrawer();
  const range = $('#featureProgress');
  range.addEventListener('input', () => { $('#featureProgressOutput').textContent = `${range.value}%`; });
  $('#featureUnestimated').addEventListener('change', (event) => {
    range.disabled = event.target.checked;
    $('#featureProgressOutput').textContent = event.target.checked ? '—' : `${range.value}%`;
  });
  $('#createFeature').addEventListener('click', saveNewFeature);
  refreshIcons();
}

function openFeature(id) {
  state.selected = id;
  state.selectedPromo = null;
  state.selectedMethodology = null;
  state.selectedDiscovery = null;
  const baseFeature = featureById(id);
  if (!baseFeature) return;
  const feature = currentFeature(baseFeature);
  const lane = laneById(feature.lane);
  const release = releaseById(feature.release);
  $('#drawerMeta').textContent = `${lane.title} · ${release.development} · релиз ${release.shortDate}`;
  $('#drawerTitle').textContent = feature.title;
  const image = feature.image ? `<figure class="feature-visual"><img src="${escapeHtml(feature.image)}" alt="Макет: ${escapeHtml(feature.title)}"></figure>` : '';
  const featureSources = feature.sources || [];
  const sources = featureSources.length ? `<section class="drawer-section"><h3>Первоисточники</h3><div class="source-links">${featureSources.map((source) => `<a class="source-link" href="${escapeHtml(externalUrl(source.url))}" target="_blank" rel="noreferrer"><i data-lucide="external-link"></i>${escapeHtml(source.label)}</a>`).join('')}</div></section>` : '';
  $('#drawerBody').innerHTML = `<p class="drawer-outcome">${escapeHtml(feature.outcome)}</p>${image}<section class="drawer-section"><h3>Что входит</h3><ul class="scope">${(feature.scope || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section><section class="drawer-section"><h3>Ответственный поток</h3><p style="margin:0;color:#44515a;font-size:13px">${escapeHtml(feature.owner)}</p></section>${feature.note ? `<div class="note"><strong>Комментарий к статусу</strong><br>${escapeHtml(feature.note)}</div>` : ''}${sources}<section class="drawer-section edit-panel"><h3>Обновить состояние</h3><div class="edit-grid"><div class="field"><label for="statusSelect">Статус</label><select id="statusSelect">${Object.entries(statuses).map(([key, item]) => `<option value="${key}" ${feature.status === key ? 'selected' : ''}>${item.label}</option>`).join('')}</select></div>${feature.unestimated ? '' : `<div class="field"><label for="progressInput">Готовность</label><div class="range-row"><input id="progressInput" type="range" min="0" max="100" step="1" value="${Number(feature.progress || 0)}"><output id="progressOutput">${Number(feature.progress || 0)}%</output></div></div>`}<div class="field full"><label for="noteInput">Комментарий для стейкхолдера</label><textarea id="noteInput" placeholder="Например: срок подтвержден, идет приемка">${escapeHtml(feature.note || '')}</textarea></div><div class="field full"><button class="button primary" id="saveFeature"><i data-lucide="check"></i>Сохранить для всех</button></div></div></section>`;
  openDrawer();
  const range = $('#progressInput');
  if (range) range.addEventListener('input', () => { $('#progressOutput').textContent = `${range.value}%`; });
  $('#saveFeature')?.addEventListener('click', saveFeature);
  refreshIcons();
}

function openPromo(index = -1) {
  if (!state.editMode) return;
  const isNew = index < 0;
  state.selected = null;
  state.selectedPromo = index;
  state.selectedMethodology = null;
  state.selectedDiscovery = null;
  const item = isNew ? { date: '', time: '', title: '', format: '', audience: '' } : state.promo[index];
  $('#drawerMeta').textContent = 'Промо и активности';
  $('#drawerTitle').textContent = isNew ? 'Новая промо-активность' : item.title;
  $('#drawerBody').innerHTML = `<section class="edit-panel create-panel"><h3>${isNew ? 'Карточка промо' : 'Редактировать карточку'}</h3><div class="edit-grid"><div class="field"><label for="promoDate">Дата <span class="required-mark">*</span></label><input id="promoDate" required value="${escapeHtml(item.date)}" placeholder="19 ноября 2026"></div><div class="field"><label for="promoTime">Время или уточнение</label><input id="promoTime" value="${escapeHtml(item.time || '')}" placeholder="11:00-13:00"></div><div class="field full"><label for="promoTitle">Название <span class="required-mark">*</span></label><input id="promoTitle" required value="${escapeHtml(item.title)}"></div><div class="field full"><label for="promoFormat">Формат <span class="required-mark">*</span></label><input id="promoFormat" required value="${escapeHtml(item.format)}" placeholder="Вебинар, курс, демо-день"></div><div class="field full"><label for="promoAudience">Для кого <span class="required-mark">*</span></label><textarea id="promoAudience" required>${escapeHtml(item.audience)}</textarea></div><div class="field full"><button class="button primary" id="savePromo"><i data-lucide="check"></i>${isNew ? 'Добавить активность' : 'Сохранить для всех'}</button></div></div></section>`;
  openDrawer();
  $('#savePromo').addEventListener('click', savePromo);
  refreshIcons();
}

function openMethodology(index = -1) {
  if (!state.editMode) return;
  const isNew = index < 0;
  state.selected = null;
  state.selectedPromo = null;
  state.selectedMethodology = index;
  state.selectedDiscovery = null;
  const item = isNew ? { date: '', status: 'planned', title: '', text: '' } : state.methodology[index];
  $('#drawerMeta').textContent = 'Методика и наполнение';
  $('#drawerTitle').textContent = isNew ? 'Новый методический материал' : item.title;
  $('#drawerBody').innerHTML = `<section class="edit-panel create-panel"><h3>${isNew ? 'Карточка методики' : 'Редактировать карточку'}</h3><div class="edit-grid"><div class="field"><label for="methodologyDate">Срок</label><input id="methodologyDate" value="${escapeHtml(item.date || '')}" placeholder="До 16 октября 2026"></div><div class="field"><label for="methodologyStatus">Статус <span class="required-mark">*</span></label><select id="methodologyStatus" required>${Object.entries(statuses).map(([key, status]) => `<option value="${key}" ${item.status === key ? 'selected' : ''}>${status.label}</option>`).join('')}</select></div><div class="field full"><label for="methodologyTitle">Название <span class="required-mark">*</span></label><input id="methodologyTitle" required value="${escapeHtml(item.title)}"></div><div class="field full"><label for="methodologyText">Описание <span class="required-mark">*</span></label><textarea id="methodologyText" required>${escapeHtml(item.text)}</textarea></div><div class="field full"><button class="button primary" id="saveMethodology"><i data-lucide="check"></i>${isNew ? 'Добавить материал' : 'Сохранить для всех'}</button></div></div></section>`;
  openDrawer();
  $('#saveMethodology').addEventListener('click', saveMethodology);
  refreshIcons();
}

function openDiscovery(index = -1) {
  const isNew = index < 0;
  if (isNew && !state.editMode) return;
  state.selected = null;
  state.selectedPromo = null;
  state.selectedMethodology = null;
  state.selectedDiscovery = index;
  const item = isNew ? {
    title: '', outcome: '', scope: [], owner: '', status: 'planned', progress: 0, sources: [], timeline: [],
  } : state.discovery[index];
  const sourceLinks = (item.sources || []).map((source) => {
    const url = externalUrl(source.url);
    return url ? `<a class="source-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer"><i data-lucide="external-link"></i>${escapeHtml(source.label)}</a>` : '';
  }).join('');
  $('#drawerMeta').textContent = 'Дискавери';
  $('#drawerTitle').textContent = isNew ? 'Новая карточка discovery' : item.title;
  $('#drawerBody').innerHTML = `${isNew ? '' : `<p class="drawer-outcome">${escapeHtml(item.outcome || '')}</p>${item.timeline?.length ? `<section class="drawer-section"><h3>Таймлайн discovery и проектирования</h3>${discoveryTimeline(item.timeline)}</section>` : ''}<section class="drawer-section"><h3>Что входит</h3><ul class="scope">${(item.scope || []).map((scopeItem) => `<li>${escapeHtml(scopeItem)}</li>`).join('')}</ul></section><section class="drawer-section"><h3>Ответственный</h3><p class="drawer-plain">${escapeHtml(item.owner || 'Не указан')}</p></section><section class="drawer-section"><h3>Источники и артефакты</h3><div class="source-links">${sourceLinks || '<span class="drawer-muted">Ссылки пока не добавлены</span>'}</div></section>`}<section class="edit-panel ${isNew ? 'create-panel' : ''}"><h3>${isNew ? 'Карточка discovery' : 'Редактировать карточку'}</h3><div class="edit-grid"><div class="field full"><label for="discoveryTitle">Название <span class="required-mark">*</span></label><input id="discoveryTitle" required value="${escapeHtml(item.title)}" placeholder="Название фичи или исследования"></div><div class="field full"><label for="discoveryOutcome">Результат / что исследуем <span class="required-mark">*</span></label><textarea id="discoveryOutcome" required placeholder="Какой вопрос проверяем и какой результат ожидаем">${escapeHtml(item.outcome || '')}</textarea></div><div class="field full"><label for="discoveryScope">Что входит <span class="required-mark">*</span></label><textarea id="discoveryScope" required placeholder="Каждый пункт с новой строки">${escapeHtml((item.scope || []).join('\n'))}</textarea></div><div class="field"><label for="discoveryOwner">Ответственный <span class="required-mark">*</span></label><input id="discoveryOwner" required value="${escapeHtml(item.owner || '')}"></div><div class="field"><label for="discoveryStatus">Статус <span class="required-mark">*</span></label><select id="discoveryStatus" required>${Object.entries(statuses).map(([key, status]) => `<option value="${key}" ${item.status === key ? 'selected' : ''}>${status.label}</option>`).join('')}</select></div><div class="field full"><label for="discoveryProgress">Прогресс</label><div class="range-row"><input id="discoveryProgress" type="range" min="0" max="100" step="1" value="${Number(item.progress || 0)}"><output id="discoveryProgressOutput">${Number(item.progress || 0)}%</output></div></div><div class="field full"><label for="discoveryTimeline">Таймлайн</label><textarea id="discoveryTimeline" placeholder="Этап | до 20.11.2026 — каждый этап с новой строки">${escapeHtml(timelineToText(item.timeline))}</textarea></div><div class="field full"><label for="discoverySources">Источники и артефакты</label><textarea id="discoverySources" placeholder="Название | https://ссылка — каждый источник с новой строки">${escapeHtml(sourcesToText(item.sources))}</textarea></div><div class="field full discovery-actions"><button class="button primary" id="saveDiscovery"><i data-lucide="check"></i>Сохранить для всех</button>${isNew ? '' : '<button class="button danger" id="deleteDiscovery"><i data-lucide="trash-2"></i>Удалить карточку</button>'}</div></div></section>`;
  openDrawer();
  const range = $('#discoveryProgress');
  range?.addEventListener('input', () => { $('#discoveryProgressOutput').textContent = `${range.value}%`; });
  $('#saveDiscovery')?.addEventListener('click', saveDiscovery);
  $('#deleteDiscovery')?.addEventListener('click', deleteDiscovery);
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
  state.selectedDiscovery = null;
}

async function persistShared(nextOverrides, nextPromo, nextMethodology, nextDiscovery, nextCustomFeatures = state.customFeatures) {
  if (!state.owner || !state.sessionToken) throw new Error('Сначала войдите в режим администрирования');
  const payload = {
    overrides: nextOverrides,
    promo: nextPromo,
    methodology: nextMethodology,
    discovery: nextDiscovery,
    customFeatures: nextCustomFeatures,
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
  state.discovery = nextDiscovery;
  state.customFeatures = nextCustomFeatures;
  state.sharedUpdatedAt = saved.updatedAt;
}

async function saveNewFeature() {
  if (!state.owner || state.snapshot) return;
  const values = requiredFields([
    { id: 'featureTitle', label: 'Название' },
    { id: 'featureOutcome', label: 'Что изменится для пользователя' },
    { id: 'featureScope', label: 'Что входит' },
    { id: 'featureOwner', label: 'Ответственный поток' },
  ]);
  if (!values) return;
  const parsedSources = textToSources($('#featureSources').value);
  if (parsedSources.error) {
    toast(parsedSources.error);
    return;
  }
  const imageValue = $('#featureImage').value;
  const image = safeImageSource(imageValue);
  if (imageValue.trim() && !image) {
    $('#featureImage').setAttribute('aria-invalid', 'true');
    $('#featureImage').focus();
    toast('Проверьте ссылку или путь к изображению');
    return;
  }
  const unestimated = $('#featureUnestimated').checked;
  const feature = {
    id: uniqueId('feature'),
    release: $('#featureRelease').value,
    lane: $('#featureLane').value,
    title: values.featureTitle,
    outcome: values.featureOutcome,
    scope: values.featureScope.split('\n').map((item) => item.trim()).filter(Boolean),
    owner: values.featureOwner,
    status: $('#featureStatus').value,
    progress: unestimated ? 0 : Number($('#featureProgress').value),
    unestimated,
    note: $('#featureNote').value.trim(),
    sources: parsedSources.sources,
    ...(image ? { image } : {}),
  };
  const button = $('#createFeature');
  button.disabled = true;
  const next = [...state.customFeatures, feature];
  try {
    await persistShared(state.overrides, state.promo, state.methodology, state.discovery, next);
    state.release = feature.release;
    renderHeader();
    renderFilters();
    renderRoadmap();
    closeDrawer();
    toast('Карточка добавлена в поставку');
  } catch (error) {
    toast(error.message);
    button.disabled = false;
  }
}

async function saveFeature() {
  if (!state.owner || !state.selected || state.snapshot) return;
  const button = $('#saveFeature');
  const feature = currentFeature(featureById(state.selected));
  const progressInput = $('#progressInput');
  button.disabled = true;
  const next = {
    ...state.overrides,
    [state.selected]: {
      status: $('#statusSelect').value,
      progress: progressInput ? Number(progressInput.value) : Number(feature.progress || 0),
      note: $('#noteInput').value.trim(),
      updatedAt: new Date().toISOString(),
    },
  };
  try {
    await persistShared(next, state.promo, state.methodology, state.discovery);
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
  const isNew = state.selectedPromo < 0;
  const values = requiredFields([
    { id: 'promoDate', label: 'Дата' },
    { id: 'promoTitle', label: 'Название' },
    { id: 'promoFormat', label: 'Формат' },
    { id: 'promoAudience', label: 'Для кого' },
  ]);
  if (!values) return;
  const button = $('#savePromo');
  button.disabled = true;
  const item = {
    date: values.promoDate,
    time: $('#promoTime').value.trim(),
    title: values.promoTitle,
    format: values.promoFormat,
    audience: values.promoAudience,
  };
  const next = isNew
    ? [...state.promo, item]
    : state.promo.map((current, index) => index === state.selectedPromo ? item : current);
  try {
    await persistShared(state.overrides, next, state.methodology, state.discovery);
    renderHeader();
    renderPromo();
    closeDrawer();
    toast(isNew ? 'Промо-активность добавлена' : 'Промо обновлено для всех');
  } catch (error) {
    toast(error.message);
    button.disabled = false;
  }
}

async function saveMethodology() {
  if (!state.owner || state.selectedMethodology === null || state.snapshot) return;
  const isNew = state.selectedMethodology < 0;
  const values = requiredFields([
    { id: 'methodologyTitle', label: 'Название' },
    { id: 'methodologyText', label: 'Описание' },
  ]);
  if (!values) return;
  const button = $('#saveMethodology');
  button.disabled = true;
  const item = {
    date: $('#methodologyDate').value.trim(),
    status: $('#methodologyStatus').value,
    title: values.methodologyTitle,
    text: values.methodologyText,
  };
  const next = isNew
    ? [...state.methodology, item]
    : state.methodology.map((current, index) => index === state.selectedMethodology ? item : current);
  try {
    await persistShared(state.overrides, state.promo, next, state.discovery);
    renderHeader();
    renderMethodology();
    closeDrawer();
    toast(isNew ? 'Методический материал добавлен' : 'Методический материал обновлён для всех');
  } catch (error) {
    toast(error.message);
    button.disabled = false;
  }
}

async function saveDiscovery() {
  if (!state.owner || state.selectedDiscovery === null || state.snapshot) return;
  const values = requiredFields([
    { id: 'discoveryTitle', label: 'Название' },
    { id: 'discoveryOutcome', label: 'Результат / что исследуем' },
    { id: 'discoveryScope', label: 'Что входит' },
    { id: 'discoveryOwner', label: 'Ответственный' },
  ]);
  if (!values) return;
  const parsedSources = textToSources($('#discoverySources').value);
  if (parsedSources.error) {
    toast(parsedSources.error);
    return;
  }
  const parsedTimeline = textToTimeline($('#discoveryTimeline').value);
  if (parsedTimeline.error) {
    toast(parsedTimeline.error);
    return;
  }
  const item = {
    ...(state.selectedDiscovery < 0 ? {} : state.discovery[state.selectedDiscovery]),
    title: values.discoveryTitle,
    outcome: values.discoveryOutcome,
    scope: values.discoveryScope.split('\n').map((value) => value.trim()).filter(Boolean),
    owner: values.discoveryOwner,
    status: $('#discoveryStatus').value,
    progress: Number($('#discoveryProgress').value),
    sources: parsedSources.sources,
    timeline: parsedTimeline.timeline,
  };
  const button = $('#saveDiscovery');
  button.disabled = true;
  const next = state.selectedDiscovery < 0
    ? [...state.discovery, item]
    : state.discovery.map((current, index) => index === state.selectedDiscovery ? item : current);
  try {
    await persistShared(state.overrides, state.promo, state.methodology, next);
    renderHeader();
    renderDiscovery();
    closeDrawer();
    toast('Карточка дискавери сохранена для всех');
  } catch (error) {
    toast(error.message);
    button.disabled = false;
  }
}

async function deleteDiscovery() {
  if (!state.owner || state.selectedDiscovery < 0 || state.snapshot) return;
  if (!confirm('Удалить карточку дискавери?')) return;
  const next = state.discovery.filter((_, index) => index !== state.selectedDiscovery);
  try {
    await persistShared(state.overrides, state.promo, state.methodology, next);
    renderHeader();
    renderDiscovery();
    closeDrawer();
    toast('Карточка удалена');
  } catch (error) {
    toast(error.message);
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
  renderDiscovery();
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
  const overrides = Object.fromEntries(allFeatures().map((feature) => {
    const current = currentFeature(feature);
    return [current.id, {
      status: current.status,
      progress: Number(current.progress || 0),
      note: current.note || '',
      updatedAt: capturedAt,
    }];
  }));
  const snapshot = {
    overrides,
    promo: state.promo,
    methodology: state.methodology,
    discovery: state.discovery,
    customFeatures: state.customFeatures,
  };
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
  renderDiscovery();
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
$('#addPromo').addEventListener('click', () => openPromo(-1));
$('#addMethodology').addEventListener('click', () => openMethodology(-1));
$('#addDiscovery').addEventListener('click', () => openDiscovery(-1));
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
