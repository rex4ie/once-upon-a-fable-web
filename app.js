'use strict';
/* Once Upon a Fable: reader app. Runs inside the Android WebView shell (window.Native). */

const SRC = 'rex4ie/once-upon-a-fable';
const MIRRORS = [`https://raw.githubusercontent.com/${SRC}/main/content/`, `https://cdn.jsdelivr.net/gh/${SRC}@main/content/`];
const RELEASES = `https://api.github.com/repos/${SRC}/releases/latest`;
const CONTACT = { name: 'Ali Asghar Rezaie', instagram: 'rez4ie', email: 'rez4ie@gmail.com' };

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const pad = n => String(n).padStart(2, '0');
const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
const cmpVer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };

/* ---------- Native bridge (with a browser fallback for previews) ---------- */
const HAS_NATIVE = typeof window.Native !== 'undefined';
const Bridge = {
  n: 0, cb: {}, onprogress: null,
  call(fn, ...a) { return new Promise((res, rej) => { const id = ++this.n; this.cb[id] = { res, rej }; Native[fn](id, ...a); }); },
  done(id, ok, v) { const c = this.cb[id]; if (!c) return; delete this.cb[id]; ok ? c.res(v) : c.rej(new Error(v)); },
  progress(id, p) { this.onprogress && this.onprogress(p); },
  ended() { Player.onEnded(); },
};
window.Bridge = Bridge;
if (!HAS_NATIVE) {
  const mem = {};
  window.Native = {
    version: () => '1.0', exists: () => false, readText: r => mem[r] || '', writeText: (r, t) => { mem[r] = t; }, remove() {},
    cacheSize: () => 0, get: (id, url) => fetch(url).then(r => r.ok ? r.text() : Promise.reject(r.status)).then(t => Bridge.done(id, true, t), e => Bridge.done(id, false, String(e))),
    download: (id) => Bridge.done(id, false, 'preview'), play() {}, pause() {}, resume() {}, stop() {}, seek() {}, setSpeed() {},
    position: () => 0, duration: () => 0, playing: () => false, openUrl: u => window.open(u), setBars() {}, installUpdate: id => Bridge.done(id, false, 'preview'),
  };
}
const get = url => Bridge.call('get', url);
const dataUrl = rel => '/data/' + rel.split('/').map(encodeURIComponent).join('/');
const readJSON = rel => { try { const t = Native.readText(rel); return t ? JSON.parse(t) : null; } catch (e) { return null; } };
async function remoteJSON(path) {
  let err;
  for (const base of MIRRORS) { try { return JSON.parse(await get(base + path + '?v=' + Date.now())); } catch (e) { err = e; } }
  throw err || new Error('offline');
}
async function bundledJSON(path) { const r = await fetch('content/' + path); if (!r.ok) throw new Error('missing'); return r.json(); }

/* ---------- Settings ---------- */
const DEF = { lang: 'fa', theme: 'light', font: 'literata', size: 19, lh: 1.7, margin: 'normal', photos: true, vocab: true, follow: true, livefa: false, accent: 'us', hlword: false, fullfa: false, newPerDay: 10 };
const FONTS = { literata: ['Literata', 'Literata, Georgia, serif'], atkinson: ['Atkinson', 'Atkinson, sans-serif'], serif: ['Serif', 'Georgia, "Noto Serif", serif'], sans: ['Sans', 'system-ui, Roboto, sans-serif'] };
const THEMES = { light: ['White', '#FFFFFF', '#1C1B19', false], paper: ['Reading', '#F6F0E4', '#2E2A24', false], dark: ['Dark', '#1E1F21', '#E6E3DE', true], black: ['Black', '#000000', '#D9D6D0', true] };
const MARGINS = { narrow: 14, normal: 22, wide: 34 };

