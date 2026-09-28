const data = window.Q4_DATA;
const params = new URLSearchParams(location.search);
const shared = params.get('shared') === '1';
const state = { mode: params.get('view') === 'client' ? 'client' : 'internal', team: 'Умка', scope: 'all', module: 'Все', query: '' };
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const monthName = id => data.months.find(month => month.id === id)?.title || '';
const moduleGroups = {
  'Безопасность': 'Core-компоненты',
  'Отчётность': 'Core-компоненты',
  'Импорты': 'Core-компоненты',
  'Роли и доступы': 'Core-компоненты',
  'Уведомления': 'Core-компоненты',
  'Адаптация': 'План адаптации',
  'Задачи': 'План адаптации',
  'Шаблоны адаптации': 'План адаптации',
  'Контрольные точки': 'План адаптации',
  'Наставничество': 'План адаптации',
  'Роли участников': 'План адаптации',
  'AI-помощник': 'План адаптации',
  'Пребординг': 'План адаптации',
};
const clientModules = {
  'Брендирование': 'Платформа и настройки',
  'Self-service': 'Платформа и настройки',
  'Навигация': 'Платформа и настройки',
  'Автособытия': 'Платформа и настройки',
  'Моё обучение': 'Обучение',
  'Редактор курсов': 'Обучение',
  'Тесты': 'Обучение',
  'Обучение и отчётность': 'Обучение',
  'Профиль и компетенции': 'Профиль',
};
const visibleModule = card => {
  const grouped = moduleGroups[card.module] || card.module;
  return state.mode === 'client' ? (clientModules[grouped] || grouped) : grouped;
};
const clientContent = {
  'DEV-64604': { title: 'Управление адаптацией в одном рабочем пространстве', summary: 'Обновляем рабочее место HR: планы, черновики и очередь назначений будут собраны в понятных списках с быстрым поиском и массовыми действиями.', outcomes: ['Быстрее находить нужные планы и видеть их состояние', 'Выполнять типовые действия сразу для нескольких сотрудников', 'Контролировать черновики и очередь назначений без ручной сверки'] },
  'DEV-64440': { title: 'Внутренняя витрина вакансий', summary: 'Сотрудники смогут находить подходящие вакансии внутри компании и изучать возможности карьерного перехода в привычном интерфейсе.', outcomes: ['Единая точка входа во внутренние вакансии', 'Более прозрачные карьерные возможности для сотрудников', 'Поддержка внутренней мобильности и удержания'] },
  'DEV-64608': { title: 'Контрольные точки и раннее выявление рисков', summary: 'Руководитель сможет регулярно фиксировать ход адаптации, видеть отклонения и вовремя подключаться к проблемным ситуациям.', outcomes: ['Понятный график обязательных встреч', 'Единый индикатор риска по плану', 'Напоминания о приближении и просрочке контрольной точки'] },
  'DEV-64620': { title: 'Готовые цели для планов адаптации', summary: 'HR сможет добавлять в шаблоны и индивидуальные планы проверенные цели из единого каталога, не создавая их заново.', outcomes: ['Повторное использование корпоративных целей', 'Единые формулировки и критерии результата', 'Быстрая настройка целей под конкретного сотрудника'] },
  'DEV-64609': { title: 'Финальное ревью адаптации', summary: 'Руководитель получит целостную картину результатов сотрудника и сможет принять итоговое решение по завершению плана.', outcomes: ['Все результаты плана собраны в одном месте', 'Возврат на доработку с понятным комментарием', 'Прозрачное успешное или неуспешное завершение'] },
  'DEV-61870': { title: 'Управляемый жизненный цикл шаблонов', summary: 'Шаблоны адаптации получат понятные статусы, чтобы в назначениях использовались только актуальные и проверенные версии.', outcomes: ['Черновики не попадают в рабочие назначения', 'Активные шаблоны легко отличить от архивных', 'Изменения публикуются контролируемо'] },
  'DEV-67944': { title: 'Библиотека задач адаптации', summary: 'HR сможет переиспользовать типовые задачи и при необходимости включать проверку результата ответственным сотрудником.', outcomes: ['Меньше ручного создания одинаковых задач', 'Единые требования к результату', 'Понятный процесс проверки выполнения'] },
  'DEV-64617': { title: 'AI-помощник для подготовки адаптации', summary: 'Помощник ускорит создание наполнения плана на основе роли сотрудника и доступных корпоративных материалов.', outcomes: ['Быстрый черновик плана под конкретную роль', 'Подбор релевантных задач и материалов', 'Возможность проверить и скорректировать результат перед публикацией'] },
  'DEV-64605': { title: 'Мои планы, планы коллег и задачи', summary: 'Сотрудники и помощники получат обновлённые списки планов и отдельное рабочее пространство для своих задач.', outcomes: ['Понятный статус и прогресс каждого плана', 'Быстрый доступ к планам коллег, где пользователь назначен помощником', 'Мои задачи и задачи коллег собраны в отдельном разделе'] },
  'DEV-64317': { title: 'Доступ к отчёту по наставничеству', summary: 'Упрощаем доступ к отчёту для пользователей, которым он нужен для управления наставничеством.', outcomes: ['Меньше лишних ограничений доступа', 'Быстрее получение данных по наставничеству'] },
  'DEV-62461': { title: 'Поиск сотрудников по рабочим ролям', summary: 'Администратор сможет отбирать сотрудников по новым ролям прямо в общем списке пользователей.', outcomes: ['Быстрый поиск нужной группы сотрудников', 'Удобная работа с ролевой моделью компании'] },
  'DEV-64880': { title: 'Отчётность адаптации', summary: 'Расширяем аналитику по планам адаптации: HR сможет выгружать данные о рисках, контрольных точках, целях и результатах.', outcomes: ['Анализ причин и динамики рисков', 'Контроль прохождения обязательных встреч', 'Оценка достижения целей и промежуточных результатов'] },
  'DEV-61896': { title: 'Корректная обработка кандидатов при импорте', summary: 'При обновлении данных система будет корректно управлять ролью кандидата и не оставлять пользователю устаревший доступ.', outcomes: ['Актуальные роли после импорта', 'Меньше ручных исправлений пользователей'] },
  'DEV-64603': { title: 'Рабочее место руководителя', summary: 'Руководитель сможет удобнее контролировать планы команды, видеть прогресс и работать с адаптацией с разных устройств.', outcomes: ['Адаптивный интерфейс для ежедневной работы', 'Понятное отображение прогресса по маршруту сотрудника', 'Быстрый переход к действиям руководителя'] },
  'DEV-64602': { title: 'Актуальные уведомления по адаптации', summary: 'Обновляем набор push-уведомлений, чтобы сотрудники и руководители вовремя получали сообщения о важных событиях плана.', outcomes: ['Единые актуальные шаблоны уведомлений', 'Своевременное информирование участников'] },
  'DEV-50542': { title: 'Согласия на обработку данных в интерфейсе', summary: 'Администратор сможет управлять показом согласия и обновлять документ политики без изменения констант.', outcomes: ['Настройка согласия без обращения к разработчикам', 'Централизованное обновление документа для пользователей'] },
  'DEV-57283': { title: 'Новая главная страница обучения', summary: 'Главная LMS станет персональной точкой входа: важные действия, новости и продолжение обучения будут видны сразу после входа.', outcomes: ['Приоритетные действия на первом экране', 'Быстрый возврат к незавершённому обучению', 'Новости и персональное приветствие в единой структуре'] },
  'DEV-65423': { title: 'Быстрое создание нового пространства', summary: 'Новое клиентское пространство можно будет разворачивать на основе готовой конфигурации, включая необходимые уведомления.', outcomes: ['Сокращение времени запуска нового пространства', 'Повторное использование проверенных настроек', 'Меньше ручной настройки при старте'] },
  'DEV-45446': { title: 'Единая современная навигация LMS', summary: 'Убираем устаревшую версию меню, чтобы пользователи работали в одном последовательном интерфейсе.', outcomes: ['Одинаковая навигация для всех пользователей', 'Меньше путаницы между старым и новым меню'] },
  'DEV-51893': { title: 'Новый профиль сотрудника', summary: 'Профиль станет центром данных о развитии: обучение, оценка и выбранные компетенции будут собраны в единой структуре.', outcomes: ['Ключевые данные о развитии на одном экране', 'Выбор компетенций для дальнейшего развития', 'Удобная загрузка и настройка фотографии'] },
  'DEV-68444': { title: 'Актуальные рекомендации при смене компетенций', summary: 'При изменении выбранных компетенций система будет обновлять связанные рекомендации по обучению.', outcomes: ['Рекомендации соответствуют текущим целям развития', 'Неактуальные курсы не остаются в подборке'] },
  'DEV-65981': { title: 'Только релевантные программы в назначениях', summary: 'При работе с назначениями администратор будет видеть программы, действительно назначенные сотруднику.', outcomes: ['Меньше лишних данных в списке', 'Быстрее поиск нужного назначения'] },
  'DEV-44410': { title: 'Брендированное завершение обучения', summary: 'Страница завершения программы сможет соответствовать фирменному стилю компании.', outcomes: ['Целостный брендированный путь сотрудника', 'Настраиваемое завершение учебной программы'] },
  'DEV-64171': { title: 'Массовый выбор назначений', summary: 'Администратор сможет выбрать все подходящие назначения сразу, без последовательной загрузки каждой страницы.', outcomes: ['Быстрее выполнение массовых операций', 'Корректная работа с большими списками'] },
  'DEV-58009': { title: 'Понятная настройка отчётов', summary: 'Столбцы отчёта будут сгруппированы по смысловым категориям, чтобы нужные данные было проще найти и включить.', outcomes: ['Быстрый выбор нужных показателей', 'Меньше ошибок при настройке отчёта'] },
  'DEV-60952': { title: 'Гибкое управление редакторами курса', summary: 'Куратор и автор смогут работать с содержанием курса в рамках понятных правил доступа.', outcomes: ['Меньше ручной настройки прав', 'Предсказуемый доступ к редактированию курса'] },
  'DEV-63145': { title: 'Импорт готового оформления', summary: 'Администратор сможет загрузить подготовленную стилизацию в конструктор одним архивом.', outcomes: ['Быстрый перенос фирменного оформления', 'Меньше ручной настройки визуальных параметров'] },
  'DEV-49031': { title: 'Понятные роли участников процессов', summary: 'Разделяем полномочия менеджера, HRBP и помощника, чтобы каждому пользователю были доступны только его рабочие действия.', outcomes: ['Прозрачное распределение ответственности', 'Корректный доступ к данным и действиям'] },
  'DEV-68446': { title: 'Обязательные данные профиля', summary: 'Компания сможет определить поля, которые сотрудник должен заполнить в своём профиле.', outcomes: ['Более полные и качественные данные сотрудников', 'Понятные требования к заполнению профиля'] },
  'DEV-65837': { title: 'Self-service брендирования', summary: 'Администратор сможет самостоятельно настроить экран входа и внешний вид мобильного приложения под бренд компании.', outcomes: ['Настройка без обращения в поддержку', 'Единый фирменный стиль веб- и мобильного входа', 'Собственная иконка приложения на устройстве'] },
  'DEV-63912': { title: 'Ссылки в импортируемых push-уведомлениях', summary: 'При массовой загрузке уведомлений можно будет сразу указать ссылку для перехода пользователя к нужному действию.', outcomes: ['Уведомление ведёт прямо к целевому объекту', 'Меньше ручной настройки после импорта'] },
  'DEV-56505': { title: 'Бесшовный переход в мобильное приложение', summary: 'Ссылка из мобильного браузера будет открывать установленное приложение и сохранять контекст действия.', outcomes: ['Меньше лишних шагов для пользователя', 'Переход сразу к нужному экрану приложения'] },
  'DEV-63425': { title: 'Удобный редактор push-уведомлений', summary: 'Обновляем настройку шаблонов push-уведомлений, чтобы администратору было проще готовить сообщения.', outcomes: ['Понятная настройка содержания уведомления', 'Меньше ошибок при подготовке шаблона'] },
  'DEV-66595': { title: 'Единые push-уведомления по ключевым модулям', summary: 'Актуализируем шаблоны уведомлений для обучения, оценки и индивидуальных планов развития.', outcomes: ['Последовательные сообщения во всех процессах', 'Актуальные шаблоны без ручной миграции'] },
  'DEV-50298': { title: 'Настройки компании в интерфейсе', summary: 'Критичные настройки интерфейса, SMS и согласий будут доступны администратору без технических запросов.', outcomes: ['Самостоятельное управление настройками компании', 'Быстрое изменение параметров без релиза', 'Прозрачная настройка согласий и коммуникаций'] },
  'vinni-Калибровка': { title: 'Гибкая настройка оценки потенциала', summary: 'Переносим правила оценки потенциала на управляемый процесс, который легче адаптировать под изменения компании.', outcomes: ['Меньше зависимости от индивидуальных доработок', 'Управляемое изменение этапов и статусов оценки'] },
  'vinni-Обучение': { title: 'Обновление технологической основы карьерных сценариев', summary: 'Обновляем внутреннюю платформу карьерного модуля, чтобы повысить стабильность и упростить дальнейшее развитие.', outcomes: ['Более стабильная работа карьерных сценариев', 'Техническая готовность к следующим продуктовым изменениям'] },
  'vinni-Профиль': { title: 'Корректное обновление сотрудников при импорте', summary: 'Улучшаем обработку идентификаторов сотрудников, чтобы повторный импорт не создавал ошибочные связи между профилями.', outcomes: ['Меньше дублей и неверных связок пользователей', 'Предсказуемое обновление данных сотрудников'] },
};
const clientCopy = card => clientContent[card.id] || { title: card.title, summary: card.summary, outcomes: ['Изменение делает ежедневный сценарий понятнее и сокращает ручные действия.'] };

