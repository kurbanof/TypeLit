/* TypeLit — local-first reading and touch-typing workspace. */
const DB_NAME = 'typelit-local-v1', DB_STORE = 'items';
const courseGroups = {
  en: [
    { category:'Basic lessons', kind:'keys', lessons:[['df jk','d f j k'],['as l;','a s l ;'],['vb nm','v b n m'],['tg yh','t g y h'],['er ui','e r u i'],['qw op','q w o p'],['xc , .','x c , .'],['z ! ? /','z ! ? /']] },
    { category:'Typing words', kind:'words', lessons:[['Alphabet','alphabet'],['Short words','short'],['Long words','long'],['Capital letters','capital']] },
    { category:'Punctuation', kind:'punctuation', lessons:[[', . ; :',',.;:'],['( ) \' "','()\'"'],['! ? - /','!?-/'],['All together','all']] },
    { category:'Numbers and symbols', kind:'numbers', lessons:[['56 78','56 78'],['34 90','34 90'],['12 -=','12 - ='],['Numbers 1 - 99','1 - 99'],['% ^ & *','%^&*'],['# $ ( )','#$()'],['! @ _ +','!@_+'],['All together','all']] },
    { category:'Other symbols', kind:'symbols', lessons:[["' [ ] \\","'[]\\"],['~ { } |','~{}|'],['< >','<>'],['All together','all']] }
  ],
  ru: [
    { category:'Базовые уроки', kind:'keys', lessons:[['ва ол','в а о л'],['фы дя','ф ы д я'],['ми ть','м и т ь'],['ен пр','е н п р'],['ук гш','у к г ш'],['чс бв','ч с б в'],['дщ цч','д щ ц ч'],['зх ъё','з х ъ ё']] },
    { category:'Набираем слова', kind:'words', lessons:[['Слова А–Я','alphabet'],['Короткие слова','short'],['Длинные слова','long'],['Прописные буквы','capital']] },
    { category:'Знаки препинания', kind:'punctuation', lessons:[['. , : ;','.,:;'],['! ? -','!?-'],['( ) \\ /','()\\/'],['Все вместе','all']] },
    { category:'Цифры и символы', kind:'numbers', lessons:[['56 78','56 78'],['34 90','34 90'],['12 -=','12 - ='],['Числа 1–99','1–99'],['% : ? *','%:?*'],['№ : ( )','№:()'],['! _ + .','!_+.'],['Все вместе','all']] }
  ]
};
courseGroups.en[4].lessons[0] = ['` [ ] \\', '`[]\\'];
courseGroups.en[4].lessons[2] = ['~ < >', '~<>'];
function lessonExercise(language, kind, sample) {
  const words = language === 'ru'
    ? { alphabet:'август берег ветер город дорога', short:'дом лес мир ночь путь свет', long:'путешествие воображение удивительный библиотека', capital:'Книга Москва Россия Английский Печать' }
    : { alphabet:'about bring calm dream every find', short:'book calm read type word', long:'adventure imagination wonderful library', capital:'Book London English Practice TypeLit' };
  let sequence;
  if (kind === 'keys') {
    const chars=[...sample.replace(/\s/g,'')];sequence=Array.from({length:32},(_,i)=>`${chars[i%chars.length]}${chars[(i+1)%chars.length]} ${chars[(i+2)%chars.length]}${chars[(i+3)%chars.length]}`).join(' ');
  } else if (kind === 'words') {
    const list=sample==='alphabet'?(language==='ru'?'абвгдеёжзийклмнопрстуфхцчшщъыьэюя':'abcdefghijklmnopqrstuvwxyz'):words[sample]||words.short;
    sequence=Array.from({length:12},(_,i)=>i%3===0?list:`${list} ${list}`).join(' ');
  } else if (kind === 'punctuation') {
    const chars=sample==='all'?(language==='ru'?'. , : ; ! ? — ( ) / \\':'.,:;!?-()\\/"'):sample;
    sequence=Array.from({length:25},(_,i)=>`${chars} ${i%2?`слово ${i}`:`word ${i}`}`).join(' ');
  } else if (kind === 'numbers') {
    const chars=sample==='all'?'1234567890-=!@#$%^&*()_+':sample;
    sequence=Array.from({length:22},(_,i)=>`${chars} ${i+1}${i+2} ${i+4}${i+5}`).join(' ');
  } else {
    const chars=sample==='all'?"'[]\\~{}|<>":sample;sequence=Array.from({length:26},(_,i)=>`${chars} ${i%2?'text':'word'} ${chars}`).join(' ');
  }
  return sequence;
}
const starterLessons=Object.fromEntries(Object.entries(courseGroups).map(([lang,groups])=>[lang,groups.flatMap(group=>group.lessons.map(([title,sample])=>({title,keys:sample,text:lessonExercise(lang,group.kind,sample),category:group.category,kind:group.kind})))]));
const defaultState = { items: [], stats: { totalChars: 0, totalErrors: 0, totalSeconds: 0, sessions: 0, daily: {}, errorsByKey: {}, lessonResults: [] }, settings: { accent: 'amber', font: 'pixel', layout: 'Русская · ЙЦУКЕН', sidebarHidden: false, showGuide: true, showTrainerStats: true, dailyGoalChars: 2000, readerSize: 17, readerFont: 'serif' }, lessonProgress: { ru: 0, en: 0 }, lessonSession: null };
let state = structuredClone(defaultState), dbPromise, currentView = 'home', activeItemId = null;
let session = { target: '', position: 0, errors: 0, startedAt: null, elapsed: 0, base: 0, typed: '', lastCountedLength: 0, mode: 'book', lessonIndex: 0, language: 'ru' };
let tickHandle = null, toastHandle = null, pendingAnki = null, lessonLang = 'ru', stateSaveTimer = null;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    if (!('indexedDB' in window)) return resolve(null);
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE, { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return dbPromise;
}
async function getSaved(key) {
  const db = await openDb();
  if (db) return new Promise(resolve => { const r = db.transaction(DB_STORE).objectStore(DB_STORE).get(key); r.onsuccess = () => resolve(r.result?.value); r.onerror = () => resolve(undefined); });
  try { return JSON.parse(localStorage.getItem(`typelit:${key}`)); } catch { return undefined; }
}
async function putSaved(key, value) {
  const db = await openDb();
  if (db) return new Promise(resolve => { const r = db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put({ key, value }); r.onsuccess = () => resolve(true); r.onerror = () => resolve(false); });
  try { localStorage.setItem(`typelit:${key}`, JSON.stringify(value)); return true; } catch { return false; }
}
async function persist() {
  const ok = await putSaved('state', state);
  if (!ok) showToast('Не удалось сохранить данные. Попробуйте импортировать файл меньшего размера.');
}
function persistSoon() { if(session.mode==='lesson'&&session.target){state.lessonSession={language:session.language,index:session.lessonIndex,position:session.position,elapsed:session.elapsed+(session.startedAt?Math.floor((Date.now()-session.startedAt)/1000):0),errors:session.errors||0};}clearTimeout(stateSaveTimer); stateSaveTimer = setTimeout(() => persist(), 450); }
function applySettings() {
  document.body.classList.toggle('accent-sage', state.settings.accent === 'sage');
  document.body.classList.toggle('accent-indigo', state.settings.accent === 'indigo');
  document.body.classList.toggle('font-system', state.settings.font === 'system');
  document.body.classList.toggle('light-mode', state.settings.theme === 'light');
  document.body.classList.toggle('sidebar-hidden', Boolean(state.settings.sidebarHidden));
  document.body.classList.toggle('guide-hidden', state.settings.showGuide === false);
  document.documentElement.style.setProperty('--reader-font-size', `${Number(state.settings.readerSize) || 17}px`);
  document.documentElement.style.setProperty('--reader-font-family', state.settings.readerFont === 'sans' ? 'var(--sans)' : 'Georgia, "Times New Roman", serif');
  const sidebarToggle=$('#sidebarToggle');if(sidebarToggle){sidebarToggle.setAttribute('aria-expanded',String(!state.settings.sidebarHidden));sidebarToggle.setAttribute('aria-label',state.settings.sidebarHidden?'Открыть меню':'Скрыть меню');sidebarToggle.title=state.settings.sidebarHidden?'Открыть меню':'Свернуть меню';}
}
function esc(s = '') { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function showToast(text) { const box = $('#toast'); box.textContent = text; box.classList.add('show'); clearTimeout(toastHandle); toastHandle = setTimeout(() => box.classList.remove('show'), 3200); }
function setView(view) { currentView = view; render(); }
function itemById(id) { return state.items.find(x => x.id === id); }
function fmtTime(sec) { const n = Math.max(0, Math.floor(sec || 0)); return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; }
function pct(item) { return item?.text?.length ? Math.min(100, Math.round((item.position || 0) / item.text.length * 100)) : 0; }
function wordsCount(text) { return (text || '').trim().split(/\s+/).filter(Boolean).length; }
function getName(item) { return item.kind === 'deck' ? 'Карточки Anki' : 'Книга'; }
function coverClass(item, i = 0) { return item.cover || ['book-one', 'book-two', 'book-three'][i % 3]; }
function iconFor(item) { return item.kind === 'deck' ? '▧' : 'T'; }
function bookCard(item, i) {
  const p = pct(item), sub = item.kind === 'deck' ? `${item.cards?.length || 0} карточек` : `${wordsCount(item.text)} слов`;
  return `<article class="panel book-card" data-open-item="${esc(item.id)}"><div class="book-card-top"><div class="cover ${coverClass(item, i)}"><span class="cover-symbol">${iconFor(item)}</span><span class="cover-label">${item.kind === 'deck' ? 'DECK' : 'READ · TYPE'}</span></div><div style="min-width:0;flex:1"><h3 title="${esc(item.title)}">${esc(item.title)}</h3><p>${esc(item.author || sub)}</p></div></div><div class="progress"><i style="width:${p}%"></i></div><div class="book-card-bottom"><span>${item.kind === 'deck' ? 'КАРТОЧКИ' : 'ПРОЧИТАНО'}</span><span>${p}%</span></div></article>`;
}
function librarySection(items = state.items, compact = false) {
  if (!items.length) return `<div class="library-empty"><div class="empty-symbol">▤</div><h3>Ваша полка пока свободна</h3><p>Добавьте книгу или колоду Anki — они появятся здесь. Прогресс чтения и печати сохранится автоматически.</p><button class="button secondary small" data-action="import">Добавить материал <span>＋</span></button></div>`;
  const slice = compact ? items.slice(0, 3) : items;
  return `<div class="library-grid">${slice.map(bookCard).join('')}</div>`;
}
function getRecentItem() { return [...state.items].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]; }
function homePage() {
  const recent = getRecentItem(), stats = state.stats, dailyChars = stats.daily?.[new Date().toLocaleDateString('ru-RU')] || 0, dailyGoal=Number(state.settings.dailyGoalChars)||2000, dailyPct=Math.min(100,Math.round(dailyChars/dailyGoal*100));
  const recentPanel = recent ? `<div class="continue-card"><div class="cover ${coverClass(recent)}"><span class="cover-symbol">${iconFor(recent)}</span><span class="cover-label">${recent.kind === 'deck' ? 'DECK' : 'READ · TYPE'}</span></div><div class="continue-info"><h3>${esc(recent.title)}</h3><div class="author">${esc(recent.author || (recent.kind === 'deck' ? `${recent.cards?.length || 0} карточек` : 'Личная библиотека'))}</div><div class="mini-meta"><span>${recent.kind === 'deck' ? 'КОЛОДА' : 'КНИГА'}</span><span>·</span><span>${recent.kind === 'deck' ? 'ПОВТОРЕНИЕ' : `${wordsCount(recent.text)} СЛОВ`}</span></div><div class="progress"><i style="width:${pct(recent)}%"></i></div><div class="progress-caption"><span>${recent.kind === 'deck' ? 'Изучено' : 'Прогресс'}</span><span>${pct(recent)}%</span></div></div><div class="continue-action"><button class="button primary small" data-open-item="${esc(recent.id)}">Продолжить <span class="arrow">→</span></button></div></div>` : `<div class="library-empty" style="padding:21px 12px"><h3>С чего начнём?</h3><p>Импортируйте книгу или откройте уроки, чтобы попробовать TypeLit.</p><button class="button primary small" data-action="import">Добавить файл <span>→</span></button></div>`;
  return `<section class="welcome-row"><div><div class="eyebrow">ВАША ТИХАЯ ПРАКТИКА</div><h1>Читай. Учись. Печатай.</h1><p>Превращайте любимые тексты и новые слова в ежедневную практику слепой печати.</p></div><button class="button primary" data-action="import">Добавить материал <span class="arrow">＋</span></button></section>
    <section class="dashboard-grid"><div class="panel continue-panel"><div class="panel-heading"><h2>${recent ? 'Продолжить' : 'Начать занятие'}</h2><span class="tiny-label">${recent ? 'ПОСЛЕДНЕЕ МЕСТО' : 'ВАША БИБЛИОТЕКА'}</span></div>${recentPanel}</div><div class="panel focus-panel"><div class="panel-heading"><h2>Сегодня</h2><span class="tiny-label">ЦЕЛЬ · ${dailyGoal.toLocaleString('ru-RU')} ЗНАКОВ</span></div><div class="focus-ring daily-goal-ring" style="--goal-progress:${dailyPct}%"><div><strong>${dailyPct}<small>ПРОЦЕНТОВ</small></strong></div></div><div class="focus-caption"><b>${dailyChars.toLocaleString('ru-RU')}</b> знаков набрано сегодня</div><div class="daily-note">${Math.max(0,dailyGoal-dailyChars).toLocaleString('ru-RU')} ДО ЦЕЛИ</div></div></section>
    <div class="section-head"><h2>Выберите занятие</h2></div><section class="mode-grid"><article class="panel mode-card" data-view="lessons"><span class="mode-icon">⌨</span><div><h3>Научиться печатать</h3><p>Курсы по клавишам и пальцам для русской и английской раскладок.</p></div><span class="mode-arrow">→</span></article><article class="panel mode-card" data-action="import"><span class="mode-icon">▤</span><div><h3>Печатать по книге</h3><p>Добавьте EPUB, FB2 или текст и продолжайте с сохранённого места.</p></div><span class="mode-arrow">→</span></article></section>
    <div class="section-head"><h2>Моя библиотека</h2><button class="text-link" data-view="library">Открыть полку <span>→</span></button></div><section>${librarySection(state.items, true)}</section>
    <section class="panel stat-strip"><div class="stat-item"><span>Символов набрано</span><b>${(stats.totalChars || 0).toLocaleString('ru-RU')}</b></div><div class="stat-item"><span>Время практики</span><b>${Math.floor((stats.totalSeconds || 0) / 60)}<small>мин</small></b></div><div class="stat-item"><span>Занятий</span><b>${stats.sessions || 0}</b></div><div class="stat-item"><span>Точность</span><b>${accuracy()}<small>%</small></b></div></section>`;
}
function lessonPage() {
  const arr = starterLessons[lessonLang], done = state.lessonProgress[lessonLang] || 0, langName = lessonLang === 'ru' ? 'Русская раскладка' : 'English layout', data = arr[Math.min(done, arr.length - 1)];
  let cardIndex=0;
  const groups=courseGroups[lessonLang].map(group=>`<section class="course-group"><div class="course-group-heading"><h2>${esc(group.category)}</h2><span>${group.lessons.length} УПРАЖНЕНИЙ</span></div><div class="course-card-grid">${group.lessons.map(([title])=>{const index=cardIndex++,completed=index<done,locked=index>done;return `<button class="panel course-card ${completed?'completed':''} ${index===done?'current':''} ${locked?'locked':''}" data-lesson="${index}" data-lesson-lang="${lessonLang}" ${locked?'aria-disabled="true"':''}><span class="course-card-title">${esc(title)}</span><span class="course-card-score">${completed?'✓':String(index+1).padStart(2,'0')}</span><span class="course-card-meta"><i>◷ ${completed?'готово':'~ 2 мин'}</i><i>${locked?'●':'◎'} ${completed?'100%':'—'}</i></span></button>`;}).join('')}</div></section>`).join('');
  return `<section class="welcome-row"><div><div class="eyebrow">КУРС СЛЕПОЙ ПЕЧАТИ</div><h1>Уроки</h1><p>Запоминайте клавиши постепенно, не глядя на клавиатуру.</p></div><div class="tiny-label">${done} ИЗ ${arr.length} УРОКОВ</div></section>
    <section class="panel lesson-banner"><div><div class="eyebrow">ВАШ ПУТЬ К СВОБОДНОЙ ПЕЧАТИ</div><h2>${langName}</h2><p>${done ? `Завершено уроков: ${done}. Следующий шаг — «${data.title}».` : 'Короткие упражнения знакомят с клавишами и правильной постановкой пальцев.'}</p></div><div class="banner-glpyh">⌨</div></section>
    <div class="lesson-languages"><button class="language-tab ${lessonLang === 'ru' ? 'active' : ''}" data-language="ru">RU · ЙЦУКЕН <small>${starterLessons.ru.length} уроков</small></button><button class="language-tab ${lessonLang === 'en' ? 'active' : ''}" data-language="en">EN · QWERTY <small>${starterLessons.en.length} lessons</small></button>${state.lessonSession?`<button class="button secondary small" data-action="resume-lesson">Вернуться к уроку · ${state.lessonSession.language.toUpperCase()}</button>`:''}<button class="button primary small" data-start-lesson="${Math.min(done,arr.length-1)}" data-language="${lessonLang}">${done?'Продолжить курс':'Начать курс'} <span>→</span></button></div>
    ${groups}`;
}
function libraryPage() { return `<section class="welcome-row"><div><div class="eyebrow">ВАША КОЛЛЕКЦИЯ</div><h1>Моя библиотека</h1><p>Книги, тексты и карточки — всё в одном месте.</p></div><button class="button primary" data-action="import">Добавить материал <span class="arrow">＋</span></button></section><section>${state.items.length ? `<div class="section-head" style="margin-top:0"><h2>${state.items.length} ${state.items.length === 1 ? 'материал' : 'материала'}</h2><span class="tiny-label">ХРАНИТСЯ ЛОКАЛЬНО</span></div>${librarySection(state.items)}` : librarySection()}</section>`; }
function accuracy() { const c = state.stats.totalChars || 0, e = state.stats.totalErrors || 0; return c + e ? Math.round(c / (c + e) * 100) : 100; }
function statsPage() {
  const st = state.stats, days = Object.entries(st.daily || {}).sort((a,b) => new Date(a[0].split('.').reverse().join('-')) - new Date(b[0].split('.').reverse().join('-'))).slice(-7);
  const bars = days.length ? days : Array.from({length:7},(_,i)=>[new Date(Date.now()-(6-i)*86400000).toLocaleDateString('ru-RU'),0]); const max = Math.max(1,...bars.map(x=>x[1]));
  const labels=physicalKeys.flatMap(row=>[...row]).map(key=>key===' '?'space':key),counts=st.errorsByKey||{},peak=Math.max(1,...Object.values(counts));
  const today=new Date().toLocaleDateString('ru-RU'),todayChars=st.daily?.[today]||0,goal=Number(state.settings.dailyGoalChars)||2000,goalPct=Math.min(100,Math.round(todayChars/goal*100));
  const lessonResults=(st.lessonResults||[]).slice(-5).reverse();
  return `<section class="welcome-row"><div><div class="eyebrow">ВАШ ПРОГРЕСС</div><h1>Статистика</h1><p>Смотрите, как регулярная практика превращается в навык.</p></div></section><section class="stats-cards"><div class="panel metric-card"><span>Набрано символов</span><b>${(st.totalChars||0).toLocaleString('ru-RU')}</b></div><div class="panel metric-card"><span>Точность</span><b>${accuracy()}<small>%</small></b></div><div class="panel metric-card"><span>Время практики</span><b>${Math.round((st.totalSeconds||0)/60)}<small>мин</small></b></div><div class="panel metric-card"><span>Занятий завершено</span><b>${st.sessions||0}</b></div></section><section class="panel goal-panel"><div><span>Цель на сегодня</span><b>${todayChars.toLocaleString('ru-RU')} / ${goal.toLocaleString('ru-RU')} знаков</b></div><div class="goal-track"><i style="width:${goalPct}%"></i></div><strong>${goalPct}%</strong></section><section class="panel chart-panel"><div class="panel-heading"><h2>Символы по дням</h2><span class="tiny-label">ПОСЛЕДНИЕ 7 ДНЕЙ</span></div><div class="chart">${bars.map(([d,n])=>`<div class="chart-col"><i style="--h:${Math.max(3,Math.round(n/max*100))}%"></i><i style="--h:${Math.max(2,Math.round(n/max*55))}%"></i><small>${esc(d.split('.')[0])}</small></div>`).join('')}</div></section><section class="panel heatmap-panel"><h2>Ошибки по клавишам</h2><p>Показаны ошибки на символе, который нужно было набрать. Подсказка: латинская клавиша / русская.</p><div class="heatmap">${labels.map(code=>{const n=counts[code]||0,level=n>=peak*.7&&n?'hot':n>=peak*.3&&n?'warm':'';const label=code==='space'?'␣':ruKeyLabels[code]||code;return `<span class="heat-key ${level}" title="${esc(code)} / ${esc(label)}: ${n}" aria-label="${esc(code)} ${n} ошибок">${esc(label)}</span>`;}).join('')}</div></section>${lessonResults.length?`<section class="panel recent-results"><div class="panel-heading"><h2>Последние уроки</h2><span class="tiny-label">ПОСЛЕДНИЕ 5</span></div>${lessonResults.map(r=>`<div class="result-row"><b>${esc(r.title)}</b><span>${r.language==='ru'?'RU':'EN'}</span><span>${r.wpm} сл/мин</span><span>${r.accuracy}% точность</span><span>${fmtTime(r.seconds)}</span></div>`).join('')}</section>`:''}`;
}
function timerText() { const sec = session.elapsed + (session.startedAt ? Math.floor((Date.now()-session.startedAt)/1000) : 0); return fmtTime(sec); }
function currentWpm() { const elapsed=session.elapsed+(session.startedAt?Math.floor((Date.now()-session.startedAt)/1000):0),sec=Math.max(1,elapsed-(session.speedElapsedBase||0)); return Math.round((Math.max(0,session.position-(session.startPosition||0))/5)/(sec/60)); }
const physicalKeys = ['`1234567890-=','qwertyuiop[]\\',"asdfghjkl;'",'zxcvbnm,./'];
const ruKeyLabels = { '`':'ё',q:'й',w:'ц',e:'у',r:'к',t:'е',y:'н',u:'г',i:'ш',o:'щ',p:'з','[':'х',']':'ъ',a:'ф',s:'ы',d:'в',f:'а',g:'п',h:'р',j:'о',k:'л',l:'д',';':'ж',"'":'э',z:'я',x:'ч',c:'с',v:'м',b:'и',n:'т',m:'ь',',':'б','.':'ю','/':'.' };
const shiftSymbols = {'!':'1','@':'2','#':'3','$':'4','%':'5','^':'6','&':'7','*':'8','(':'9',')':'0','_':'-','+':'=','{':'[','}':']','|':'\\',':':';','"':"'",'<':',','>':'.','?':'/','~':'`'};
const fingerForCode = {'1':'lpinky','q':'lpinky','a':'lpinky','z':'lpinky','2':'lring','w':'lring','s':'lring','x':'lring','3':'lmiddle','e':'lmiddle','d':'lmiddle','c':'lmiddle','4':'lindex','5':'lindex','r':'lindex','t':'lindex','f':'lindex','g':'lindex','v':'lindex','b':'lindex','6':'rindex','7':'rindex','y':'rindex','u':'rindex','h':'rindex','j':'rindex','n':'rindex','m':'rindex','8':'rmiddle','i':'rmiddle','k':'rmiddle',',':'rmiddle','9':'rring','o':'rring','l':'rring','.':'rring','0':'rpinky','-':'rpinky','=':'rpinky','p':'rpinky','[':'rpinky',']':'rpinky',';':'rpinky',"'":'rpinky','/':'rpinky','\\':'rpinky','`':'lpinky',' ':'thumb'};
const fingerNames = {lpinky:'мизинец левой руки',lring:'безымянный палец левой руки',lmiddle:'средний палец левой руки',lindex:'указательный палец левой руки',rindex:'указательный палец правой руки',rmiddle:'средний палец правой руки',rring:'безымянный палец правой руки',rpinky:'мизинец правой руки',thumb:'большой палец'};
function keyForCharacter(character, language) {
  if(!character)return '';
  const c=character.toLowerCase();
  if(c===' ')return 'space';
  if(language==='ru') { const found=Object.entries(ruKeyLabels).find(([,v])=>v===c); if(found)return found[0];const shifted=Object.entries(ruShiftSymbols).find(([,symbol])=>symbol===character);if(shifted)return shifted[0]; }
  return shiftSymbols[c] || c;
}
function typingCharMatches(input,expected){return input===(expected==='\n'?' ':expected);}
const physicalCodeChars = {Backquote:'`',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Backslash:'\\',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',Space:' '};
const ruShiftSymbols = {'`':'Ё','1':'!','2':'"','3':'№','4':';','5':'%','6':':','7':'?','8':'*','9':'(','0':')','-':'_','=':'+','/':',','\\':'/'};
function characterFromKeyEvent(event, language) {
  const base = event.code.startsWith('Key') ? event.code.slice(3).toLowerCase()
    : event.code.startsWith('Digit') ? event.code.slice(5)
    : physicalCodeChars[event.code];
  if (!base) return event.key?.length === 1 ? event.key : '';
  if (language === 'ru') {
    const ru = ruKeyLabels[base] || base;
    if (!event.shiftKey) return ru;
    if (/^[а-яё]$/i.test(ru)) return ru.toLocaleUpperCase('ru-RU');
    return ruShiftSymbols[base] || ru;
  }
  if (!event.shiftKey) return base;
  if (/^[a-z]$/.test(base)) return base.toUpperCase();
  return Object.keys(shiftSymbols).find(symbol => shiftSymbols[symbol] === base) || base;
}
function recordTypingError(expected,language,item=itemById(activeItemId)){
  session.errors=(session.errors||0)+1;session._countedErrors=session.errors;
  state.stats.totalErrors=(state.stats.totalErrors||0)+1;
  const key=keyForCharacter(expected==='\n'?' ':expected,language)||'unknown';state.stats.errorsByKey??={};state.stats.errorsByKey[key]=(state.stats.errorsByKey[key]||0)+1;
  if(item?.kind==='deck'){const card=item.cards?.[item.cardIndex||0];if(card)card.errors=(card.errors||0)+1;}
  const counter=$('#errorValue');if(counter)counter.textContent=session.errors;
  persistSoon();
}
function onTypingKeydown(event) {
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
  const el = event.currentTarget;
  if (event.key === 'Backspace') {
    event.preventDefault();
    el.value = [...el.value].slice(0, -1).join('');
    onTyping({ currentTarget: el });
    return;
  }
  const actual = event.key?.length === 1 ? event.key : '';
  const item = itemById(activeItemId);
  const language = item?.language || session.language || 'en';
  const full = session.mode === 'lesson' ? session.target
    : item?.kind === 'deck' ? (item.cards?.[item.cardIndex || 0]?.text || '')
    : item?.text || '';
  const target = full[session.base + el.value.length];
  if(item?.kind==='book'&&(item.viewStartOverride!=null||item.viewPage!==pageAtPosition(item,item.position||0))){event.preventDefault();return;}
  if (target === undefined) { event.preventDefault(); return; }
  const expected=target==='\n'?' ':target;
  const physical = characterFromKeyEvent(event, language);
  const character = actual === expected ? actual : physical === expected ? expected : actual || physical;
  if (!character) return;
  event.preventDefault();
  if (!session.startedAt) startTimer();
  if (character !== expected) {
    recordTypingError(expected,language,item);
    session.currentError = true;
    const position = session.mode === 'lesson' ? session.position : item?.kind === 'deck' ? item.cards?.[item.cardIndex || 0]?.position || 0 : item?.position || 0;
    updateTypingDisplay(full, position, true, language);
    return;
  }
  el.value += character;
  onTyping({ currentTarget: el });
}
function fingerForCharacter(character,language){return fingerForCode[keyForCharacter(character,language)]||'thumb';}
function typingLineMarkup(full,position,hasError=false){
  const start=Math.max(0,position-22),end=Math.min(full.length,start+54),line=full.slice(start,end),offset=position-start;
  let out='';for(let i=0;i<line.length;i++){const c=line[i],isCurrent=i===offset;const cls=isCurrent?`line-char current-char${hasError?' input-error':''}`:i<offset?'line-char typed-char':'line-char';out+=`<span class="${cls}">${c===' '||c==='\n'?'&nbsp;':c==='\t'?'→':esc(c)}</span>`;}
  if(offset>=line.length)out+='<span class="line-char current-char end-char">·</span>';
  return out;
}
function ensureBookPages(item){
  if(item.pageStarts?.length)return item.pageStarts;
  const text=item.text||'', starts=[0], limit=1150;let at=0;
  while(at<text.length){let end=Math.min(text.length,at+limit);if(end<text.length){const para=text.lastIndexOf('\n\n',end);const space=text.lastIndexOf(' ',end);const cut=para>at+limit*.55?para:space>at+limit*.55?space:end;end=cut;}if(end<=at)end=Math.min(text.length,at+limit);at=end;while(at<text.length&&/\s/.test(text[at]))at++;if(at<text.length)starts.push(at);}
  item.pageStarts=starts;return starts;
}
function pageAtPosition(item,position){const starts=ensureBookPages(item);let i=0;for(let n=1;n<starts.length&&starts[n]<=position;n++)i=n;return i;}
function chapterIndexAtPosition(item,position){let index=0;for(let i=1;i<(item.chapters||[]).length&&item.chapters[i].start<=position;i++)index=i;return index;}
function bookPageData(item){const starts=ensureBookPages(item),currentIndex=pageAtPosition(item,item.position||0),index=Math.max(0,Math.min(starts.length-1,item.viewPage??currentIndex)),start=starts[index],end=starts[index+1]??item.text.length;return {index,count:starts.length,currentIndex,start,end,chapterIndex:chapterIndexAtPosition(item,start),chapterStart:item.viewStartOverride};}
function renderBookPage(item,page){let out='';for(let i=page.start;i<page.end;i++){const c=item.text[i],classes=['book-char'];if(i<(item.position||0))classes.push('book-char-done');if(i===(item.position||0))classes.push('book-char-current');if(c==='\n')out+='<br>';else out+=`<span class="${classes.join(' ')}">${c===' '?'&nbsp;':esc(c)}</span>`;}return out;}
function updateBookPreview(item){const page=bookPageData(item);if(page.index!==page.currentIndex){item.viewPage=page.currentIndex;item.viewStartOverride=undefined;}
  const next=bookPageData(item),label=$('.book-reader-heading .tiny-label'),body=$('#bookPageText');if(label)label.textContent=`СТРАНИЦА ${next.index+1} / ${next.count}`;if(body)body.innerHTML=renderBookPage(item,next);
  const chapterSelect=$('#bookChapterSelect');if(chapterSelect)chapterSelect.value=String(chapterIndexAtPosition(item,item.position||0));
  $$('[data-action="page-prev"]').forEach(x=>x.disabled=next.index===0);$$('[data-action="page-next"]').forEach(x=>x.disabled=next.index>=next.count-1);
  const choices=$('.page-choice');if(choices&&next.index===next.currentIndex)choices.remove();
}
function resetTypingAt(position){session.base=position;session.position=position;session.typed='';session.lastCountedLength=0;session.currentError=false;session._lastCorrect=0;session._lastDailyCorrect=0;const input=$('#typingInput');if(input)input.value='';}
function moveBookPage(delta){const item=itemById(activeItemId);if(!item||item.kind!=='book')return;const p=bookPageData(item);item.viewPage=Math.max(0,Math.min(p.count-1,p.index+delta));item.viewStartOverride=undefined;resetTypingAt(item.position||0);render();$('#typingInput')?.blur();}
function startAtDisplayedPage(){const item=itemById(activeItemId);if(!item||item.kind!=='book')return;const page=bookPageData(item),position=page.chapterStart??page.start;item.position=position;item.viewPage=pageAtPosition(item,position);item.viewStartOverride=undefined;resetTypingAt(position);session.startPosition=position;session.speedElapsedBase=session.elapsed+(session.startedAt?Math.floor((Date.now()-session.startedAt)/1000):0);session.errors=0;session._countedErrors=0;persistSoon();render();$('#typingInput')?.focus();}
function continueAtSavedPosition(){const item=itemById(activeItemId);if(!item||item.kind!=='book')return;item.viewStartOverride=undefined;item.viewPage=pageAtPosition(item,item.position||0);resetTypingAt(item.position||0);render();$('#typingInput')?.focus();}
function handSvg(side,active){
  const ids=side==='left'?['lpinky','lring','lmiddle','lindex']:['rpinky','rring','rmiddle','rindex'];
  return `<svg class="hand-svg ${side==='right'?'hand-mirror':''}" viewBox="0 0 132 126" aria-label="${side==='left'?'Левая':'Правая'} рука"><g class="hand-shape"><rect class="hand-finger ${ids[0]} ${active===ids[0]?'active':''}" x="10" y="37" width="19" height="54" rx="9"/><rect class="hand-finger ${ids[1]} ${active===ids[1]?'active':''}" x="33" y="17" width="20" height="69" rx="10"/><rect class="hand-finger ${ids[2]} ${active===ids[2]?'active':''}" x="57" y="7" width="20" height="79" rx="10"/><rect class="hand-finger ${ids[3]} ${active===ids[3]?'active':''}" x="81" y="23" width="19" height="65" rx="9"/><path class="hand-finger thumb ${active==='thumb'?'active':''}" d="M93 76c10-16 21-19 29-12 7 7 2 17-6 24l-16 17-17-13z"/><path class="hand-palm" d="M17 74c10-10 20-12 31-10l27 5c12 2 21 10 22 22 1 18-7 29-24 32l-32 2c-18 0-28-11-30-25-2-10 0-19 6-26z"/></g></svg>`;
}
function keyboardMarkup(language,target){
  const activeCode=keyForCharacter(target,language),shiftRequired=Boolean(target&&(target!==target.toLowerCase()||Object.hasOwn(shiftSymbols,target))),rows=physicalKeys.map((row,index)=>`<div class="typing-key-row row-${index}">${[...row].map(code=>{const label=language==='ru'?(ruKeyLabels[code]||code):code, finger=fingerForCode[code]||'thumb';return `<span class="typing-key ${finger} ${code===activeCode?'key-next':''}" data-code="${esc(code)}">${esc(label)}</span>`;}).join('')}</div>`).join('');
  return `<div class="typing-keyboard" aria-label="Виртуальная клавиатура">${rows}<div class="typing-key-row modifiers"><span class="typing-key lpinky ${shiftRequired?'key-next':''}" data-code="shift-left">Shift</span><span class="typing-key thumb key-space ${activeCode==='space'?'key-next':''}" data-code="space">space</span><span class="typing-key rpinky" data-code="shift-right">Shift</span></div></div>`;
}
function trainerPage() {
  const item = session.mode === 'book' ? itemById(activeItemId) : null;
  const title = item?.title || (session.mode === 'lesson' ? `${session.language === 'ru' ? 'Русский' : 'English'} · ${starterLessons[session.language][session.lessonIndex].title}` : 'Свободная практика');
  const full = item ? (item.kind === 'deck' ? (item.cards?.[item.cardIndex || 0]?.text || item.text) : item.text) : session.target;
  const pos = item ? (item.kind === 'deck' ? item.cards?.[item.cardIndex||0]?.position || 0 : item.position || 0) : session.position;
  const bookPage = item?.kind === 'book' ? bookPageData(item) : null;
  const language=item?.language||session.language||'en', target=full[pos]||'', finger=fingerForCharacter(target,language);
  const progressPercent=full.length?Math.min(100,Math.floor(pos/full.length*100)):0;
  const stats = `<div class="trainer-stats ${state.settings.showTrainerStats===false?'stats-hidden':''}"><div class="stat-item"><span>Время</span><b id="timerValue">${timerText()}</b></div><div class="stat-item"><span>Прогресс</span><b id="progressValue">${progressPercent}<small>%</small></b></div><div class="stat-item"><span>Скорость</span><b id="speedValue">${currentWpm()}<small>сл/мин</small></b></div><div class="stat-item"><span>Ошибки</span><b id="errorValue">${session.errors}</b></div></div>`;
  const keyLabel=target===' '?'ПРОБЕЛ':target||'КОНЕЦ';
  return `<div class="trainer-top"><div class="trainer-title"><div class="eyebrow">${item?.kind === 'deck' ? 'КАРТОЧКИ ANKI' : session.mode === 'lesson' ? 'УРОК СЛЕПОЙ ПЕЧАТИ' : 'ЧТЕНИЕ И ПРАКТИКА'}</div><h1>${esc(title)}</h1><p>${item?.kind === 'deck' ? `Карточка ${(item.cardIndex||0)+1} из ${item.cards?.length||0}` : item?.author ? esc(item.author) : 'Набирайте текст по одному символу, без прокрутки страницы'}</p></div><div class="trainer-controls"><button class="button ghost small" data-action="toggle-stats">${state.settings.showTrainerStats===false?'Показать метрики':'Скрыть метрики'}</button><button class="button secondary small" data-action="pause">Ⅱ&nbsp; Пауза</button><button class="button ghost small" data-action="exit">←&nbsp; К библиотеке</button></div></div>${stats}
  ${bookPage ? `<section class="panel book-reader"><div class="book-reader-heading"><span class="tiny-label">СТРАНИЦА ${bookPage.index+1} / ${bookPage.count}</span><div class="book-page-controls">${item.chapters?.length>1?`<select id="bookChapterSelect" aria-label="Перейти к главе">${item.chapters.map((chapter,i)=>`<option value="${i}" ${i===chapterIndexAtPosition(item,item.viewStartOverride??(item.position||0))?'selected':''}>${esc(chapter.title)}</option>`).join('')}</select>`:''}<button class="button ghost small" data-action="page-prev" ${bookPage.index===0?'disabled':''}>←</button><button class="button ghost small" data-action="page-next" ${bookPage.index>=bookPage.count-1?'disabled':''}>→</button></div></div><div id="bookPageText" class="book-page-text">${renderBookPage(item,bookPage)}</div>${bookPage.index!==bookPage.currentIndex||bookPage.chapterStart!=null?`<div class="page-choice"><button class="button primary small" data-action="start-page">С этой</button><button class="button secondary small" data-action="continue-saved">Продолжить</button></div>`:''}</section>` : ''}
  <section class="panel typing-focus-panel"><div class="typing-field-label"><span>${item?.kind==='deck'?'ТЕКСТ КАРТОЧКИ':'ТЕКСТ УПРАЖНЕНИЯ'}</span><span class="field-mode">${language==='ru'?'РУССКАЯ · ЙЦУКЕН':'ENGLISH · QWERTY'}</span></div><div class="typing-line-shell" id="typingSurface" title="Нажмите сюда и печатайте"><div class="typing-line" id="typingLine">${typingLineMarkup(full,pos,session.currentError)}</div><input id="typingInput" class="typing-capture" type="text" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Поле слепой печати" autofocus></div>
  <div class="next-finger"><span>СЛЕДУЮЩИЙ СИМВОЛ <kbd id="nextKeyHint">${esc(keyLabel)}</kbd></span><span class="finger-label" id="fingerHint">${fingerNames[finger]}</span></div>
  <div class="hands-keyboard"><div class="hand-wrap left-hand">${handSvg('left',finger)}<small>ЛЕВАЯ РУКА</small></div><div id="keyboardGuide">${keyboardMarkup(language,target)}</div><div class="hand-wrap right-hand">${handSvg('right',finger)}<small>ПРАВАЯ РУКА</small></div></div>
  <div class="guide-toggle-row"><button class="button ghost small" data-action="guide-toggle">${state.settings.showGuide===false?'Показать подсказку':'Скрыть подсказку'}</button></div>
  <div class="typing-footer"><span>Набрано: <b id="typedCounter">${Math.max(0,pos-(session.startPosition||0))} символов</b><span class="line-tip"> · правильные символы бледнеют и уходят влево</span></span><div class="session-actions"><button class="button secondary small" data-action="restart">↺&nbsp; Сначала фрагмент</button>${item?.kind === 'deck' ? '<button class="button primary small" data-action="next-card">Следующая карточка&nbsp; →</button>' : ''}</div></div></section><div class="typing-hint">Клавиша подсвечена на клавиатуре, нужный палец — на схеме рук.</div>`;
}
function calcSessionAccuracy() { const ok=session.mode==='lesson'?Math.max(0,session.position):Math.max(0,session.position-(session.startPosition||0)),er=session.errors||0;return ok+er?Math.round(ok/(ok+er)*100):100; }
function render() {
  applySettings();
  if (currentView === 'trainer') { $('#content').innerHTML = trainerPage(); $('#crumb').textContent = 'Занятие'; }
  else { $('#content').innerHTML = ({ home: homePage, lessons: lessonPage, library: libraryPage, stats: statsPage }[currentView] || homePage)(); $('#crumb').textContent = ({home:'Главная',lessons:'Уроки',library:'Моя библиотека',stats:'Статистика'}[currentView] || 'Главная'); }
  $('#libraryCount').textContent = state.items.length || '';
  bindContent();
}
function bindContent() {
  $$('[data-view]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); $$('.nav-item').forEach(x => x.classList.toggle('active',x.dataset.view===el.dataset.view)); setView(el.dataset.view); }));
  $$('[data-action="import"]').forEach(el => el.addEventListener('click', openImport));
  $$('[data-open-item]').forEach(el => el.addEventListener('click', () => startItem(el.dataset.openItem)));
  $$('.language-tab[data-language]').forEach(el => el.addEventListener('click', () => { lessonLang = el.dataset.language; render(); }));
  $$('[data-start-lesson]').forEach(el => el.addEventListener('click', () => startLesson(+el.dataset.startLesson, el.dataset.language)));
  $$('[data-action="resume-lesson"]').forEach(el=>el.addEventListener('click',resumeLesson));
  $$('[data-lesson]').forEach(el => el.addEventListener('click', () => { if (+el.dataset.lesson <= (state.lessonProgress[el.dataset.lessonLang] || 0)) startLesson(+el.dataset.lesson, el.dataset.lessonLang); }));
  $$('[data-action="pause"]').forEach(el => el.addEventListener('click', pauseSession));
  $$('[data-action="exit"]').forEach(el => el.addEventListener('click', () => { stopTimer(false); saveCurrentPosition(); state.stats.sessions=(state.stats.sessions||0)+1; persist(); currentView = 'library'; render(); }));
  $$('[data-action="restart"]').forEach(el => el.addEventListener('click', restartFragment));
  $$('[data-action="next-card"]').forEach(el => el.addEventListener('click', nextCard));
  $$('[data-action="guide-toggle"]').forEach(el => el.addEventListener('click',()=>{state.settings.showGuide=state.settings.showGuide===false;document.body.classList.toggle('guide-hidden',state.settings.showGuide===false);el.textContent=state.settings.showGuide?'Скрыть подсказку':'Показать подсказку';persist();}));
  $$('[data-action="page-prev"]').forEach(el => el.addEventListener('click',()=>moveBookPage(-1)));
  $$('[data-action="page-next"]').forEach(el => el.addEventListener('click',()=>moveBookPage(1)));
  $('#bookChapterSelect')?.addEventListener('change',e=>{const item=itemById(activeItemId),chapter=item?.chapters?.[+e.target.value];if(!item||!chapter)return;item.viewStartOverride=chapter.start;item.viewPage=pageAtPosition(item,chapter.start);resetTypingAt(item.position||0);render();$('#typingInput')?.blur();});
  $$('[data-action="start-page"]').forEach(el => el.addEventListener('click',startAtDisplayedPage));
  $$('[data-action="continue-saved"]').forEach(el => el.addEventListener('click',continueAtSavedPosition));
  $$('[data-action="toggle-stats"]').forEach(el => el.addEventListener('click',()=>{state.settings.showTrainerStats=state.settings.showTrainerStats===false;$('.trainer-stats')?.classList.toggle('stats-hidden',!state.settings.showTrainerStats);el.textContent=state.settings.showTrainerStats?'Скрыть метрики':'Показать метрики';persist();}));
  $('#typingInput')?.addEventListener('keydown', onTypingKeydown);
  $('#typingInput')?.addEventListener('input', onTyping);
  $('#typingSurface')?.addEventListener('click', () => $('#typingInput')?.focus());
}
function openImport() { $('#importDialog').showModal(); }
function startTimer() { if (session.startedAt) return; session.startedAt = Date.now(); clearInterval(tickHandle); let checkpoint=Date.now(); tickHandle = setInterval(() => { const t = $('#timerValue'); if (t) t.textContent = timerText();const speed=$('#speedValue');if(speed)speed.innerHTML=`${currentWpm()}<small>сл/мин</small>`;if(Date.now()-checkpoint>=5000){checkpoint=Date.now();saveCurrentPosition();} }, 500); }
function stopTimer(save = true) { if (session.startedAt) { const delta=Math.floor((Date.now()-session.startedAt)/1000); session.elapsed += delta; state.stats.totalSeconds=(state.stats.totalSeconds||0)+delta; } session.startedAt = null; clearInterval(tickHandle); tickHandle = null; if (save) saveCurrentPosition(); }
function startItem(id) {
  const item = itemById(id); if (!item) return;
  activeItemId = id; item.updatedAt = Date.now();
  if (item.kind === 'deck') {
    const cards = item.cards || []; if (!cards.length) return showToast('В этой колоде нет карточек с выбранными полями.');
    const cardPosition=cards[item.cardIndex||0]?.position||0;
    session = { target: '', position: cardPosition, errors: 0, startedAt: null, elapsed: item.elapsed || 0, speedElapsedBase:item.elapsed||0, base: cardPosition, startPosition: cardPosition, typed: '', lastCountedLength: 0, mode: 'book', lessonIndex: 0, language: item.language || 'en' };
    currentView = 'trainer'; startTimer(); render(); $('#typingInput')?.focus(); return;
  }
  if(item.kind==='book'){ensureBookPages(item);item.chapters??=detectChapters(item.text||'');item.viewPage=pageAtPosition(item,item.position||0);}
  session = { target: '', position: item.position || 0, errors: 0, startedAt: null, elapsed: item.elapsed || 0, speedElapsedBase:item.elapsed||0, base: item.position || 0, startPosition: item.position || 0, typed: '', lastCountedLength: 0, mode: 'book', lessonIndex: 0, language: item.language || 'ru' };
  currentView = 'trainer'; startTimer(); render(); $('#typingInput')?.focus();
}
function startLesson(index, language) {
  const l = starterLessons[language][index];
  session = { target: l.text, position: 0, errors: 0, startedAt: null, elapsed: 0, speedElapsedBase:0, base: 0, startPosition: 0, typed: '', lastCountedLength: 0, mode: 'lesson', lessonIndex: index, language };
  state.lessonSession={language,index,position:0,elapsed:0,errors:0};activeItemId = null; currentView = 'trainer'; startTimer(); persist();render(); $('#typingInput')?.focus();
}
function resumeLesson(){const saved=state.lessonSession;if(!saved)return;const lesson=starterLessons[saved.language]?.[saved.index];if(!lesson){state.lessonSession=null;persist();return showToast('Сохранённый урок больше недоступен.');}const position=Math.max(0,Math.min(lesson.text.length,saved.position||0));session={target:lesson.text,position,errors:saved.errors||0,startedAt:null,elapsed:saved.elapsed||0,speedElapsedBase:saved.elapsed||0,base:position,startPosition:position,typed:'',lastCountedLength:0,mode:'lesson',lessonIndex:saved.index,language:saved.language,_lastCorrect:0,_countedErrors:saved.errors||0};activeItemId=null;currentView='trainer';startTimer();render();$('#typingInput')?.focus();}
function saveCurrentPosition() {
  if(session.mode==='lesson'&&session.target){state.lessonSession={language:session.language,index:session.lessonIndex,position:session.position,elapsed:session.elapsed+(session.startedAt?Math.floor((Date.now()-session.startedAt)/1000):0),errors:session.errors||0};persist();return;}
  const item = itemById(activeItemId); if (item) { if (item.kind !== 'deck') item.position = session.position; else item.cardIndex = item.cardIndex || 0; item.elapsed = session.elapsed + (session.startedAt ? Math.floor((Date.now()-session.startedAt)/1000) : 0); item.updatedAt = Date.now(); persist(); }
}
function onTyping(e) {
  const el = e.currentTarget; let val = el.value;
  if (!session.startedAt) startTimer();
  let full = session.mode === 'lesson' ? session.target : (itemById(activeItemId)?.text || '');
  let pos = session.mode === 'lesson' ? session.position : (itemById(activeItemId)?.position || 0);
  if (itemById(activeItemId)?.kind === 'deck') full = itemById(activeItemId)?.cards?.[itemById(activeItemId).cardIndex || 0]?.text || '';
  const previous=session.typed||'';let common=0;while(common<previous.length&&common<val.length&&previous[common]===val[common])common++;
  let rejectedInput=false;
  if(val.length>common){for(let i=common;i<val.length;i++)if(!typingCharMatches(val[i],full[session.base+i])){const expected=full[session.base+i];val=val.slice(0,i);el.value=val;if(expected!==undefined){const activeItem=itemById(activeItemId);recordTypingError(expected,activeItem?.language||session.language,activeItem);rejectedInput=true;}break;}}
  session.lastCountedLength=val.length;
  session.typed = val;
  let correct = 0; while (correct < val.length && typingCharMatches(val[correct],full[session.base + correct])) correct++;
  session.currentError=rejectedInput||val.length>correct;
  let absolutePosition = session.base + correct;
  if (session.mode === 'lesson') session.position = absolutePosition;
  else { const item = itemById(activeItemId); if (item?.kind === 'deck') { item.cards[item.cardIndex||0].position = absolutePosition; session.position = absolutePosition; } else if (item) { item.position = absolutePosition; session.position = absolutePosition; } }
  const lessonDone = session.mode === 'lesson' && correct === full.length - session.base && correct > 0;
  const deckItem = itemById(activeItemId);
  const deckTarget = deckItem?.kind === 'deck' ? (deckItem.cards?.[deckItem.cardIndex||0]?.text || '') : '';
  const cardDone = Boolean(deckTarget && correct === deckTarget.length - session.base && correct > 0);
  let committedChunk = false;
  if (session.mode === 'book' && deckItem?.kind !== 'deck' && correct >= 90 && correct === val.length) {
    session.base = absolutePosition; session.typed = ''; session.lastCountedLength = 0; el.value = ''; committedChunk = true;
  }
  const today = new Date().toLocaleDateString('ru-RU');
  const typedCorrect = Math.max(0, absolutePosition - session.base);
  state.stats.totalChars = (state.stats.totalChars || 0) + Math.max(0, correct - (session._lastCorrect || 0)); session._lastCorrect = correct;
  state.stats.totalErrors = (state.stats.totalErrors || 0) + Math.max(0, session.errors - (session._countedErrors || 0)); session._countedErrors = session.errors;
  state.stats.daily[today] = (state.stats.daily[today] || 0) + Math.max(0, correct - (session._lastDailyCorrect || 0)); session._lastDailyCorrect = correct;
  if (committedChunk) { session._lastCorrect = 0; session._lastDailyCorrect = 0; }
  const activePos=session.mode==='lesson'?session.position:(deckItem?.kind==='deck'?deckItem.cards?.[deckItem.cardIndex||0]?.position||0:(itemById(activeItemId)?.position||0));
  updateTypingDisplay(full,activePos,session.currentError,deckItem?.language||session.language);
  const counter = $('#typedCounter'); if (counter) counter.textContent = `${Math.max(0,activePos-(session.startPosition||0))} символов`;
  const progressValue=$('#progressValue');if(progressValue)progressValue.innerHTML=`${full.length?Math.min(100,Math.floor(activePos/full.length*100)):0}<small>%</small>`;
  const speed=$('#speedValue');if(speed)speed.innerHTML=`${currentWpm()}<small>сл/мин</small>`;
  const err=$('#errorValue');if(err)err.textContent=session.errors;
  if (activeItemId) { const item = itemById(activeItemId); if (item) item.updatedAt = Date.now(); }
  if (lessonDone) { finishLesson(); return; }
  if (cardDone) { persistSoon(); showToast('Карточка пройдена'); nextCard(); return; }
  persistSoon();
}
function updateTypingDisplay(full,position,hasError,language) {
  const line=$('#typingLine');if(!line)return;line.innerHTML=typingLineMarkup(full,position,hasError);
  const rawTarget=full[position]||'',target=rawTarget==='\n'?' ':rawTarget,finger=fingerForCharacter(target,language),key=keyForCharacter(target,language);
  const hint=$('#nextKeyHint');if(hint)hint.textContent=target===' '?'ПРОБЕЛ':target||'КОНЕЦ';
  const fingerHint=$('#fingerHint');if(fingerHint)fingerHint.textContent=fingerNames[finger];
  $$('.hand-finger').forEach(x=>x.classList.toggle('active',x.classList.contains(finger)));
  const shift=Boolean(target&&(target!==target.toLowerCase()||Object.hasOwn(shiftSymbols,target)));
  $$('.typing-key').forEach(x=>x.classList.toggle('key-next',x.dataset.code===key||(shift&&x.dataset.code==='shift-left')));
  const item=itemById(activeItemId);if(item?.kind==='book')updateBookPreview(item);
}
function finishLesson() {
  stopTimer(false);const result={language:session.language,index:session.lessonIndex,title:starterLessons[session.language][session.lessonIndex].title,wpm:currentWpm(),accuracy:calcSessionAccuracy(),errors:session.errors||0,seconds:session.elapsed,completedAt:Date.now()};state.stats.lessonResults??=[];state.stats.lessonResults.push(result);state.stats.lessonResults=state.stats.lessonResults.slice(-100);state.lessonSession=null;state.lessonProgress[session.language] = Math.max(state.lessonProgress[session.language]||0,session.lessonIndex+1); state.stats.sessions++; persist(); showToast('Урок завершён! Отличная работа.'); currentView='lessons';render();
}
function pauseSession() { stopTimer(); $('#typingInput')?.blur(); showToast(`Пауза · прогресс сохранён (${timerText()})`); }
function restartFragment() {
  session.typed='';session.lastCountedLength=0;session._lastCorrect=0;session._countedErrors=0;session.errors=0;
  session._lastDailyCorrect=0;
  if (session.mode === 'lesson') session.position=session.base;
  else { const item=itemById(activeItemId); if(item?.kind==='deck'){item.cards[item.cardIndex||0].position=0;session.base=0;session.position=0;session.startPosition=0;}else if(item){item.position=session.base;session.position=session.base;} }
  render();$('#typingInput')?.focus();
}
function nextCard() {
  const item=itemById(activeItemId);if(!item?.cards?.length)return;
  const current=item.cardIndex||0,count=item.cards.length;
  if(item.frequency==='sequence')item.cardIndex=(current+1)%count;
  else {
    const candidates=item.cards.map((card,index)=>({index,weight:index===current?0:item.frequency==='mistakes'?1+(card.errors||0):1})).filter(x=>x.weight>0);
    const total=candidates.reduce((sum,x)=>sum+x.weight,0);let ticket=Math.random()*total;item.cardIndex=candidates.find(x=>(ticket-=x.weight)<=0)?.index??current;
  }
  const position=item.cards[item.cardIndex]?.position||0;session.typed='';session.lastCountedLength=0;session.errors=0;session._lastCorrect=0;session._countedErrors=0;session.base=position;session.position=position;session.startPosition=position;persist();render();$('#typingInput')?.focus();
}

async function readZip(file) {
  const bytes = new Uint8Array(await file.arrayBuffer()), dv = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength); let eocd=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65558);i--) if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;}
  if(eocd<0) throw Error('ZIP-архив не найден.');
  const total=dv.getUint16(eocd+10,true), start=dv.getUint32(eocd+16,true), files=new Map();let ptr=start;
  for(let n=0;n<total;n++){
    if(dv.getUint32(ptr,true)!==0x02014b50)break;
    const method=dv.getUint16(ptr+10,true), compressed=dv.getUint32(ptr+20,true), nameLen=dv.getUint16(ptr+28,true), extraLen=dv.getUint16(ptr+30,true), commentLen=dv.getUint16(ptr+32,true), local=dv.getUint32(ptr+42,true), name=new TextDecoder().decode(bytes.slice(ptr+46,ptr+46+nameLen));
    files.set(name,{method,compressed,local,nameLen,extraLen});ptr+=46+nameLen+extraLen+commentLen;
  }
  return { files, async get(name) { const x=files.get(name);if(!x)return null;const l=x.local;if(dv.getUint32(l,true)!==0x04034b50)throw Error('Повреждённая запись архива.');const nl=dv.getUint16(l+26,true),el=dv.getUint16(l+28,true),begin=l+30+nl+el,raw=bytes.slice(begin,begin+x.compressed);if(x.method===0)return raw;if(x.method!==8)throw Error('Этот способ сжатия архива пока не поддерживается.');if(!('DecompressionStream'in window))throw Error('Браузер не поддерживает распаковку EPUB.');const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));return new Uint8Array(await new Response(stream).arrayBuffer());} };
}
function stripHtml(html) { const doc=new DOMParser().parseFromString(String(html||''),'text/html');doc.querySelectorAll('script,style,link,meta,svg,nav,header,footer,iframe,object,embed,form,noscript,template,canvas,video,audio,source,track').forEach(x=>x.remove());doc.querySelectorAll('[hidden],[aria-hidden="true"]').forEach(x=>x.remove());return (doc.body?.innerText||doc.documentElement.textContent||'').replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim(); }
function byLocalName(root,name){return [...root.getElementsByTagNameNS('*',name)];}
async function extractEpub(file) {
  const zip=await readZip(file), c=await zip.get('META-INF/container.xml');if(!c)throw Error('В EPUB не найден файл навигации.');
  const cont=new DOMParser().parseFromString(new TextDecoder().decode(c),'application/xml'), opfPath=byLocalName(cont,'rootfile')[0]?.getAttribute('full-path');if(!opfPath)throw Error('Не удалось прочитать структуру EPUB.');
  const opfBytes=await zip.get(opfPath);if(!opfBytes)throw Error('Не найден файл описания EPUB.');const opf=new DOMParser().parseFromString(new TextDecoder().decode(opfBytes),'application/xml');
  const base=opfPath.split('/').slice(0,-1).join('/'), items=new Map();byLocalName(opf,'item').forEach(x=>items.set(x.getAttribute('id'),x.getAttribute('href')));
  const metadata=byLocalName(opf,'metadata')[0],title=byLocalName(metadata||opf,'title')[0]?.textContent?.trim()||file.name.replace(/\.epub$/i,''),author=byLocalName(metadata||opf,'creator')[0]?.textContent?.trim()||'';
  const parts=[];for(const ref of byLocalName(opf,'itemref')){const href=items.get(ref.getAttribute('idref'));if(!href)continue;const path=(base?base+'/':'')+decodeURIComponent(href).split('#')[0];const content=await zip.get(path);if(content)parts.push(stripHtml(new TextDecoder().decode(content)));}
  const text=parts.filter(Boolean).join('\n\n');if(!text)throw Error('В EPUB не удалось найти читаемый текст.');return {title,author,text};
}
function extractFb2(xmlSource) {
  const doc=new DOMParser().parseFromString(xmlSource,'application/xml');if(doc.querySelector('parsererror'))throw Error('FB2-файл повреждён или содержит ошибку XML.');
  const title=byLocalName(doc,'book-title')[0]?.textContent?.trim()||'';const author=byLocalName(doc,'title-info').flatMap(t=>byLocalName(t,'author')).map(a=>byLocalName(a,'first-name').concat(byLocalName(a,'middle-name'),byLocalName(a,'last-name')).map(x=>x.textContent.trim()).filter(Boolean).join(' ')).join(', ');
  const bodies=byLocalName(doc,'body').filter(x=>!x.hasAttribute('name')||x.getAttribute('name')!=='notes');const text=bodies.map(x=>xmlReadableText(x)).join('\n\n').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();if(!text)throw Error('В FB2 не найден текст книги.');return {title,author,text};
}
function xmlReadableText(root){const blocks=new Set(['p','title','subtitle','v','poem','stanza','cite','epigraph','text-author','empty-line','section']);let out='';const walk=node=>{if(node.nodeType===Node.TEXT_NODE){out+=node.nodeValue||'';return;}if(node.nodeType!==Node.ELEMENT_NODE)return;const name=(node.localName||'').toLowerCase();if(['binary','script','style','annotation','history','coverpage'].includes(name))return;if(blocks.has(name)&&out&&!out.endsWith('\n'))out+='\n';for(const child of node.childNodes)walk(child);if(blocks.has(name)&&!out.endsWith('\n'))out+='\n';};walk(root);return out.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();}
function parseDelimited(text,delimiter) {
  const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){cell+='"';i++;}else q=!q;}else if(c===delimiter&&!q){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
// Minimal read-only SQLite table reader for legacy Anki packages (collection.anki2 / .anki21).
class SqliteReader {
  constructor(buffer){this.b=new Uint8Array(buffer);this.v=new DataView(buffer);this.pageSize=this.v.getUint16(16,false)||65536;this.usable=this.pageSize-this.b[20];this.cache=new Map();}
  varint(p){let x=0;for(let i=0;i<8;i++){const c=p[i];x=x*128+(c&127);if(!(c&128))return [x,i+1];}return [x*256+p[8],9];}
  page(n){if(this.cache.has(n))return this.cache.get(n);const x=this.b.slice((n-1)*this.pageSize,n*this.pageSize);this.cache.set(n,x);return x;}
  readTree(n,out=[]){const p=this.page(n),off=n===1?100:0,type=p[off],header=type===5?12:8,count=(p[off+3]<<8)|p[off+4];if(type===13){for(let i=0;i<count;i++){const ptr=(p[off+header+i*2]<<8)|p[off+header+i*2+1];out.push(this.leafCell(p,ptr));}}else if(type===5){for(let i=0;i<count;i++){const ptr=(p[off+header+i*2]<<8)|p[off+header+i*2+1],child=this.u32(p,ptr);this.readTree(child,out);}this.readTree(this.u32(p,off+8),out);}return out;}
  u32(p,i){return (((p[i]*0x1000000)+(p[i+1]<<16)+(p[i+2]<<8)+p[i+3])>>>0);}
  leafCell(page,p){let [size,n]=this.varint(page.subarray(p));let [rowid,n2]=this.varint(page.subarray(p+n));let at=p+n+n2,local=size;if(size>this.usable-35){const min=Math.floor(((this.usable-12)*32)/255)-23,max=this.usable-35;local=min+((size-min)%(this.usable-4));if(local>max)local=min;}let bytes=page.slice(at,at+local);if(local<size){let ov=this.u32(page,at+local),parts=[bytes];while(ov){const q=this.page(ov),next=this.u32(q,0),remaining=size-parts.reduce((a,b)=>a+b.length,0),chunk=q.slice(4,Math.min(this.pageSize,4+remaining));parts.push(chunk);ov=next;}bytes=new Uint8Array(parts.reduce((a,b)=>a+b.length,0));let k=0;for(const x of parts){bytes.set(x,k);k+=x.length;}}return {rowid,values:this.record(bytes)};}
  record(bytes){let pos=0;const [headerSize,headLen]=this.varintAt(bytes,pos);pos=headLen;const serial=[];while(pos<headerSize){const [s,n]=this.varintAt(bytes,pos);serial.push(s);pos+=n;}let data=headerSize,vals=[];for(const s of serial){let len=0;if(s>=13){len=Math.floor((s-13)/2);}else if(s===1)len=1;else if(s===2)len=2;else if(s===3)len=3;else if(s===4)len=4;else if(s===5)len=6;else if(s===6||s===7)len=8;else if(s===8||s===9)len=0;let raw=bytes.slice(data,data+len);data+=len;if(s===0)vals.push(null);else if(s===8)vals.push(0);else if(s===9)vals.push(1);else if(s===10||s===11)vals.push(null);else if(s>=12)vals.push(s%2===0?raw:this.decodeText(raw));else {let v=0;for(const b of raw)v=v*256+b;if((raw[0]&128)&&len<8)v-=Math.pow(256,len*8);vals.push(v);}}return vals;}
  varintAt(b,p){let x=0;for(let i=0;i<8;i++){const c=b[p+i];x=x*128+(c&127);if(!(c&128))return [x,i+1];}return [x*256+b[p+8],9];}
  decodeText(a){return new TextDecoder('utf-8').decode(a);}
  tables(){const rows=this.readTree(1),m={};for(const r of rows){const v=r.values;if(v[0]==='table'&&v[2])m[v[1]]={root:+v[3],sql:v[4]};}return m;}
  table(root){return this.readTree(root).map(x=>x.values);}
}
async function parseApkg(file) {
  const zip=await readZip(file);let dbFile=zip.files.has('collection.anki2')?'collection.anki2':zip.files.has('collection.anki21')?'collection.anki21':null;
  if(!dbFile){if(zip.files.has('collection.anki21b'))throw Error('Эта колода использует новый сжатый формат Anki (.anki21b). В первой версии TypeLit импортирует SQLite-формат collection.anki2 или collection.anki21.');throw Error('В APKG не найдена база карточек Anki.');}
  const raw=await zip.get(dbFile);if(new TextDecoder().decode(raw.slice(0,15))!=='SQLite format 3')throw Error('База колоды сжата или использует неподдерживаемый формат Anki.');const sql=new SqliteReader(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),tables=sql.tables();
  if(!tables.notes||!tables.cards||!tables.col)throw Error('Не удалось распознать структуру этой колоды Anki.');
  const col=sql.table(tables.col.root)[0],models=JSON.parse(col?.[9]||'{}'),decks=JSON.parse(col?.[10]||'{}'),notes=sql.table(tables.notes.root),cards=sql.table(tables.cards.root);
  const noteMap=new Map();for(const n of notes){const m=models[String(n[2])]||{},fields=(n[6]||'').split('\x1f'),names=(m.flds||[]).map(x=>x.name);noteMap.set(n[0],{fields,names});}
  const output=[],seenNotes=new Set();for(const c of cards){const n=noteMap.get(c[1]);if(!n||seenNotes.has(c[1]))continue;const names=n.names.length?n.names:n.fields.map((_,i)=>`Поле ${i+1}`);const text=n.fields.map((v,i)=>`${names[i]}: ${plainFieldValue(v)}`).filter(x=>x.split(': ')[1]).join('\n');if(text){output.push({text,fields:n.fields,names,deck:decks[String(c[2])]?.name||'Колода',cardId:c[0],noteId:c[1]});seenNotes.add(c[1]);}}
  if(!output.length)throw Error('В колоде не найдены карточки с текстом.');return {cards:output,title:file.name.replace(/\.apkg$/i,''),fields:[...new Set(output.flatMap(c=>c.names))]};
}
async function handleFile(file) {
  if(!file)return;const ext=file.name.split('.').pop().toLowerCase();
  try {
    if(ext==='apkg'){
      showToast('Читаю файл колоды…');const deck=await parseApkg(file);pendingAnki={...deck,fileName:file.name,selectedFields:deck.fields.slice(0,Math.min(2,deck.fields.length))};
      $('#ankiFileName').textContent=`${file.name} · ${deck.cards.length} карточек`;$('#ankiName').value=deck.title;$('#ankiNotice').textContent='Выберите поля, задайте порядок кнопками ↑ и ↓ и проверьте пример.';renderAnkiFieldOptions();updateAnkiPreview();$('#importDialog').close();$('#ankiDialog').showModal();return;
    }
    let extracted;
    if(ext==='txt') {const raw=(await file.text()).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');extracted={title:file.name.replace(/\.txt$/i,''),author:'',text:/<\s*(?:html|body|div|p|style|script|span|br)\b/i.test(raw)?stripHtml(raw):raw};}
    else if(ext==='fb2')extracted=extractFb2(await file.text());
    else if(ext==='epub')extracted=await extractEpub(file);
    else if(ext==='csv'||ext==='tsv'){
      const rows=parseDelimited(await file.text(),ext==='csv'?',':'\t');if(rows.length<2)throw Error('В таблице не найдены строки карточек.');const headers=rows[0].map((x,i)=>x.trim()||`Поле ${i+1}`);
      pendingAnki={title:file.name.replace(/\.(csv|tsv)$/i,''),fields:headers,cards:rows.slice(1).map(r=>({fields:r,names:headers,text:r.map((x,i)=>`${headers[i]}: ${x}`).join('\n')})).filter(c=>c.text.trim()),fileName:file.name,selectedFields:headers.slice(0,Math.min(2,headers.length))};
      $('#ankiFileName').textContent=`${file.name} · ${pendingAnki.cards.length} строк`;$('#ankiName').value=pendingAnki.title;$('#ankiNotice').textContent='CSV/TSV импорт поддерживает колонки с заголовками. Выберите и упорядочьте поля для печати.';renderAnkiFieldOptions();updateAnkiPreview();$('#importDialog').close();$('#ankiDialog').showModal();return;
    } else throw Error('Этот формат пока не поддерживается. Используйте TXT, FB2, EPUB, APKG, CSV или TSV.');
    if(!extracted.text)throw Error('В файле нет текста для тренировки.');
    const cleanText=cleanImportedText(extracted.text);
    if(!cleanText)throw Error('После очистки файла не осталось текста для тренировки.');
    const item={id:makeId(),kind:'book',title:extracted.title||file.name,author:extracted.author||'',text:cleanText,chapters:detectChapters(cleanText),position:0,elapsed:0,updatedAt:Date.now(),language:/[а-яё]/i.test(cleanText)?'ru':'en'};
    state.items.unshift(item);await persist();$('#importDialog').close();currentView='library';render();showToast(`«${item.title}» добавлена в библиотеку`);
  } catch(err) { showToast(err.message||'Не удалось прочитать файл.'); }
}
function renderAnkiFieldOptions(){const host=$('#fieldOptions');if(!host||!pendingAnki)return;host.innerHTML=pendingAnki.fields.map(name=>{const selected=pendingAnki.selectedFields.indexOf(name);return `<div class="field-option"><button class="field-chip ${selected>=0?'selected':''}" type="button" data-field="${esc(name)}">${esc(name)}</button>${selected>=0?`<button class="field-order" type="button" data-move-field="-1" data-field="${esc(name)}" aria-label="Переместить вверх" ${selected===0?'disabled':''}>↑</button><button class="field-order" type="button" data-move-field="1" data-field="${esc(name)}" aria-label="Переместить вниз" ${selected===pendingAnki.selectedFields.length-1?'disabled':''}>↓</button>`:''}</div>`;}).join('');$$('.field-chip',host).forEach(button=>button.addEventListener('click',()=>{const name=button.dataset.field;if(pendingAnki.selectedFields.includes(name))pendingAnki.selectedFields=pendingAnki.selectedFields.filter(x=>x!==name);else pendingAnki.selectedFields.push(name);renderAnkiFieldOptions();updateAnkiPreview();}));$$('[data-move-field]',host).forEach(button=>button.addEventListener('click',()=>{const from=pendingAnki.selectedFields.indexOf(button.dataset.field),to=from+Number(button.dataset.moveField);if(from<0||to<0||to>=pendingAnki.selectedFields.length)return;[pendingAnki.selectedFields[from],pendingAnki.selectedFields[to]]=[pendingAnki.selectedFields[to],pendingAnki.selectedFields[from]];renderAnkiFieldOptions();updateAnkiPreview();}));}
function updateAnkiPreview(){const box=$('#ankiPreview');if(!box||!pendingAnki)return;const card=pendingAnki.cards[0];if(!card){box.textContent='В колоде нет карточек для предпросмотра.';return;}const fields=pendingAnki.selectedFields.map(name=>{const index=card.names.indexOf(name);return index>=0?plainFieldValue(card.fields[index]):'';}).filter(Boolean);box.textContent=fields.join('  ·  ')||'Выберите хотя бы одно непустое поле.';}
function finishAnkiImport() {
  if(!pendingAnki)return;if(!pendingAnki.selectedFields.length){showToast('Выберите хотя бы одно поле для печати.');return;}
  const selected=pendingAnki.selectedFields, cards=pendingAnki.cards.map(c=>({text:selected.map(f=>{const idx=c.names.indexOf(f);return idx>=0?plainFieldValue(c.fields[idx]):'';}).filter(Boolean).join(' ').replace(/\s+/g,' ').trim(),position:0,deck:c.deck})).filter(x=>x.text.trim());
  const item={id:makeId(),kind:'deck',title:$('#ankiName').value.trim()||pendingAnki.title,author:`${cards.length} карточек`,cards,cardIndex:0,frequency:$('#ankiFrequency').value,position:0,elapsed:0,updatedAt:Date.now(),language:$('#ankiLanguage').value==='Русский'?'ru':'en'};state.items.unshift(item);persist();pendingAnki=null;$('#ankiDialog').close();currentView='library';render();showToast('Материал добавлен в библиотеку');
}
function makeId(){return crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;}
function cleanImportedText(value){return String(value||'').replace(/\r\n?/g,'\n').replace(/\u0000/g,'').replace(/<\s*(script|style|svg|iframe|object|template|head|nav|header|footer)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').replace(/[ \t]{2,}/g,' ').trim();}
function detectChapters(text){const chapters=[{title:'Начало',start:0}],re=/^(?:глава|chapter|часть|part|раздел|пролог|эпилог|введение)\b[^\n]{0,90}/gim;let match;while((match=re.exec(text))){const title=match[0].trim().replace(/[.·—–-]+$/,'');if(match.index<80){chapters[0]={title,start:match.index};}else if(match.index-chapters[chapters.length-1].start>450)chapters.push({title,start:match.index});}return chapters;}
function plainFieldValue(value){const doc=new DOMParser().parseFromString(String(value||''),'text/html');doc.querySelectorAll('script,style,svg,iframe,object,embed,template').forEach(node=>node.remove());doc.querySelectorAll('img').forEach(node=>node.replaceWith(doc.createTextNode(node.getAttribute('alt')?` [изображение: ${node.getAttribute('alt')}] `:' [изображение] ')));doc.querySelectorAll('audio,video').forEach(node=>node.replaceWith(doc.createTextNode(' [медиа] ')));doc.querySelectorAll('.sound,.replaybutton').forEach(node=>node.replaceWith(doc.createTextNode(' [аудио] ')));return cleanImportedText(doc.body?.innerText||doc.body?.textContent||'');}
$('#fileInput').addEventListener('change',e=>handleFile(e.target.files?.[0]));
const dz=$('#dropzone');dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drag');});dz.addEventListener('dragleave',()=>dz.classList.remove('drag'));dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('drag');handleFile(e.dataTransfer.files?.[0]);});
$('#confirmAnki').addEventListener('click',finishAnkiImport);$('#cancelAnki').addEventListener('click',()=>$('#ankiDialog').close());
$('.settings-open').addEventListener('click',()=>{$('#accentSetting').value=state.settings.accent;$('#fontSetting').value=state.settings.font;$('#layoutSetting').value=state.settings.layout;$('#readerSizeSetting').value=String(state.settings.readerSize||17);$('#readerFontSetting').value=state.settings.readerFont||'serif';$('#dailyGoalSetting').value=state.settings.dailyGoalChars||2000;$('#settingsDialog').showModal();});
$('#saveSettings').addEventListener('click',()=>{state.settings.accent=$('#accentSetting').value;state.settings.font=$('#fontSetting').value;state.settings.layout=$('#layoutSetting').value;state.settings.readerSize=Math.max(12,Math.min(32,+$('#readerSizeSetting').value||17));state.settings.readerFont=$('#readerFontSetting').value;state.settings.dailyGoalChars=Math.max(100,+$('#dailyGoalSetting').value||2000);persist();$('#settingsDialog').close();applySettings();if(currentView!=='trainer')render();showToast('Настройки сохранены');});
$('#themeToggle').addEventListener('click',()=>{state.settings.theme=state.settings.theme==='light'?'dark':'light';persist();applySettings();});
$('#sidebarToggle').addEventListener('click',()=>{state.settings.sidebarHidden=!state.settings.sidebarHidden;persist();applySettings();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&session.startedAt)stopTimer(true);});
window.addEventListener('pagehide',()=>{if(session.startedAt)stopTimer(true);else saveCurrentPosition();});
async function init() {
  const saved=await getSaved('state');if(saved)state={...structuredClone(defaultState),...saved,stats:{...defaultState.stats,...saved.stats,daily:{...defaultState.stats.daily,...saved.stats?.daily},errorsByKey:{...defaultState.stats.errorsByKey,...saved.stats?.errorsByKey},lessonResults:saved.stats?.lessonResults||[]},settings:{...defaultState.settings,...saved.settings}};
  applySettings();render();
  if('serviceWorker'in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
init();