/* ---------- Interface language (English / Persian). Story text is always English. ---------- */
const TX = {
  en: {
    appName: 'Once Upon a Fable', fablesN: n => `${n} classic fables to read and listen to`, read: 'Read', settings: 'Settings', about: 'About', back: 'Back', close: 'Close',
    flashcards: 'Flashcards', reviewNew: 'Review the new words', deckSt: (d, f) => `${d} to review · ${f} new today`,
    lessonN: n => `Lesson ${n}`, readingSettings: 'Reading settings', listen: 'Listen', loadingStory: 'Loading the story', showTr: 'Show translation', moral: 'Moral', newWords: 'New words',
    practice: 'Practice', practiceSub: 'Exercises for this story', storyFail: 'This story could not be loaded. Check your internet connection and try again.',
    listenT: 'Listen to the story', listenSub: 'Choose a voice. The words light up as the narrator reads.', us: 'American English', usSub: 'US accent', br: 'British English', brSub: 'UK accent', saved: 'Saved on this phone',
    getting: a => `Getting the ${a === 'us' ? 'American' : 'British'} narration`, audioFail: 'Could not get the audio. Check your internet connection.', usShort: 'American', brShort: 'British',
    back5: 'Back 5 seconds', fwd5: 'Forward 5 seconds', playPause: 'Play or pause', follow: 'Scroll with narration', livefa: 'Translate with narration',
    theme: 'Theme', font: 'Font', size: 'Text size', lh: 'Line spacing', margins: 'Margins', narrow: 'Narrow', normal: 'Normal', wide: 'Wide', language: 'App language',
    th_light: 'White', th_paper: 'Reading', th_dark: 'Dark', th_black: 'Black',
    photos: 'Pictures', photosSub: 'Show the pictures in the stories', vocab: 'Underline new words', vocabSub: 'Tap an underlined word to see its meaning',
    hlword: 'Highlight word by word', hlwordSub: 'Off: the whole sentence is highlighted while it is read', followSub: 'Scroll the page along with the audio', livefaSub: 'Show each sentence in Persian as it is read',
    applyNow: 'Changes apply right away.', sample: 'Long ago, in a green <span class="w v">meadow</span>, there lived a hare. He was the fastest animal in the forest.',
    updAvail: v => `Version ${v} is available`, youHave: v => `You have version ${v}.`, later: 'Later', update: 'Update', downloading: 'Downloading', allowInstall: 'Allow installing updates for this app, then tap Update again.', dlFail: 'The download failed. Check your internet connection.',
    aboutText: 'Classic fables for English learners, with Persian meanings and narration in American and British English.', author: 'Author', app: 'App', email: 'Email',
    checkUpd: 'Check for updates', verStories: (v, s) => `Version ${v} · Stories ${s}`, checking: 'Checking', storiesUpd: 'Stories updated. The app is up to date.', latest: v => `You have the latest version (${v})`, checkFail: 'Could not check. Check your internet connection.',
    clear: 'Remove downloaded audio and pictures', mbOnPhone: m => `${m} MB on this phone`, removed: 'Downloads removed', guideAgain: 'Show the guide again', guideAgainSub: 'A short tour of the app',
    loading: 'Loading', exFail: 'The exercises could not be loaded. Check your internet connection.', exIntro: 'Answer the questions. Each answer is checked right away.', score: (r, t) => `${r} of ${t} correct`,
    correct: 'Correct', correctAns: 'Correct answer: ', tfT: 'True or false', tfH: 'Is each sentence true or false for the story?', True: 'True', False: 'False',
    ordT: 'Put in order', ordH: 'Tap the events in the order they happened.', again: 'Start again', shouldBe: n => `Should be ${n}`, scrT: 'Make the sentence', scrH: 'Tap the words in the right order.',
    gapT: 'Fill the gap', gapH: 'Choose the word that fits.', mT: 'Match the meaning', mH: 'Choose the meaning of each word.', spT: 'Right or wrong', spH: 'Is the word in bold used correctly?', Right: 'Right', Wrong: 'Wrong',
    cardsOpt: 'Flashcard settings', perDay: 'How many new words to learn each day.', reset: 'Reset progress', resetSub: 'Start all flashcards from the beginning', resetDone: 'Progress reset',
    preparing: 'Preparing your cards', allDone: 'All done for now', comeBack: 'Come back tomorrow for more reviews and new words.', noWords: 'No words yet.', toReview: n => `${n} to review`, nNew: n => `${n} new`,
    review: 'Review', newWord: 'New word', showAns: 'Show answer', g1: 'Again', g2: 'Hard', g3: 'Good', g4: 'Easy',
    // licence
    locked: 'Locked', free: 'Free', unlockT: 'Unlock all the stories', unlockSub: n => `The first story is free. Enter your licence key to open all ${n} stories, their audio, exercises and flashcards.`,
    keyPh: 'XXXX-XXXX-XXXX', unlock: 'Unlock', checkingKey: 'Checking', badKey: 'This licence key is not valid. Check it and try again.', keyOffline: 'Could not check the key. Connect to the internet and try again.',
    unlocked: 'All stories are unlocked. Enjoy!', buyHow: 'No key yet? Get one from the author:', licence: 'Licence', licOn: k => `Unlocked · ${k}`, licOff: 'Only the first story is open', enterKey: 'Enter licence key',
    // first run + tour
    next: 'Next', prev: 'Back', skip: 'Skip', done: 'Got it', stepOf: (i, n) => `${i} of ${n}`,
    tWelcomeT: 'Welcome!', tWelcome: 'Here is a short tour. It shows you how to read, listen, change the settings and practise.',
    tStoryT: 'The stories', tStory: 'Tap a story to read it. The first one is free; the others open with a licence key.',
    tCardsT: 'Flashcards', tCards: 'The new words from the stories you read come here. Review a few every day so you remember them.',
    tSetT: 'Settings', tSet: 'Change the theme, font, text size and the app language here. Inside a story, the Aa button opens the reading settings.',
    tAboutT: 'About', tAbout: 'Check for updates, enter your licence key, or see this guide again.', tAboutWeb: 'Enter your licence key, contact the author, or see this guide again.',
    tListenT: 'Listen', tListen: 'Tap the headphones to hear the story in an American or British voice. Each sentence lights up as it is read. Play it now to get started!', listenNow: 'Play the story',
    tTypeT: 'Reading settings', tType: 'Change the size, font and colours without leaving the story.',
    tTrT: 'Translation', tTr: 'Show the Persian translation under every paragraph.',
    tWordT: 'New words', tWord: 'Underlined words are new. Tap one to see its meaning and an example.',
    tExT: 'Practice', tEx: 'After reading, do the exercises. Your answers are checked right away.',
    tPlayT: 'The player', tPlay: 'Pause, go back or forward 5 seconds, or drag the bar. Tap any word in the story to jump to it.',
    tSpdT: 'Speed', tSpd: 'Tap to make the narrator slower or faster.',
    tPlTgT: 'While listening', tPlTg: 'The page can scroll along with the voice, and show each sentence in Persian as it is read.',
  },
  fa: {
    appName: 'Once Upon a Fable', fablesN: n => `${n} داستان کلاسیک برای خواندن و شنیدن`, read: 'خوانده شده', settings: 'تنظیمات', about: 'درباره', back: 'برگشت', close: 'بستن',
    flashcards: 'فلش‌کارت‌ها', reviewNew: 'مرور واژه‌های تازه', deckSt: (d, f) => `${d} برای مرور · ${f} واژهٔ تازهٔ امروز`,
    lessonN: n => `درس ${n}`, readingSettings: 'تنظیمات خواندن', listen: 'گوش دادن', loadingStory: 'در حال بارگذاری داستان', showTr: 'نمایش ترجمه', moral: 'نتیجهٔ اخلاقی', newWords: 'واژه‌های تازه',
    practice: 'تمرین', practiceSub: 'تمرین‌های این داستان', storyFail: 'داستان بارگذاری نشد. اتصال اینترنت را بررسی کنید و دوباره امتحان کنید.',
    listenT: 'گوش دادن به داستان', listenSub: 'یک صدا انتخاب کنید. هنگام خواندن راوی، جمله‌ها روشن می‌شوند.', us: 'انگلیسی آمریکایی', usSub: 'لهجهٔ آمریکایی', br: 'انگلیسی بریتانیایی', brSub: 'لهجهٔ بریتانیایی', saved: 'روی گوشی ذخیره شده',
    getting: a => `در حال دریافت صدای ${a === 'us' ? 'آمریکایی' : 'بریتانیایی'}`, audioFail: 'صدا دریافت نشد. اتصال اینترنت را بررسی کنید.', usShort: 'آمریکایی', brShort: 'بریتانیایی',
    back5: '۵ ثانیه عقب', fwd5: '۵ ثانیه جلو', playPause: 'پخش یا توقف', follow: 'پیمایش همراه صدا', livefa: 'ترجمه همراه صدا',
    theme: 'رنگ', font: 'قلم', size: 'اندازهٔ متن', lh: 'فاصلهٔ خطوط', margins: 'حاشیه', narrow: 'کم', normal: 'معمولی', wide: 'زیاد', language: 'زبان برنامه',
    th_light: 'سفید', th_paper: 'کاغذی', th_dark: 'تیره', th_black: 'سیاه',
    photos: 'تصاویر', photosSub: 'نمایش تصاویر داستان‌ها', vocab: 'خط زیر واژه‌های تازه', vocabSub: 'روی واژهٔ خط‌دار بزنید تا معنی‌اش را ببینید',
    hlword: 'برجسته کردن واژه به واژه', hlwordSub: 'خاموش: هنگام خواندن، کل جمله برجسته می‌شود', followSub: 'صفحه همراه صدا پایین می‌رود', livefaSub: 'هر جمله هنگام خوانده شدن به فارسی نشان داده می‌شود',
    applyNow: 'تغییرات بی‌درنگ اعمال می‌شوند.', sample: 'Long ago, in a green <span class="w v">meadow</span>, there lived a hare. He was the fastest animal in the forest.',
    updAvail: v => `نسخهٔ ${v} آماده است`, youHave: v => `نسخهٔ شما ${v} است.`, later: 'بعداً', update: 'به‌روزرسانی', downloading: 'در حال دانلود', allowInstall: 'اجازهٔ نصب به‌روزرسانی را برای این برنامه بدهید و دوباره «به‌روزرسانی» را بزنید.', dlFail: 'دانلود انجام نشد. اتصال اینترنت را بررسی کنید.',
    aboutText: 'داستان‌های کلاسیک برای زبان‌آموزان انگلیسی، با معنی فارسی و صدای راوی آمریکایی و بریتانیایی.', author: 'نویسنده', app: 'برنامه', email: 'ایمیل',
    checkUpd: 'بررسی به‌روزرسانی', verStories: (v, s) => `نسخهٔ ${v} · داستان‌ها ${s}`, checking: 'در حال بررسی', storiesUpd: 'داستان‌ها به‌روز شدند. برنامه به‌روز است.', latest: v => `آخرین نسخه را دارید (${v})`, checkFail: 'بررسی انجام نشد. اتصال اینترنت را بررسی کنید.',
    clear: 'پاک کردن صداها و تصاویر دانلودشده', mbOnPhone: m => `${m} مگابایت روی این گوشی`, removed: 'دانلودها پاک شدند', guideAgain: 'نمایش دوبارهٔ راهنما', guideAgainSub: 'آشنایی کوتاه با برنامه',
    loading: 'در حال بارگذاری', exFail: 'تمرین‌ها بارگذاری نشدند. اتصال اینترنت را بررسی کنید.', exIntro: 'به پرسش‌ها پاسخ دهید. هر پاسخ همان لحظه بررسی می‌شود.', score: (r, t) => `${r} از ${t} درست`,
    correct: 'درست است', correctAns: 'پاسخ درست: ', tfT: 'درست یا نادرست', tfH: 'هر جمله با داستان درست است یا نادرست؟', True: 'درست', False: 'نادرست',
    ordT: 'مرتب کنید', ordH: 'رویدادها را به ترتیبی که رخ دادند بزنید.', again: 'از نو', shouldBe: n => `باید ${n} باشد`, scrT: 'جمله بسازید', scrH: 'واژه‌ها را به ترتیب درست بزنید.',
    gapT: 'جای خالی', gapH: 'واژهٔ مناسب را انتخاب کنید.', mT: 'معنی را پیدا کنید', mH: 'معنی هر واژه را انتخاب کنید.', spT: 'درست یا نادرست', spH: 'آیا واژهٔ پررنگ درست به کار رفته است؟', Right: 'درست', Wrong: 'نادرست',
    cardsOpt: 'تنظیمات فلش‌کارت', perDay: 'هر روز چند واژهٔ تازه یاد بگیرید.', reset: 'شروع دوباره', resetSub: 'همهٔ فلش‌کارت‌ها از اول', resetDone: 'پیشرفت پاک شد',
    preparing: 'در حال آماده کردن کارت‌ها', allDone: 'فعلاً تمام شد', comeBack: 'فردا برای مرور و واژه‌های تازه برگردید.', noWords: 'هنوز واژه‌ای نیست.', toReview: n => `${n} برای مرور`, nNew: n => `${n} تازه`,
    review: 'مرور', newWord: 'واژهٔ تازه', showAns: 'نمایش پاسخ', g1: 'دوباره', g2: 'سخت', g3: 'خوب', g4: 'آسان',
    locked: 'قفل', free: 'رایگان', unlockT: 'باز کردن همهٔ داستان‌ها', unlockSub: n => `داستان اول رایگان است. کد لایسنس خود را وارد کنید تا هر ${n} داستان، صداها، تمرین‌ها و فلش‌کارت‌ها باز شوند.`,
    keyPh: 'XXXX-XXXX-XXXX', unlock: 'باز کردن', checkingKey: 'در حال بررسی', badKey: 'این کد لایسنس معتبر نیست. آن را بررسی کنید و دوباره امتحان کنید.', keyOffline: 'کد بررسی نشد. به اینترنت وصل شوید و دوباره امتحان کنید.',
    unlocked: 'همهٔ داستان‌ها باز شدند. لذت ببرید!', buyHow: 'کد ندارید؟ از نویسنده تهیه کنید:', licence: 'لایسنس', licOn: k => `فعال · ${k}`, licOff: 'فقط داستان اول باز است', enterKey: 'وارد کردن کد لایسنس',
    next: 'بعدی', prev: 'قبلی', skip: 'رد شدن', done: 'متوجه شدم', stepOf: (i, n) => `${i} از ${n}`,
    tWelcomeT: 'خوش آمدید!', tWelcome: 'یک راهنمای کوتاه: خواندن، گوش دادن، تغییر تنظیمات و تمرین کردن را نشانتان می‌دهد.',
    tStoryT: 'داستان‌ها', tStory: 'روی یک داستان بزنید تا آن را بخوانید. داستان اول رایگان است؛ بقیه با کد لایسنس باز می‌شوند.',
    tCardsT: 'فلش‌کارت‌ها', tCards: 'واژه‌های تازهٔ داستان‌هایی که می‌خوانید اینجا می‌آیند. هر روز چندتا را مرور کنید تا در یادتان بمانند.',
    tSetT: 'تنظیمات', tSet: 'رنگ، قلم، اندازهٔ متن و زبان برنامه را اینجا تغییر دهید. داخل داستان هم دکمهٔ Aa تنظیمات خواندن را باز می‌کند.',
    tAboutT: 'درباره', tAbout: 'به‌روزرسانی را بررسی کنید، کد لایسنس را وارد کنید یا این راهنما را دوباره ببینید.', tAboutWeb: 'کد لایسنس را وارد کنید، با نویسنده در تماس باشید یا این راهنما را دوباره ببینید.',
    tListenT: 'گوش دادن', tListen: 'روی هدفون بزنید تا داستان را با صدای آمریکایی یا بریتانیایی بشنوید. هر جمله هنگام خوانده شدن روشن می‌شود. همین حالا پخشش کنید و شروع کنید!', listenNow: 'پخش داستان',
    tTypeT: 'تنظیمات خواندن', tType: 'اندازه، قلم و رنگ را بدون بیرون رفتن از داستان تغییر دهید.',
    tTrT: 'ترجمه', tTr: 'ترجمهٔ فارسی را زیر هر بند نشان می‌دهد.',
    tWordT: 'واژه‌های تازه', tWord: 'واژه‌های خط‌دار تازه‌اند. روی یکی بزنید تا معنی و مثالش را ببینید.',
    tExT: 'تمرین', tEx: 'پس از خواندن، تمرین‌ها را انجام دهید. پاسخ‌ها همان لحظه بررسی می‌شوند.',
    tPlayT: 'پخش‌کننده', tPlay: 'توقف، ۵ ثانیه عقب یا جلو، یا نوار را بکشید. روی هر واژهٔ داستان بزنید تا صدا از همان‌جا پخش شود.',
    tSpdT: 'سرعت', tSpd: 'بزنید تا راوی آهسته‌تر یا تندتر بخواند.',
    tPlTgT: 'هنگام گوش دادن', tPlTg: 'صفحه می‌تواند همراه صدا پایین برود و هر جمله را هنگام خوانده شدن به فارسی نشان دهد.',
  },
};
const t = (k, ...a) => { const v = (TX[S.lang] || TX.en)[k] ?? TX.en[k]; return typeof v === 'function' ? v(...a) : v; };
let S = { ...DEF };
try { Object.assign(S, JSON.parse(localStorage.getItem('settings') || '{}')); } catch (e) {}
function saveSettings() { try { localStorage.setItem('settings', JSON.stringify(S)); } catch (e) {} applySettings(); }
function applySettings() {
  const root = document.documentElement, th = THEMES[S.theme] || THEMES.light;
  root.dataset.theme = S.theme;
  root.lang = S.lang; root.dir = S.lang === 'fa' ? 'rtl' : 'ltr';
  root.style.setProperty('--ff', FONTS[S.font][1]);
  root.style.setProperty('--fs', S.size + 'px');
  root.style.setProperty('--lh', S.lh);
  root.style.setProperty('--pad', MARGINS[S.margin] + 'px');
  document.body.classList.toggle('no-photos', !S.photos);
  document.body.classList.toggle('no-vocab', !S.vocab);
  document.body.classList.toggle('full-fa', !!S.fullfa);
  document.body.classList.toggle('hl-word', !!S.hlword);
  Native.setBars(th[1], th[3]);
}