function modeCards() {
  let cards = state.mode === 'client' ? data.cards.filter(card => card.clientVisible) : data.cards.filter(card => card.team === state.team && (state.scope === 'all' || card.bucket === state.scope));
  if (state.module !== 'Все') cards = cards.filter(card => visibleModule(card) === state.module);
  if (state.query) {
    const query = state.query.toLowerCase();
    cards = cards.filter(card => {
      const copy = state.mode === 'client' ? clientCopy(card) : card;
      return `${copy.title} ${visibleModule(card)} ${copy.summary} ${(copy.outcomes || []).join(' ')}`.toLowerCase().includes(query);
    });
  }
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
  const cards = modeCards(); const modules = new Set(cards.map(visibleModule));
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
  const priority = { 'План адаптации': 0, 'Core-компоненты': 1 };
  const sortedModules = [...new Set(source.map(visibleModule))].sort((a, b) => (priority[a] ?? 10) - (priority[b] ?? 10) || a.localeCompare(b, 'ru'));
  const modules = ['Все', ...sortedModules]; if (!modules.includes(state.module)) state.module = 'Все';
  $('#moduleFilter').innerHTML = modules.map(module => `<button type="button" class="${module === state.module ? 'active' : ''}" data-module="${esc(module)}">${esc(module)}</button>`).join('');
  document.querySelectorAll('[data-module]').forEach(button => { button.onclick = () => { state.module = button.dataset.module; renderHeader(); renderFilters(); renderMonths(); }; });
}

