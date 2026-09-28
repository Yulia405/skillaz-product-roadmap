const data = window.Q4_DATA;
const params = new URLSearchParams(location.search);
const shared = params.get('shared') === '1';
const state = { mode: params.get('view') === 'client' ? 'client' : 'internal', team: 'Умка', scope: 'all', module: 'Все', query: '' };
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const monthName = id => data.months.find(month => month.id === id)?.title || '';

function modeCards() {
  let cards = state.mode === 'client' ? data.cards.filter(card => card.clientVisible) : data.cards.filter(card => card.team === state.team && (state.scope === 'all' || card.bucket === state.scope));
  if (state.module !== 'Все') cards = cards.filter(card => card.module === state.module);
  if (state.query) { const query = state.query.toLowerCase(); cards = cards.filter(card => `${card.title} ${card.module} ${card.summary}`.toLowerCase().includes(query)); }
  return cards;
}

function setMode(mode) {
  state.mode = shared ? 'client' : mode; state.module = 'Все'; state.query = ''; $('#searchInput').value = '';
  document.body.classList.toggle('client-mode', state.mode === 'client'); document.body.classList.toggle('shared-mode', shared);
  document.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === state.mode));
  if (!shared) history.replaceState(null, '', state.mode === 'client' ? `${location.pathname}?view=client` : location.pathname);
  render();
}

function renderHeader() {
  $('#updatedAt').textContent = `Обновлено ${data.updatedAt}`;
  const cards = modeCards(); const modules = new Set(cards.map(card => card.module));
  if (state.mode === 'client') {
    $('#eyebrow').textContent = 'Продуктовый план Skillaz'; $('#pageTitle').textContent = 'Что меняется в продукте в Q4 2026';
    $('#pageLead').textContent = 'Ключевые продуктовые изменения собраны по направлениям и срокам. Откройте карточку, чтобы увидеть состав инициативы.'; $('#roadmapTitle').textContent = 'Карта продуктовых изменений';
  } else {
    $('#eyebrow').textContent = 'Внутренний план команд'; $('#pageTitle').textContent = 'Квартальный план Q4 2026';
    $('#pageLead').textContent = 'Продуктовый и проектный объём, готовность задач, загрузка и риски в одной рабочей карте.'; $('#roadmapTitle').textContent = `План команды «${state.team}»`;
  }
  $('#summary').innerHTML = [[cards.length, 'инициатив'], [modules.size, 'направлений'], [cards.reduce((sum, card) => sum + card.tasks.length, 0), 'задач']].map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('');
}

function renderTeamControls() {
  $('#teamTabs').innerHTML = Object.keys(data.teams).map(team => `<button type="button" class="${team === state.team ? 'active' : ''}" data-team="${esc(team)}">${esc(team)}</button>`).join('');
  document.querySelectorAll('[data-team]').forEach(button => { button.onclick = () => { state.team = button.dataset.team; state.module = 'Все'; render(); }; });
  document.querySelectorAll('[data-scope]').forEach(button => { button.classList.toggle('active', button.dataset.scope === state.scope); button.onclick = () => { state.scope = button.dataset.scope; state.module = 'Все'; render(); }; });
}

function renderTeamPanel() {
  const team = data.teams[state.team]; $('#teamTitle').textContent = `Команда «${state.team}»`; $('#teamMission').textContent = team.mission;
  const labels = { be: 'Backend', fe: 'Frontend', qa: 'QA' };
  $('#capacity').innerHTML = Object.entries(labels).map(([key, label]) => {
    const effort = team.effort[key]; const capacity = team.capacity[key]; const percent = capacity ? Math.round(effort / capacity * 100) : null; const width = percent === null ? 0 : Math.min(percent, 100);
    return `<div class="capacity-row ${percent !== null && percent > 100 ? 'over' : ''}"><div><strong>${label}</strong><span>${effort} ч ${capacity ? `из ${capacity} ч` : '· ёмкость не задана'}</span></div><div class="capacity-track"><i style="width:${width}%"></i></div><b>${percent === null ? '—' : `${percent}%`}</b></div>`;
  }).join('');
  const stats = team.stats;
  $('#teamStats').innerHTML = [[stats.product, 'продукт'], [stats.project, 'проекты'], [stats.unestimated, 'без оценки'], [stats.notReady, 'не готовы']].map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('');
  $('#notices').innerHTML = (team.notices || []).map(notice => `<article class="notice ${notice.kind}"><strong>${esc(notice.title)}</strong><p>${esc(notice.text)}</p></article>`).join('');
  $('#notices').classList.toggle('empty', !(team.notices || []).length);
}

function renderFilters() {
  const source = state.mode === 'client' ? data.cards.filter(card => card.clientVisible) : data.cards.filter(card => card.team === state.team && (state.scope === 'all' || card.bucket === state.scope));
  const modules = ['Все', ...new Set(source.map(card => card.module).sort((a, b) => a.localeCompare(b, 'ru')))]; if (!modules.includes(state.module)) state.module = 'Все';
  $('#moduleFilter').innerHTML = `<label><span>Направление</span><select id="moduleSelect">${modules.map(module => `<option value="${esc(module)}" ${module === state.module ? 'selected' : ''}>${esc(module)}</option>`).join('')}</select></label>`;
  $('#moduleSelect').onchange = event => { state.module = event.target.value; renderHeader(); renderMonths(); };
}