/* ---------- Content ---------- */
let INDEX = null, BUNDLED = null;
const read = new Set(JSON.parse(localStorage.getItem('read') || '[]'));
async function loadIndex() {
  try { BUNDLED = await bundledJSON('index.json'); } catch (e) { BUNDLED = { version: 0, lessons: [] }; }
  const cached = readJSON('content/index.json');
  INDEX = cached && cached.version >= BUNDLED.version ? cached : BUNDLED;
}
async function refreshIndex() {
  try {
    const remote = await remoteJSON('index.json');
    if (!remote || !(remote.version > INDEX.version)) return false;
    const old = {}; INDEX.lessons.forEach(l => old[l.id] = l);
    remote.lessons.forEach(l => { const o = old[l.id]; if (o && o.rev !== l.rev) Native.remove(`content/lessons/${l.id}.json`); });
    Native.writeText('content/index.json', JSON.stringify(remote));
    INDEX = remote; return true;
  } catch (e) { return false; }
}
async function loadLesson(entry) {
  const c = readJSON(`content/lessons/${entry.id}.json`);
  if (c && c.rev === entry.rev) return c;
  const b = BUNDLED.lessons.find(l => l.id === entry.id);
  if (b && b.rev === entry.rev) { try { return { ...(await bundledJSON(`lessons/${entry.id}.json`)), rev: entry.rev }; } catch (e) {} }
  try {
    const r = { ...(await remoteJSON(`lessons/${entry.id}.json`)), rev: entry.rev };
    Native.writeText(`content/lessons/${entry.id}.json`, JSON.stringify(r)); return r;
  } catch (e) { if (c) return c; if (b) return bundledJSON(`lessons/${entry.id}.json`); throw e; }
}
// Pictures are downloaded once and kept.
const imgJobs = {};
function imageSrc(name) {
  const rel = 'img/' + name;
  if (Native.exists(rel)) return Promise.resolve(dataUrl(rel));
  if (!HAS_NATIVE || window.IS_WEB) return Promise.resolve(location.hostname === 'localhost' ? '/img/' + name : MIRRORS[0] + 'images/' + name);
  return imgJobs[name] || (imgJobs[name] = (async () => {
    for (const base of MIRRORS) { try { await Bridge.call('download', base + 'images/' + encodeURIComponent(name), rel); return dataUrl(rel); } catch (e) {} }
    delete imgJobs[name]; throw new Error('offline');
  })());
}
function fillImages(root) {
  root.querySelectorAll('img[data-img]').forEach(im => {
    if (!S.photos && !im.dataset.force) return;
    if (im.dataset.loaded) return; im.dataset.loaded = '1';
    imageSrc(im.dataset.img).then(src => { if (im.tagName === 'IMG') im.src = src; }, () => { im.dataset.loaded = ''; });
  });
  root.querySelectorAll('[data-bg]').forEach(el => {
    if (!S.photos || el.dataset.loaded) return; el.dataset.loaded = '1';
    imageSrc(el.dataset.bg).then(src => el.style.backgroundImage = `url("${src}")`, () => { el.dataset.loaded = ''; });
  });
}

/* ---------- Text → word tokens (must match tools/make_timings.js) ---------- */
function tokenize(par) {
  const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g; let plain = '', marks = [], last = 0, m;
  while ((m = re.exec(par))) { plain += par.slice(last, m.index); marks.push([plain.length, plain.length + m[1].length, m[2] || m[1]]); plain += m[1]; last = re.lastIndex; }
  plain += par.slice(last);
  const out = [], wr = /\S+/g;
  while ((m = wr.exec(plain))) { const s = m.index, e = s + m[0].length, mk = marks.find(k => k[0] < e && k[1] > s); out.push({ t: m[0], v: mk ? mk[2] : null }); }
  return out;
}

// Sentences of a paragraph (must match the content tools): split after . ! ? before a capital, merge pieces under 3 words.
function splitSentences(par) {
  const plain = par.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1');
  const a = plain.split(/(?<=[.!?]["”]?)\s+(?=["“]?[A-Z])/).map(x => x.trim()).filter(Boolean), o = [];
  let c = '';
  for (const x of a) { c = c ? c + ' ' + x : x; if (c.split(/\s+/).length >= 3) { o.push(c); c = ''; } }
  if (c) { if (o.length) o[o.length - 1] += ' ' + c; else o.push(c); }
  return o;
}

/* Sentence translation tooltip: sits above (or below) the sentence, never on top of it. */
let tipFor = null;
function showTip(s) {
  hideTip();
  const fa = s.dataset.fa; if (!fa) return;
  tipFor = s; s.classList.add('sel');
  const t = document.createElement('div'); t.className = 'tip fa'; t.id = 'tip'; t.textContent = fa;
  document.body.appendChild(t);
  const rects = [...s.getClientRects()], top = Math.min(...rects.map(r => r.top)), bot = Math.max(...rects.map(r => r.bottom));
  const W = document.documentElement.clientWidth, tw = Math.min(W - 24, 560);
  t.style.width = tw + 'px'; t.style.left = ((W - tw) / 2) + 'px';
  const th = t.offsetHeight, above = top - th - 10 > 64;
  t.style.top = (window.scrollY + (above ? top - th - 10 : bot + 10)) + 'px';
  t.classList.add(above ? 'up' : 'down');
  t.onclick = hideTip;
}
function hideTip() { const t = $('#tip'); if (t) t.remove(); if (tipFor) tipFor.classList.remove('sel'); tipFor = null; }
document.addEventListener('click', e => { if (tipFor && !e.target.closest('.s') && !e.target.closest('#tip')) hideTip(); }, true);

/* ---------- Navigation ---------- */
const stack = [];
const App = {
  go(view, arg) { if (stack.length) stack[stack.length - 1].scroll = window.scrollY; stack.push({ view, arg }); render(); },
  back() {
    if (!$('#sheet-wrap').hidden) { closeSheet(); return true; }
    if (stack.length <= 1) return false;
    leaveView(); stack.pop(); render(stack[stack.length - 1].scroll); return true;
  },
};
window.App = App;
function leaveView() { hideTip(); const cur = stack[stack.length - 1]; if (cur && cur.view === 'lesson') Player.stop(); }
function render(scroll = 0) {
  const { view, arg } = stack[stack.length - 1];
  const app = $('#app'); app.innerHTML = '';
  hideTip();
  ({ home: viewHome, lesson: viewLesson, settings: viewSettings, about: viewAbout, exercises: viewExercises, cards: viewCards })[view](app, arg);
  window.scrollTo(0, scroll);
  onScroll();
}
function onScroll() { const b = $('.bar'); if (b) b.classList.toggle('scrolled', window.scrollY > 40); }
window.addEventListener('scroll', onScroll, { passive: true });
function bar(title, left, right) {
  return `<div class="bar">${left}<div class="t">${esc(title)}</div>${right}</div>`;
}
const btn = (id, icon, label, cls = '') => `<button class="ibtn ${cls}" id="${id}" aria-label="${label}">${icon}</button>`;