function cardTemplate(card) {
  const image = card.images[0] ? `<img src="${esc(card.images[0])}" alt="" loading="lazy">` : '';
  const meta = state.mode === 'internal' ? `<span>${card.bucket === 'product' ? 'Продукт' : 'Проект'}</span><span>${card.tasks.length} ${card.tasks.length === 1 ? 'задача' : 'задач'}</span>` : `<span>${card.tasks.length > 1 ? 'Комплекс изменений' : 'Изменение'}</span>`;
  const status = state.mode === 'client' ? 'В плане' : card.status;
  const statusKind = state.mode === 'client' ? 'ready' : card.statusKind;
  const title = state.mode === 'client' ? clientCopy(card).title : card.title;
  return `<button type="button" class="roadmap-card" data-card-id="${esc(card.id)}"><span class="card-copy"><strong>${esc(title)}</strong><span class="card-meta">${meta}</span></span>${image}<span class="status ${esc(statusKind)}">${esc(status)}</span></button>`;
}

function renderMonths() {
  const cards = modeCards();
  $('#months').innerHTML = data.months.map((month, index) => { const monthCards = cards.filter(card => card.month === month.id); return `<section class="month"><header><span>0${index + 1}</span><div><h3>${esc(month.title)}</h3><p>${esc(month.note)}</p></div><b>${monthCards.length}</b></header><div class="card-grid">${monthCards.length ? monthCards.map(cardTemplate).join('') : '<p class="empty-state">По выбранным условиям инициатив нет</p>'}</div></section>`; }).join('');
  document.querySelectorAll('[data-card-id]').forEach(button => button.onclick = () => openModal(button.dataset.cardId));
}