function cardTemplate(card) {
  const image = card.images[0] ? `<img src="${esc(card.images[0])}" alt="" loading="lazy">` : '';
  const meta = state.mode === 'internal' ? `<span>${card.bucket === 'product' ? 'Продукт' : 'Проект'}</span><span>${card.tasks.length} ${card.tasks.length === 1 ? 'задача' : 'задач'}</span>` : `<span>${card.tasks.length > 1 ? 'Комплекс изменений' : 'Изменение'}</span>`;
  const status = state.mode === 'client' ? 'В плане' : card.status;
  const statusKind = state.mode === 'client' ? 'ready' : card.statusKind;
  return `<button type="button" class="roadmap-card" data-card-id="${esc(card.id)}"><span class="card-copy"><span class="card-label">${esc(card.module)}</span><strong>${esc(card.title)}</strong><span class="card-meta">${meta}</span></span>${image}<span class="status ${esc(statusKind)}">${esc(status)}</span></button>`;
}

function renderMonths() {
  const cards = modeCards();
  $('#months').innerHTML = data.months.map((month, index) => { const monthCards = cards.filter(card => card.month === month.id); return `<section class="month"><header><span>0${index + 1}</span><div><h3>${esc(month.title)}</h3><p>${esc(month.note)}</p></div><b>${monthCards.length}</b></header><div class="card-grid">${monthCards.length ? monthCards.map(cardTemplate).join('') : '<p class="empty-state">По выбранным условиям инициатив нет</p>'}</div></section>`; }).join('');
  document.querySelectorAll('[data-card-id]').forEach(button => button.onclick = () => openModal(button.dataset.cardId));
}

function renderDiscovery() { $('#discoveryGrid').innerHTML = data.discovery.map(item => `<article><span>Discovery</span><h3>${esc(item.title)}</h3><p>${esc(item.value)}</p><strong>${esc(item.result)}</strong></article>`).join(''); }

function openModal(id) {
  const card = data.cards.find(item => item.id === id); if (!card) return;
  const status = state.mode === 'client' ? 'В плане' : card.status;
  const statusKind = state.mode === 'client' ? 'ready' : card.statusKind;
  $('#modalMeta').innerHTML = `<span>${esc(card.module)}</span><span>${esc(monthName(card.month))}</span><span class="status ${esc(statusKind)}">${esc(status)}</span>`;
  $('#modalTitle').textContent = card.title; $('#modalSummary').textContent = card.summary;
  $('#gallery').innerHTML = card.images.map((image, index) => `<figure class="${index === 0 ? 'wide' : ''}"><img src="${esc(image)}" alt="Макет: ${esc(card.title)}" loading="lazy"></figure>`).join(''); $('#gallery').classList.toggle('empty', card.images.length === 0);
  $('#scopeTitle').textContent = state.mode === 'client' ? 'Что изменится' : `Состав инициативы · ${card.tasks.length}`;
  $('#taskList').innerHTML = card.tasks.map(task => state.mode === 'client' ? `<article class="task"><strong>${esc(task.title)}</strong>${task.description ? `<p>${esc(task.description)}</p>` : ''}</article>` : `<article class="task"><div class="task-head"><a href="${esc(task.url)}" target="_blank" rel="noreferrer">${esc(task.key)}</a><span>${esc(task.status)}</span></div><strong>${esc(task.title)}</strong>${task.description ? `<p>${esc(task.description)}</p>` : ''}<small>${task.project ? esc(task.project) : 'Продуктовая инициатива'}${task.be || task.fe || task.qa ? ` · BE ${task.be} · FE ${task.fe} · QA ${task.qa}` : ''}</small></article>`).join('');
  $('#modalShell').classList.add('open'); $('#modalShell').setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
}
function closeModal() { $('#modalShell').classList.remove('open'); $('#modalShell').setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
async function shareClientView() { const url = `${location.origin}${location.pathname}?view=client&shared=1`; try { await navigator.clipboard.writeText(url); showToast('Ссылка на клиентский план скопирована'); } catch { window.prompt('Скопируйте ссылку на клиентский план', url); } }
function showToast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); setTimeout(() => $('#toast').classList.remove('show'), 2200); }
function render() { renderHeader(); renderTeamControls(); renderTeamPanel(); renderFilters(); renderMonths(); renderDiscovery(); }

document.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => setMode(button.dataset.mode));
$('#searchInput').addEventListener('input', event => { state.query = event.target.value.trim(); renderHeader(); renderMonths(); });
$('#shareButton').onclick = shareClientView; $('#modalClose').onclick = closeModal; $('#modalBackdrop').onclick = closeModal;
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); }); setMode(state.mode);