/* ---------- Home ---------- */
function viewHome(app) {
  const L = INDEX.lessons;
  app.innerHTML = bar(t('appName'), '<div style="width:6px"></div>', btn('b-set', I.sliders, t('settings')) + btn('b-about', I.info, t('about'))) +
    `<header class="home-head"><h1>Once Upon a Fable</h1><p>${t('fablesN', L.length)}</p></header>
     <button class="deck" id="b-cards">${I.cards}<div class="tx">${t('flashcards')}<small id="deck-st">${t('reviewNew')}</small></div>${I.chevron}</button>
     <ul class="list">${L.map((l, i) => `<li class="row" data-id="${l.id}"><span class="n">${pad(i + 1)}</span>
       <div class="tx"><b>${esc(l.title)}</b><span>${esc(l.origin)}${read.has(l.id) ? ' · ' + t('read') : ''}</span></div>
       ${isLocked(l) ? `<span class="lock">${I.lock}</span>` : ''}${S.photos && l.cover ? `<div class="th" data-bg="${esc(l.cover)}"></div>` : ''}</li>`).join('')}</ul>`;
  $('#b-set').onclick = () => App.go('settings');
  $('#b-about').onclick = () => App.go('about');
  $('#b-cards').onclick = () => App.go('cards');
  SRS.counts().then(c => { const el = $('#deck-st'); if (el) el.textContent = c.total ? t('deckSt', c.due, c.fresh) : t('reviewNew'); });
  app.querySelectorAll('.row').forEach(r => r.onclick = () => { const l = INDEX.lessons.find(x => x.id === r.dataset.id); if (isLocked(l)) openUnlockSheet(); else App.go('lesson', l.id); });
  if (!Lic.key) { const ul = document.createElement('button'); ul.className = 'deck unlock-cta'; ul.id = 'b-unlock'; ul.innerHTML = `${I.lock}<div class="tx">${t('unlockT')}<small>${t('enterKey')}</small></div>${I.chevron}`; ul.onclick = () => openUnlockSheet(); $('#b-cards').after(ul); }
  fillImages(app);
  Tour.maybe('home');
}

/* ---------- Lesson ---------- */
let LESSON = null;
function viewLesson(app, id) {
  const entry = INDEX.lessons.find(l => l.id === id), n = INDEX.lessons.indexOf(entry) + 1;
  if (isLocked(entry)) { stack.pop(); render(); openUnlockSheet(); return; }
  app.innerHTML = bar(entry.title, btn('b-back', I.back, t('back')), btn('b-type', I.type, t('readingSettings')) + btn('b-listen', I.headphones, t('listen'), 'accent')) +
    `<article class="reader"><div class="kicker">${t('lessonN', n)} · <span dir="ltr">${esc(entry.origin)}</span></div><div id="body"><div class="loading"><div class="spin"></div>${t('loadingStory')}</div></div></article>`;
  $('#b-back').onclick = () => App.back();
  $('#b-type').onclick = () => openReadingSheet();
  $('#b-listen').onclick = () => openListenSheet(entry);
  loadLesson(entry).then(les => {
    if (stack[stack.length - 1].arg !== id) return;
    LESSON = { entry, les, title: [], words: [] };
    const tt = les.title.split(/\s+/).map((w, i) => `<span class="w" data-t="${i}">${esc(w)}</span>`).join(' ');
    let k = 0;
    const pages = les.pages.map((p, pi) => (p.images || []).map(im => `<figure><img data-img="${esc(im)}" alt=""></figure>`).join('') +
      p.text.map((par, qi) => {
        const toks = tokenize(par), sents = splitSentences(par), fa = (p.fa && p.fa[qi]) || [];
        let ti = 0;
        const html = sents.map((s, si) => { const n = s.split(/\s+/).length, part = toks.slice(ti, ti + n); ti += n;
          return `<span class="s" data-fa="${esc(fa[si] || '')}">` + part.map(t => `<span class="w${t.v ? ' v' : ''}" data-k="${k++}"${t.v ? ` data-v="${esc(t.v)}"` : ''}>${esc(t.t)}</span>`).join(' ') + '</span>'; }).join(' ');
        const rest = toks.slice(ti).map(t => `<span class="w" data-k="${k++}">${esc(t.t)}</span>`).join(' ');
        return `<p>${html}${rest ? ' ' + rest : ''}</p>` + (fa.length ? `<p class="fa tr">${esc(fa.join(' '))}</p>` : '');
      }).join('')).join('');
    const hasFa = les.pages.some(p => p.fa);
    $('#body').innerHTML = `<h1 dir="ltr">${tt}</h1>
      ${hasFa ? `<div class="pills"><button class="pill ${S.fullfa ? 'on' : ''}" id="t-full">${I.translate}${t('showTr')}</button></div>` : ''}
      <div class="story" dir="ltr">${pages}</div>
      <div class="moral"><small>${t('moral')}</small><p dir="ltr">${esc(les.moral)}</p></div>
      <div class="vocab-list"><h2>${t('newWords')}</h2>${les.vocab.map((v, i) => `<button class="vrow" data-vi="${i}"><b dir="ltr">${esc(v.w)}</b><span class="fa">${esc(v.fa)}</span></button>`).join('')}</div>
      ${les.ex ? `<button class="practice" id="b-ex">${I.pencil}<div class="tx">${t('practice')}<small>${t('practiceSub')}</small></div>${I.chevron}</button>` : ''}`;
    LESSON.title = [...app.querySelectorAll('h1 .w')];
    LESSON.words = [...app.querySelectorAll('.story .w')];
    fillImages(app);
    if (hasFa) {
      $('#t-full').onclick = () => { S.fullfa = !S.fullfa; saveSettings(); $('#t-full').classList.toggle('on', S.fullfa); };
    }
    if ($('#b-ex')) $('#b-ex').onclick = () => App.go('exercises', id);
    $('.story').onclick = e => {
      const w = e.target.closest('.w');
      if (!w) return;
      if (w.dataset.v) return showWord(les.vocab, w.dataset.v);
      if (Player.active()) Player.seekToWord(+w.dataset.k);
    };
    app.querySelectorAll('.vrow').forEach(b => b.onclick = () => showWord(les.vocab, null, +b.dataset.vi));
    const markRead = () => { if (window.innerHeight + window.scrollY > document.body.scrollHeight - 300 && !read.has(id)) { read.add(id); localStorage.setItem('read', JSON.stringify([...read])); } };
    window.addEventListener('scroll', markRead, { passive: true });
    Tour.maybe('lesson');
    Tour.maybe('lesson');
  }, () => { $('#body').innerHTML = `<div class="empty">${t('storyFail')}</div>`; });
}
function showWord(vocab, key, idx) {
  const k = (key || '').toLowerCase();
  const v = idx != null ? vocab[idx] : vocab.find(x => x.w.toLowerCase() === k) || vocab.find(x => k.startsWith(x.w.toLowerCase()));
  if (!v) return;
  openSheet(`<div class="vsheet"><div class="w1" dir="ltr">${esc(v.w)}</div><div class="en" dir="ltr">${esc(v.en)}</div><div class="fa">${esc(v.fa)}</div>
    <blockquote><div dir="ltr">${esc(v.s)}</div><div class="fa">${esc(v.sfa)}</div></blockquote></div>`);
}

/* ---------- Sheets ---------- */
function openSheet(html, onClose) {
  const w = $('#sheet-wrap'); $('#sheet').innerHTML = html; w.hidden = false;
  w._onClose = onClose; $('.sheet-scrim').onclick = closeSheet;
  return $('#sheet');
}
function closeSheet() { const w = $('#sheet-wrap'); if (w.hidden) return; w.hidden = true; w._onClose && w._onClose(); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => t.hidden = true, 2600); }

function openListenSheet(entry) {
  const opt = (acc, name, sub) => {
    const a = entry.audio && entry.audio[acc];
    const saved = a && !window.IS_WEB && Native.exists(`audio/${entry.id}-${acc}-${a.post}.ogg`);
    return `<button class="choice" data-acc="${acc}" ${a ? '' : 'disabled style="opacity:.4"'}>${I.headphones}<div class="tx">${name}<small>${sub}${saved ? ' · ' + t('saved') : ''}</small></div>${S.accent === acc ? I.check : ''}</button>`;
  };
  const sh = openSheet(`<h3>${t('listenT')}</h3><p class="sub">${t('listenSub')}</p>
    ${opt('us', t('us'), t('usSub'))}${opt('br', t('br'), t('brSub'))}`);
  sh.querySelectorAll('.choice').forEach(b => b.onclick = () => { S.accent = b.dataset.acc; saveSettings(); closeSheet(); Player.start(entry, b.dataset.acc); });
}