function renderDiscovery() { $('#discoveryGrid').innerHTML = data.discovery.map(item => `<article><span>Discovery</span><h3>${esc(item.title)}</h3><p>${esc(item.value)}</p><strong>${esc(item.result)}</strong></article>`).join(''); }

function openModal(id) {
  const card = data.cards.find(item => item.id === id); if (!card) return;
  const copy = state.mode === 'client' ? clientCopy(card) : card;
  const status = state.mode === 'client' ? 'В плане' : card.status;
  const statusKind = state.mode === 'client' ? 'ready' : card.statusKind;
  $('#modalMeta').innerHTML = `<span>${esc(monthName(card.month))}</span><span class="status ${esc(statusKind)}">${esc(status)}</span>`;
  $('#modalTitle').textContent = copy.title; $('#modalSummary').textContent = copy.summary;
  $('#gallery').innerHTML = card.images.map((image, index) => `<figure class="${index === 0 ? 'wide' : ''}"><img src="${esc(image)}" alt="Макет: ${esc(copy.title)}" loading="lazy"></figure>`).join(''); $('#gallery').classList.toggle('empty', card.images.length === 0);
  $('#scopeTitle').textContent = state.mode === 'client' ? 'Что получит пользователь' : `Состав инициативы · ${card.tasks.length}`;
  $('#taskList').classList.toggle('client-outcomes', state.mode === 'client');
  $('#taskList').innerHTML = state.mode === 'client'
    ? copy.outcomes.map((outcome, index) => `<div class="client-outcome"><span>${String(index + 1).padStart(2, '0')}</span><p>${esc(outcome)}</p></div>`).join('')
    : card.tasks.map(task => `<article class="task"><div class="task-head"><a href="${esc(task.url)}" target="_blank" rel="noreferrer">${esc(task.key)}</a><span>${esc(task.status)}</span></div><strong>${esc(task.title)}</strong>${task.description ? `<p>${esc(task.description)}</p>` : ''}<small>${task.project ? esc(task.project) : 'Продуктовая инициатива'}${task.be || task.fe || task.qa ? ` · BE ${task.be} · FE ${task.fe} · QA ${task.qa}` : ''}</small></article>`).join('');
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