/* ---------- Player ---------- */
const SPEEDS = [0.8, 0.9, 1, 1.1, 1.25];
const Player = {
  st: null, timer: 0, seq: [], cur: null, lastTouch: 0,
  active() { return !!(this.st && this.st.ready); },
  async start(entry, acc) {
    this.stop();
    const a = entry.audio[acc], rel = `audio/${entry.id}-${acc}-${a.post}.ogg`;
    const st = this.st = { id: entry.id, acc, ready: false, speed: +(localStorage.getItem('speed') || 1) };
    this.mount(`<div class="loading"><div class="spin"></div><span id="pl-msg">${t('getting', acc)}</span></div>`);
    const timing = this.loadTiming(entry, acc, a.post);
    try {
      if (!Native.exists(rel)) {
        const html = await get(`https://t.me/${INDEX.channel}/${a.post}?embed=1`);
        const m = html.match(/<audio[^>]*\ssrc="([^"]+)"/);
        if (!m) throw new Error('no audio');
        await Bridge.call('download', m[1].replace(/&amp;/g, '&'), rel);
      }
    } catch (e) {
      if (this.st !== st) return;
      this.mount(`<div class="loading" style="justify-content:space-between"><span>${t('audioFail')}</span>${btn('pl-x', I.close, t('close'))}</div>`);
      $('#pl-x').onclick = () => this.stop(); return;
    }
    if (this.st !== st) return;
    const tm = await timing;
    if (this.st !== st) return;
    this.buildSeq(tm);
    Native.setSpeed(st.speed);
    Native.play(rel, 0);
    st.ready = true;
    this.mount(`<div class="top">${btn('pl-rw', I.rewind, t('back5'))}<button class="main" id="pl-pp" aria-label="${t('playPause')}">${I.pause}</button>${btn('pl-ff', I.forward, t('fwd5'))}
      <div class="lbl">${t(acc + 'Short')}</div><button class="spd" id="pl-sp">${st.speed}×</button>${btn('pl-x', I.close, t('close'))}</div>
      <div class="prog" id="pl-pr"><i></i><b></b><u></u></div><div class="times"><span id="pl-t">0:00</span><span id="pl-d">0:00</span></div>
      <div class="pl-tg"><button class="pill ${S.follow ? 'on' : ''}" id="pl-fo">${t('follow')}</button>${LESSON && LESSON.les.pages.some(p => p.fa) ? `<button class="pill ${S.livefa ? 'on' : ''}" id="pl-fa">${I.translate}${t('livefa')}</button>` : ''}</div>`);
    $('#pl-fo').onclick = () => { S.follow = !S.follow; saveSettings(); $('#pl-fo').classList.toggle('on', S.follow); this.lastTouch = 0; this.tick(true); };
    if ($('#pl-fa')) $('#pl-fa').onclick = () => { S.livefa = !S.livefa; saveSettings(); $('#pl-fa').classList.toggle('on', S.livefa); if (this.curS) this.showLive(this.curS); };
    $('#pl-pp').onclick = () => { if (Native.playing()) { Native.pause(); } else { Native.resume(); } this.tick(true); };
    $('#pl-rw').onclick = () => Native.seek(Math.max(0, Native.position() - 5000));
    $('#pl-ff').onclick = () => Native.seek(Math.min(Native.duration(), Native.position() + 5000));
    $('#pl-x').onclick = () => this.stop();
    $('#pl-sp').onclick = () => { st.speed = SPEEDS[(SPEEDS.indexOf(st.speed) + 1) % SPEEDS.length] || 1; localStorage.setItem('speed', st.speed); Native.setSpeed(st.speed); $('#pl-sp').textContent = st.speed + '×'; };
    const pr = $('#pl-pr');
    const seekAt = e => { const r = pr.getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); Native.seek(Math.round(f * Native.duration())); this.tick(true); };
    pr.onpointerdown = e => { pr.setPointerCapture(e.pointerId); seekAt(e); pr.onpointermove = seekAt; };
    pr.onpointerup = () => { pr.onpointermove = null; };
    this.timer = setInterval(() => this.tick(), 60);
    Tour.maybe('player');
    Tour.maybe('player');
  },
  async loadTiming(entry, acc, post) {
    const rel = `timing/${entry.id}-${acc}.json`;
    let t = null;
    try { t = await remoteJSON(`timing/${entry.id}-${acc}.json`); Native.writeText(rel, JSON.stringify(t)); }
    catch (e) { t = readJSON(rel); }
    return t && t.post === post ? t : null;
  },
  buildSeq(t) {
    this.seq = [];
    if (!t || !LESSON) return;
    (t.title || []).forEach((x, i) => x && LESSON.title[i] && this.seq.push([x[0], x[1], LESSON.title[i]]));
    (t.words || []).forEach((x, i) => x && LESSON.words[i] && this.seq.push([x[0], x[1], LESSON.words[i], i]));
    this.seq.sort((a, b) => a[0] - b[0]);
  },
  seekToWord(k) { const s = this.seq.find(x => x[3] === k); if (s) { Native.seek(s[0]); if (!Native.playing()) Native.resume(); this.tick(true); } },
  tick(force) {
    if (!this.active()) return;
    const pos = Native.position(), dur = Native.duration(), playing = Native.playing();
    const pp = $('#pl-pp'); if (pp && pp._p !== playing) { pp._p = playing; pp.innerHTML = playing ? I.pause : I.play; }
    if (dur) { const f = pos / dur * 100; $('#pl-pr b').style.width = f + '%'; $('#pl-pr u').style.left = f + '%'; $('#pl-t').textContent = fmt(pos); $('#pl-d').textContent = fmt(dur); }
    // highlight the word being read
    let lo = 0, hi = this.seq.length - 1, idx = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (this.seq[mid][0] <= pos + 40) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
    let el = idx >= 0 && pos <= this.seq[idx][1] + 700 ? this.seq[idx][2] : null;
    if (el !== this.cur) {
      if (this.cur) this.cur.classList.remove('on');
      this.cur = el;
      if (el) el.classList.add('on');
    }
    const sent = el && el.closest('.s');
    if (sent !== this.curS) { if (this.curS) this.curS.classList.remove('on'); this.curS = sent; if (sent) { sent.classList.add('on'); this.showLive(sent); } }
    if (el && S.follow && Date.now() - this.lastTouch > 3500) {
      const r = (sent || el).getBoundingClientRect(), w = el.getBoundingClientRect(), h = window.innerHeight, pb = ($('#player') || {}).offsetHeight || 0;
      // keep the sentence being read a little above the middle; move only when it drifts away
      const anchor = r.height > h * 0.45 ? w : r, target = window.scrollY + anchor.top - h * 0.3;
      if (w.top < 80 || w.bottom > h - pb - 60 || Math.abs(anchor.top - h * 0.3) > h * 0.22) smoothTo(target);
    }
  },
  showLive(sent) {
    let box = $('#live-fa');
    if (!S.livefa || !sent.dataset.fa) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement('span'); box.id = 'live-fa'; box.className = 'fa live-fa'; }
    box.textContent = sent.dataset.fa;
    sent.after(box);
    box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
  },
  mount(html) { let p = $('#player'); if (!p) { p = document.createElement('div'); p.id = 'player'; p.className = 'player'; p.dir = 'ltr'; document.body.appendChild(p); } p.innerHTML = html; },
  onEnded() { this.tick(true); if (this.curS) this.curS.classList.remove('on'); this.curS = null; if (this.cur) { this.cur.classList.remove('on'); this.cur = null; } const pp = $('#pl-pp'); if (pp) { pp._p = false; pp.innerHTML = I.play; } },
  stop() { clearInterval(this.timer); if (this.curS) this.curS.classList.remove('on'); this.curS = null; const lf = $('#live-fa'); if (lf) lf.remove(); Native.stop(); if (this.cur) this.cur.classList.remove('on'); this.cur = null; this.st = null; this.seq = []; const p = $('#player'); if (p) p.remove(); },
};
let scrollAnim = null;
function smoothTo(y) {
  y = Math.max(0, Math.min(y, document.documentElement.scrollHeight - window.innerHeight));
  if (scrollAnim && Math.abs(scrollAnim.to - y) < 4) return;
  const from = window.scrollY, d = y - from; if (Math.abs(d) < 2) return;
  const dur = Math.min(900, 350 + Math.abs(d) * 0.6), t0 = performance.now(), me = scrollAnim = { to: y };
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const step = now => { if (scrollAnim !== me) return; const t = Math.min(1, (now - t0) / dur); window.scrollTo(0, from + d * ease(t)); if (t < 1) requestAnimationFrame(step); else scrollAnim = null; };
  requestAnimationFrame(step);
}
['touchstart', 'wheel'].forEach(ev => window.addEventListener(ev, () => { scrollAnim = null; }, { passive: true }));
['touchstart', 'wheel'].forEach(ev => window.addEventListener(ev, () => Player.lastTouch = Date.now(), { passive: true }));

/* ---------- Settings ---------- */
function controls(onChange) {
  const tr = t;
  const seg = (key, opts) => `<div class="seg" data-key="${key}">${Object.entries(opts).map(([v, l]) => `<button data-v="${v}" class="${String(S[key]) === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const tog = (key, name, sub) => `<button class="toggle" data-tog="${key}"><span>${name}${sub ? `<small>${sub}</small>` : ''}</span><span class="sw ${S[key] ? 'on' : ''}"></span></button>`;
  const html = `
    <div class="grp"><div class="gl">${t('language')}</div>${seg('lang', { fa: 'فارسی', en: 'English' })}</div>
    <div class="grp"><div class="gl">${t('theme')}</div><div class="swatches">${Object.entries(THEMES).map(([k, t]) => `<button class="swatch ${S.theme === k ? 'on' : ''}" data-theme-v="${k}" style="background:${t[1]};color:${t[2]}">${tr('th_' + k)}</button>`).join('')}</div></div>
    <div class="grp"><div class="gl">${tr('font')}</div>${seg('font', Object.fromEntries(Object.entries(FONTS).map(([k, f]) => [k, `<span style="font-family:${f[1].replace(/"/g, "'")}">${f[0]}</span>`])))}</div>
    <div class="grp"><label>${tr('size')}</label><div class="range"><input type="range" min="14" max="28" step="1" value="${S.size}" data-r="size"><span>${S.size}</span></div></div>
    <div class="grp"><label>${tr('lh')}</label><div class="range"><input type="range" min="1.3" max="2.3" step="0.1" value="${S.lh}" data-r="lh"><span>${S.lh}</span></div></div>
    <div class="grp"><div class="gl">${tr('margins')}</div>${seg('margin', { narrow: tr('narrow'), normal: tr('normal'), wide: tr('wide') })}</div>
    <div class="grp">${['photos', 'vocab', 'hlword', 'follow', 'livefa'].map(k => tog(k, tr(k), tr(k + 'Sub'))).join('')}</div>`;
  const wire = root => {
    root.querySelectorAll('[data-theme-v]').forEach(b => b.onclick = () => { S.theme = b.dataset.themeV; root.querySelectorAll('[data-theme-v]').forEach(x => x.classList.toggle('on', x === b)); saveSettings(); onChange && onChange(); });
    root.querySelectorAll('.seg').forEach(sg => sg.querySelectorAll('button').forEach(b => b.onclick = () => { S[sg.dataset.key] = b.dataset.v; sg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); saveSettings(); if (sg.dataset.key === 'lang') { closeSheet(); render(window.scrollY); return; } onChange && onChange(); }));
    root.querySelectorAll('[data-r]').forEach(r => r.oninput = () => { S[r.dataset.r] = +r.value; r.nextElementSibling.textContent = r.value; saveSettings(); onChange && onChange(); });
    root.querySelectorAll('[data-tog]').forEach(b => b.onclick = () => { const k = b.dataset.tog; S[k] = !S[k]; b.querySelector('.sw').classList.toggle('on', S[k]); saveSettings(); if (k === 'photos') fillImages(document); onChange && onChange(); });
  };
  return { html, wire };
}
function openReadingSheet() { const c = controls(); const sh = openSheet(`<h3>${t('readingSettings')}</h3><p class="sub">${t('applyNow')}</p>${c.html}`); c.wire(sh); }
function viewSettings(app) {
  const c = controls(() => fillImages(app));
  app.innerHTML = bar(t('settings'), btn('b-back', I.back, t('back')), '') +
    `<div class="page"><h1>${t('settings')}</h1><div class="preview reader" style="padding:14px 16px;margin:0 0 26px"><div class="story" dir="ltr"><p>${t('sample')}</p></div></div>${c.html}</div>`;
  $('#b-back').onclick = () => App.back();
  c.wire(app);
}

/* ---------- About + updates ---------- */
let UPDATE = null;
async function checkUpdate() {
  if (window.IS_WEB) return null;
  const r = JSON.parse(await get(RELEASES));
  const v = String(r.tag_name || '').replace(/^v/i, ''), apk = (r.assets || []).find(a => /\.apk$/i.test(a.name));
  UPDATE = v && apk && cmpVer(v, Native.version()) > 0 ? { v, url: apk.browser_download_url, notes: (r.body || '').trim() } : null;
  return UPDATE;
}
function openUpdateSheet(u) {
  const sh = openSheet(`<h3>${t('updAvail', esc(u.v))}</h3><p class="sub">${t('youHave', esc(Native.version()))}</p>
    ${u.notes ? `<div class="notes">${esc(u.notes)}</div>` : ''}
    <div class="btns"><button class="btn ghost" id="u-later">${t('later')}</button><button class="btn" id="u-go">${I.download}${t('update')}</button></div>`);
  $('#u-later').onclick = closeSheet;
  $('#u-go').onclick = async () => {
    const go = $('#u-go'); go.disabled = true; go.textContent = t('downloading');
    Bridge.onprogress = p => { go.textContent = `${t('downloading')} ${p}%`; };
    try { await Bridge.call('installUpdate', u.url); closeSheet(); }
    catch (e) {
      go.disabled = false; go.innerHTML = I.download + t('update');
      toast(e.message === 'permission' ? t('allowInstall') : t('dlFail'));
    }
  };
}
function viewAbout(app) {
  const size = Native.cacheSize();
  app.innerHTML = bar(t('about'), btn('b-back', I.back, t('back')), '') +
    `<div class="page"><div class="about-mark">${I.book}</div><h1 style="margin-bottom:6px">Once Upon a Fable</h1>
     <p style="margin:0 0 24px;color:var(--muted)">${t('aboutText')}</p>
     <div class="grp"><div class="gl">${t('licence')}</div>
       <button class="link" id="c-lic">${I.lock}<div class="tx">${Lic.key ? t('licence') : t('enterKey')}<small dir="auto">${Lic.key ? t('licOn', esc(Lic.key)) : t('licOff')}</small></div>${Lic.key ? '' : I.chevron}</button></div>
     <div class="grp"><div class="gl">${t('author')}</div>
       <div style="font:600 18px Literata,Georgia,serif;margin-bottom:6px">${esc(CONTACT.name)}</div>
       <button class="link" id="c-ig">${I.camera}<div class="tx">Instagram<small>@${esc(CONTACT.instagram)}</small></div>${I.chevron}</button>
       <button class="link" id="c-mail">${I.mail}<div class="tx">${t('email')}<small>${esc(CONTACT.email)}</small></div>${I.chevron}</button></div>
     <div class="grp"><div class="gl">${t('app')}</div>
       <button class="link" id="c-guide">${I.info}<div class="tx">${t('guideAgain')}<small>${t('guideAgainSub')}</small></div>${I.chevron}</button>
       ${window.IS_WEB ? '' : `<button class="link" id="c-up">${I.refresh}<div class="tx">${t('checkUpd')}<small id="up-st">${t('verStories', esc(Native.version()), INDEX.version)}</small></div></button>`}
       ${window.IS_WEB ? '' : `<button class="link" id="c-clr">${I.trash}<div class="tx">${t('clear')}<small>${t('mbOnPhone', (size / 1048576).toFixed(1))}</small></div></button>`}</div></div>`;
  $('#c-lic').onclick = () => { if (!Lic.key) openUnlockSheet(); };
  $('#c-guide').onclick = () => { Tour.reset(); stack.length = 0; App.go('home'); };
  $('#b-back').onclick = () => App.back();
  $('#c-ig').onclick = () => Native.openUrl('https://instagram.com/' + CONTACT.instagram);
  $('#c-mail').onclick = () => Native.openUrl('mailto:' + CONTACT.email);
  if ($('#c-up')) $('#c-up').onclick = async () => {
    const st = $('#up-st'); st.textContent = t('checking');
    try {
      const changed = await refreshIndex();
      const u = await checkUpdate();
      if (u) { st.textContent = t('updAvail', u.v); openUpdateSheet(u); }
      else st.textContent = changed ? t('storiesUpd') : t('latest', Native.version());
    } catch (e) { st.textContent = t('checkFail'); }
  };
  if ($('#c-clr')) if ($('#c-clr')) $('#c-clr').onclick = () => { Native.remove('audio'); Native.remove('img'); Object.keys(imgJobs).forEach(k => delete imgJobs[k]); toast(t('removed')); render(window.scrollY); };
}

/* ---------- Exercises (checked on the spot) ---------- */
function seeded(seed) { let s = (Math.imul(seed >>> 0 || 1, 2654435761) >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function shuffled(a, seed) { const r = seeded(seed), b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function shuffledDiff(a, seed) { let b, k = 0; do { b = shuffled(a, seed + k * 101); k++; } while (k < 20 && a.length > 1 && b.join('|') === a.join('|')); return b; }
const fb = (ok, right) => `<div class="fb ${ok ? 'ok' : 'bad'}">${ok ? I.check + t('correct') : I.x + t('correctAns') + `<span dir="ltr">${esc(right)}</span>`}</div>`;

function viewExercises(app, id) {
  const entry = INDEX.lessons.find(l => l.id === id), seed = parseInt(id, 10) * 7919;
  app.innerHTML = bar(t('practice'), btn('b-back', I.back, t('back')), '') + `<div class="page ex"><div class="kicker" dir="ltr">${esc(entry.title)}</div><h1>${t('practice')}</h1><div id="ex-body"><div class="loading"><div class="spin"></div>${t('loading')}</div></div></div>`;
  $('#b-back').onclick = () => App.back();
  loadLesson(entry).then(les => {
    const ex = les.ex, B = $('#ex-body');
    const score = { right: 0, total: 0 };
    const tally = ok => { score.total++; if (ok) score.right++; const s = $('#ex-score'); if (s) s.textContent = t('score', score.right, score.total); };
    const sec = (L, title, help, body) => `<section class="exs"><div class="exh"><span>${L}</span><div><b>${title}</b><small>${help}</small></div></div>${body}</section>`;
    const order = shuffledDiff(ex.order, seed + 1);
    const defs = shuffled(ex.match, seed + 2);
    const vfor = w => les.vocab.find(v => v.w === w) || { w, en: w };
    B.innerHTML = `<p class="sub" id="ex-score">${t('exIntro')}</p>` +
      sec('A', t('tfT'), t('tfH'), ex.tf.map((q, i) => `<div class="q" data-tf="${i}"><p dir="ltr">${esc(q[0])}</p><div class="opts"><button data-a="1">${t('True')}</button><button data-a="0">${t('False')}</button></div></div>`).join('')) +
      sec('B', t('ordT'), t('ordH'), `<div class="ord" dir="ltr">${order.map(s => `<button class="oi" data-s="${esc(s)}"><span class="num"></span><span>${esc(s)}</span></button>`).join('')}</div><div class="ord-fb"></div><button class="btn ghost sm" id="ord-reset">${I.refresh}${t('again')}</button>`) +
      sec('C', t('scrT'), t('scrH'), ex.scramble.map((s, i) => { const words = s.replace(/[.!?]$/, '').split(/\s+/);
        return `<div class="q scr" data-sc="${i}" dir="ltr"><div class="built"></div><div class="chips">${shuffledDiff(words, seed + 10 + i).map((w, j) => `<button class="chip" data-j="${j}">${esc(w)}</button>`).join('')}</div><div class="scr-fb"></div></div>`; }).join('')) +
      sec('D', t('gapT'), t('gapH'), ex.gap.items.map((q, i) => `<div class="q" data-gap="${i}" dir="ltr"><p>${esc(q).replace('___', '<span class="gap">______</span>')}</p><div class="opts wrap">${ex.gap.bank.slice().sort().map(w => `<button data-a="${esc(w)}">${esc(w)}</button>`).join('')}</div></div>`).join('')) +
      sec('E', t('mT'), t('mH'), ex.match.map((w, i) => `<div class="q" data-m="${i}" dir="ltr"><p><b>${esc(w)}</b></p><div class="opts col">${defs.map(d => `<button data-a="${esc(d)}">${esc(vfor(d).en)}</button>`).join('')}</div></div>`).join('')) +
      sec('F', t('spT'), t('spH'), ex.spot.map((q, i) => `<div class="q" data-sp="${i}"><p dir="ltr">${esc(q[0]).replace(/\*([^*]+)\*/, '<b>$1</b>')}</p><div class="opts"><button data-a="1">${t('Right')}</button><button data-a="0">${t('Wrong')}</button></div></div>`).join(''));

    // single-choice questions: lock after the first answer, show feedback
    const single = (sel, rightOf, label) => B.querySelectorAll(sel).forEach(q => q.querySelectorAll('.opts button').forEach(b => b.onclick = () => {
      if (q.dataset.done) return; q.dataset.done = 1;
      const right = rightOf(q), ok = b.dataset.a === right;
      q.querySelectorAll('.opts button').forEach(x => { x.disabled = true; if (x.dataset.a === right) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      const g = q.querySelector('.gap'); if (g) { g.textContent = right; g.classList.add(ok ? 'right' : 'wrong'); }
      q.insertAdjacentHTML('beforeend', fb(ok, label(q, right))); tally(ok);
    }));
    single('[data-tf]', q => ex.tf[q.dataset.tf][1] ? '1' : '0', (q, r) => r === '1' ? t('True') : t('False'));
    single('[data-gap]', q => ex.gap.bank[q.dataset.gap], (q, r) => r);
    single('[data-m]', q => ex.match[q.dataset.m], (q, r) => vfor(r).en);
    single('[data-sp]', q => ex.spot[q.dataset.sp][1] ? '1' : '0', (q, r) => r === '1' ? t('Right') : t('Wrong'));

    // ordering
    let picked = [];
    const ordItems = [...B.querySelectorAll('.oi')];
    const ordReset = () => { picked = []; ordItems.forEach(b => { b.className = 'oi'; b.disabled = false; b.querySelector('.num').textContent = ''; b.querySelector('.cor') && b.querySelector('.cor').remove(); }); B.querySelector('.ord-fb').innerHTML = ''; };
    ordItems.forEach(b => b.onclick = () => {
      if (b.classList.contains('picked')) return;
      picked.push(b); b.classList.add('picked'); b.querySelector('.num').textContent = picked.length;
      if (picked.length < ordItems.length) return;
      let good = 0;
      picked.forEach((x, i) => { const ri = ex.order.indexOf(x.dataset.s), ok = ri === i; if (ok) good++;
        x.classList.add(ok ? 'right' : 'wrong'); x.disabled = true;
        if (!ok) x.insertAdjacentHTML('beforeend', `<small class="cor">${t('shouldBe', ri + 1)}</small>`); });
      B.querySelector('.ord-fb').innerHTML = fb(good === ordItems.length, ex.order.map((s, i) => `${i + 1}. ${s}`).join('  '));
      tally(good === ordItems.length);
    });
    $('#ord-reset').onclick = ordReset;

    // scrambled sentences
    B.querySelectorAll('[data-sc]').forEach(q => {
      const target = ex.scramble[q.dataset.sc].replace(/[.!?]$/, ''), built = q.querySelector('.built'), out = [];
      const check = () => {
        if (out.length !== q.querySelectorAll('.chip').length) return;
        const ok = out.map(b => b.textContent).join(' ').toLowerCase() === target.toLowerCase();
        q.querySelectorAll('.chip').forEach(c => c.disabled = true);
        built.classList.add(ok ? 'right' : 'wrong');
        q.querySelector('.scr-fb').innerHTML = fb(ok, ex.scramble[q.dataset.sc]); tally(ok);
      };
      q.querySelectorAll('.chip').forEach(c => c.onclick = () => {
        if (c.disabled) return;
        if (c.parentNode === built) { out.splice(out.indexOf(c), 1); q.querySelector('.chips').appendChild(c); }
        else { out.push(c); built.appendChild(c); check(); }
      });
    });
  }, () => { $('#ex-body').innerHTML = `<div class="empty">${t('exFail')}</div>`; });
}

/* ---------- Flashcards: spaced repetition in the style of Anki (SM-2) ---------- */
const MIN = 60000, DAY = 86400000;
const SRS = {
  words: null,
  load() { try { return JSON.parse(localStorage.getItem('srs') || '{}'); } catch (e) { return {}; } },
  save(d) { localStorage.setItem('srs', JSON.stringify(d)); },
  today() { const d = new Date(); d.setHours(4, 0, 0, 0); if (Date.now() < d) d.setDate(d.getDate() - 1); return d.getTime(); }, // a new day starts at 4am
  dayLog() { let l = {}; try { l = JSON.parse(localStorage.getItem('srsday') || '{}'); } catch (e) {} if (l.day !== this.today()) l = { day: this.today(), fresh: 0 }; return l; },
  async all() {
    if (this.words) return this.words;
    const out = [];
    for (const [i, e] of INDEX.lessons.entries()) { if (isLocked(e)) continue; try { const les = await loadLesson(e); les.vocab.forEach(v => out.push({ key: e.id + ':' + v.w, n: i + 1, ...v })); } catch (err) {} }
    return (this.words = out);
  },
  async counts() {
    const W = await this.all(), d = this.load(), now = Date.now(), end = this.today() + DAY, log = this.dayLog();
    let due = 0, seen = 0;
    W.forEach(w => { const c = d[w.key]; if (c) { seen++; if (c.due < (c.s === 'review' ? end : now + 20 * MIN)) due++; } });
    return { total: W.length, due, fresh: Math.max(0, Math.min(S.newPerDay - log.fresh, W.length - seen)) };
  },
  async next() {
    const W = await this.all(), d = this.load(), now = Date.now(), end = this.today() + DAY, log = this.dayLog();
    const learn = W.filter(w => d[w.key] && d[w.key].s !== 'review' && d[w.key].due <= now).sort((a, b) => d[a.key].due - d[b.key].due);
    if (learn.length) return learn[0];
    const rev = W.filter(w => d[w.key] && d[w.key].s === 'review' && d[w.key].due < end).sort((a, b) => d[a.key].due - d[b.key].due);
    if (rev.length) return rev[0];
    if (log.fresh < S.newPerDay) { const n = W.find(w => !d[w.key]); if (n) return n; }
    const ahead = W.filter(w => d[w.key] && d[w.key].s !== 'review' && d[w.key].due <= now + 20 * MIN).sort((a, b) => d[a.key].due - d[b.key].due);
    return ahead[0] || null;
  },
  // what each button would do: returns the new card state
  schedule(c, g) {
    const now = Date.now(), STEPS = [1, 10], RELEARN = [10];
    c = c ? { ...c } : { s: 'new', step: 0, ease: 2.5, ivl: 0, reps: 0, lapses: 0 };
    const grad = days => Object.assign(c, { s: 'review', ivl: days, due: this.today() + days * DAY, step: 0 });
    if (c.s === 'new' || c.s === 'learn') {
      c.s = 'learn';
      if (g === 1) { c.step = 0; c.due = now + STEPS[0] * MIN; }
      else if (g === 2) { c.due = now + (c.step === 0 ? (STEPS[0] + STEPS[1]) / 2 : STEPS[c.step]) * MIN; }
      else if (g === 3) { c.step++; if (c.step >= STEPS.length) grad(1); else c.due = now + STEPS[c.step] * MIN; }
      else grad(4);
    } else if (c.s === 'relearn') {
      if (g <= 2) c.due = now + RELEARN[0] * MIN; else grad(Math.max(1, c.ivl));
    } else {
      if (g === 1) { c.lapses++; c.ease = Math.max(1.3, c.ease - 0.2); c.ivl = Math.max(1, Math.round(c.ivl * 0.2)); c.s = 'relearn'; c.due = now + RELEARN[0] * MIN; }
      else if (g === 2) { c.ease = Math.max(1.3, c.ease - 0.15); grad(Math.max(c.ivl + 1, Math.round(c.ivl * 1.2))); }
      else if (g === 3) grad(Math.max(c.ivl + 1, Math.round(c.ivl * c.ease)));
      else { c.ease += 0.15; grad(Math.max(c.ivl + 1, Math.round(c.ivl * c.ease * 1.3))); }
    }
    c.reps++; return c;
  },
  label(c) { const ms = c.due - Date.now(); if (c.s === 'review') return c.ivl >= 30 ? Math.round(c.ivl / 30 * 10) / 10 + ' mo' : c.ivl + ' d'; return ms < 60 * MIN ? Math.max(1, Math.round(ms / MIN)) + ' min' : Math.round(ms / 3600000) + ' h'; },
  answer(w, g) {
    const d = this.load(), isNew = !d[w.key];
    d[w.key] = this.schedule(d[w.key], g); this.save(d);
    if (isNew) { const l = this.dayLog(); l.fresh++; localStorage.setItem('srsday', JSON.stringify(l)); }
  },
};

function viewCards(app) {
  app.innerHTML = bar(t('flashcards'), btn('b-back', I.back, t('back')), btn('b-opt', I.sliders, t('cardsOpt'))) + `<div class="page cards"><h1>${t('flashcards')}</h1><div id="cd"><div class="loading"><div class="spin"></div>${t('preparing')}</div></div></div>`;
  $('#b-back').onclick = () => App.back();
  $('#b-opt').onclick = () => {
    const sh = openSheet(`<h3>${t('flashcards')}</h3><p class="sub">${t('perDay')}</p>
      <div class="seg" id="npd">${[5, 10, 15, 20, 30].map(n => `<button data-v="${n}" class="${S.newPerDay === n ? 'on' : ''}">${n}</button>`).join('')}</div>
      <button class="link" id="srs-reset" style="margin-top:18px">${I.trash}<div class="tx">${t('reset')}<small>${t('resetSub')}</small></div></button>`);
    sh.querySelectorAll('#npd button').forEach(b => b.onclick = () => { S.newPerDay = +b.dataset.v; saveSettings(); closeSheet(); show(); });
    $('#srs-reset').onclick = () => { localStorage.removeItem('srs'); localStorage.removeItem('srsday'); closeSheet(); toast(t('resetDone')); show(); };
  };
  const show = async () => {
    const box = $('#cd'); if (!box) return;
    const w = await SRS.next(), c = await SRS.counts();
    if (!w) { box.innerHTML = `<div class="done-card">${I.check}<h2>${t('allDone')}</h2><p>${c.total ? t('comeBack') : t('noWords')}</p></div>`; return; }
    const st = SRS.load()[w.key];
    const sent = esc(w.s).replace(new RegExp('\\b(' + w.w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*)', 'i'), '<b>$1</b>');
    box.innerHTML = `<div class="cstat"><span>${t('toReview', c.due)}</span><span>${t('nNew', c.fresh)}</span></div>
      <div class="card"><small>${st ? t('review') : t('newWord')} · ${t('lessonN', w.n)}</small><div class="cw" dir="ltr">${esc(w.w)}</div><p class="cs" dir="ltr">${sent}</p>
        <div class="back" hidden><div class="ce" dir="ltr">${esc(w.en)}</div><div class="fa cf">${esc(w.fa)}</div><div class="fa cfs">${esc(w.sfa)}</div></div></div>
      <button class="btn wide" id="c-show">${t('showAns')}</button>
      <div class="grades" hidden>${[[t('g1'), 1], [t('g2'), 2], [t('g3'), 3], [t('g4'), 4]].map(([l, g]) => `<button data-g="${g}"><b>${l}</b><small>${SRS.label(SRS.schedule(st, g))}</small></button>`).join('')}</div>`;
    $('#c-show').onclick = () => { box.querySelector('.back').hidden = false; $('#c-show').hidden = true; box.querySelector('.grades').hidden = false; };
    box.querySelectorAll('.grades button').forEach(b => b.onclick = () => { SRS.answer(w, +b.dataset.g); show(); });
  };
  show();
}

/* ---------- Licence: the first story is free, a key opens the rest ----------
   content/licences.json holds only salted SHA-256 hashes of the keys, so the list cannot be turned back into keys. */
const LIC_SALT = 'once-upon-a-fable:v1:';
const Lic = {
  key: null,
  load() { try { this.key = localStorage.getItem('licence') || Native.readText('licence.txt') || null; } catch (e) { this.key = null; } },
  norm: k => String(k || '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
  pretty(k) { return (this.norm(k).match(/.{1,4}/g) || []).join('-'); },
  async hash(k) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(LIC_SALT + this.norm(k)));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 20);
  },
  async list() {
    try { const l = await remoteJSON('licences.json'); Native.writeText('content/licences.json', JSON.stringify(l)); return { l, remote: true }; }
    catch (e) { let l = readJSON('content/licences.json'); if (!l) { try { l = await bundledJSON('licences.json'); } catch (e2) {} } return { l, remote: false }; }
  },
  async check(k) {
    if (this.norm(k).length !== 12) return 'bad';
    const h = await this.hash(k), { l, remote } = await this.list();
    if (l && l.h.includes(h)) return 'ok';
    return remote ? 'bad' : 'offline';
  },
  save(k) { this.key = this.pretty(k); try { localStorage.setItem('licence', this.key); } catch (e) {} Native.writeText('licence.txt', this.key); },
  clear() { this.key = null; try { localStorage.removeItem('licence'); } catch (e) {} Native.remove('licence.txt'); },
  // a revoked key relocks the next time the phone is online; offline it stays open
  async recheck() {
    if (!this.key) return false;
    try { const l = await remoteJSON('licences.json'); Native.writeText('content/licences.json', JSON.stringify(l)); if (!l.h.includes(await this.hash(this.key))) { this.clear(); return true; } } catch (e) {}
    return false;
  },
};
const isLocked = l => !Lic.key && INDEX.lessons.indexOf(l) > 0;
function openUnlockSheet() {
  const sh = openSheet(`<h3>${t('unlockT')}</h3><p class="sub">${t('unlockSub', INDEX.lessons.length)}</p>
    <input class="key-in" id="k-in" dir="ltr" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="${t('keyPh')}" maxlength="14" inputmode="text">
    <div class="key-msg" id="k-msg" role="alert"></div>
    <button class="btn wide" id="k-go">${t('unlock')}</button>
    <p class="sub" style="margin:24px 0 2px">${t('buyHow')}</p>
    <button class="link" id="k-ig">${I.camera}<div class="tx">Instagram<small>@${esc(CONTACT.instagram)}</small></div>${I.chevron}</button>
    <button class="link" id="k-mail">${I.mail}<div class="tx">${t('email')}<small>${esc(CONTACT.email)}</small></div>${I.chevron}</button>`);
  const inp = $('#k-in', sh), msg = $('#k-msg', sh), go = $('#k-go', sh);
  inp.oninput = () => { const p = Lic.pretty(inp.value).slice(0, 14); if (p !== inp.value) inp.value = p; msg.textContent = ''; };
  inp.onkeydown = e => { if (e.key === 'Enter') go.click(); };
  $('#k-ig', sh).onclick = () => Native.openUrl('https://instagram.com/' + CONTACT.instagram);
  $('#k-mail', sh).onclick = () => Native.openUrl('mailto:' + CONTACT.email);
  go.onclick = async () => {
    if (!Lic.norm(inp.value)) { inp.focus(); return; }
    go.disabled = true; go.textContent = t('checkingKey'); msg.textContent = '';
    let r; try { r = await Lic.check(inp.value); } catch (e) { r = 'offline'; }
    go.disabled = false; go.textContent = t('unlock');
    if (r !== 'ok') { msg.textContent = t(r === 'bad' ? 'badKey' : 'keyOffline'); return; }
    Lic.save(inp.value); SRS.words = null; closeSheet(); toast(t('unlocked')); render(window.scrollY);
  };
}

/* ---------- First run: language, then short guided tours ---------- */
function chooseLanguage() {
  return new Promise(res => {
    const w = document.createElement('div'); w.className = 'welcome';
    w.innerHTML = `<div class="wl-in"><div class="about-mark">${I.book}</div><h1>Once Upon a Fable</h1>
      <p class="fa">زبان برنامه را انتخاب کنید</p><p>Choose the app language</p>
      <button class="btn wide fa-btn" data-l="fa">فارسی</button><button class="btn ghost wide" data-l="en">English</button>
      <small><span class="fa">می‌توانید بعداً آن را در تنظیمات تغییر دهید</span><br>You can change it later in Settings</small></div>`;
    document.body.appendChild(w);
    w.querySelectorAll('[data-l]').forEach(b => b.onclick = () => {
      S.lang = b.dataset.l; saveSettings();
      try { localStorage.setItem('lang-chosen', '1'); } catch (e) {}
      w.classList.add('out'); setTimeout(() => w.remove(), 250); res();
    });
  });
}
const TOURS = {
  home: [{ k: 'tWelcome' }, { sel: '.list .row', k: 'tStory' }, { sel: '#b-cards', k: 'tCards' }, { sel: '#b-set', k: 'tSet' }, { sel: '#b-about', k: 'tAbout' }],
  lesson: [{ sel: '#t-full', k: 'tTr' }, { sel: '.story .w.v', k: 'tWord' }, { sel: '#b-ex', k: 'tEx' }, { sel: '#b-listen', k: 'tListen', top: true, act: 'listenNow', go: () => $('#b-listen').click() }],
  player: [{ sel: '#player .top', k: 'tPlay' }, { sel: '#pl-sp', k: 'tSpd' }, { sel: '.pl-tg', k: 'tPlTg' }],
};
const Tour = {
  on: false,
  seen() { try { return JSON.parse(localStorage.getItem('tours') || '{}'); } catch (e) { return {}; } },
  mark(n) { const s = this.seen(); s[n] = 1; try { localStorage.setItem('tours', JSON.stringify(s)); } catch (e) {} },
  reset() { try { localStorage.removeItem('tours'); } catch (e) {} },
  maybe(n) { if (this.on || this.seen()[n] || !localStorage.getItem('lang-chosen')) return; setTimeout(() => this.run(n), n === 'home' ? 350 : 800); },
  run(n) {
    if (this.on || this.seen()[n]) return;
    const steps = TOURS[n].filter(s => !s.sel || $(s.sel)); if (!steps.length) return;
    this.on = true; this.mark(n);
    const ov = document.createElement('div');
    ov.className = 'tour'; ov.innerHTML = '<div class="tour-hole"></div><div class="tour-card" role="dialog" aria-live="polite"></div>';
    document.body.appendChild(ov);
    const hole = ov.firstChild, card = ov.lastChild;
    let i = 0, el = null;
    const place = () => {
      const W = window.innerWidth, H = window.innerHeight;
      if (el) {
        const r = el.getBoundingClientRect(), p = 6;
        Object.assign(hole.style, { left: r.left - p + 'px', top: r.top - p + 'px', width: r.width + 2 * p + 'px', height: r.height + 2 * p + 'px' });
        const ch = card.offsetHeight, below = r.bottom + p + 14;
        card.style.top = (below + ch < H - 12 || r.top < ch + 30 ? Math.min(below, H - ch - 12) : r.top - p - 14 - ch) + 'px';
      } else {
        Object.assign(hole.style, { left: W / 2 + 'px', top: H / 2 + 'px', width: '0px', height: '0px' });
        card.style.top = Math.max(16, (H - card.offsetHeight) / 2) + 'px';
      }
    };
    let alive = true; const loop = () => { if (!alive) return; place(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
    const end = () => { alive = false; ov.remove(); this.on = false; window.removeEventListener('resize', place); if (n === 'lesson') smoothTo(0); };
    const show = () => {
      const s = steps[i]; el = s.sel ? $(s.sel) : null;
      if (s.top) smoothTo(0); else if (el && !el.closest('.bar') && !el.closest('#player')) { const r = el.getBoundingClientRect(), H = window.innerHeight; if (r.top < 70 || r.bottom > H * 0.5) smoothTo(window.scrollY + r.top - H * 0.3); }
      card.innerHTML = `<small>${t('stepOf', i + 1, steps.length)}</small><b>${t(s.k + 'T')}</b><p>${t(window.IS_WEB && s.k === 'tAbout' ? 'tAboutWeb' : s.k)}</p>
        <div class="tour-btns"><button class="tour-skip" id="tr-skip">${i < steps.length - 1 ? t('skip') : ''}</button>
        ${i ? `<button class="btn ghost sm" id="tr-prev">${t('prev')}</button>` : ''}<button class="btn sm" id="tr-next">${s.act ? t(s.act) : i === steps.length - 1 ? t('done') : t('next')}</button></div>`;
      $('#tr-skip', card).onclick = end;
      if ($('#tr-prev', card)) $('#tr-prev', card).onclick = () => { i--; show(); };
      $('#tr-next', card).onclick = () => { const go = s.go; if (++i >= steps.length) { end(); if (go) go(); } else show(); };
      place(); requestAnimationFrame(place);
    };
    window.addEventListener('resize', place);
    show();
  },
};
window.Tour = Tour;

/* ---------- Start ---------- */
(async function start() {
  applySettings();
  Lic.load();
  await loadIndex();
  if (!localStorage.getItem('lang-chosen')) await chooseLanguage();
  App.go('home');
  const changed = await refreshIndex(), relocked = await Lic.recheck();
  if ((changed || relocked) && stack.length === 1) render(window.scrollY);
  setTimeout(async () => { try { const u = await checkUpdate(); if (u && $('#sheet-wrap').hidden && !Tour.on) openUpdateSheet(u); } catch (e) {} }, 1200);
})();
