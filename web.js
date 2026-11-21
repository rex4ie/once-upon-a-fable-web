/* Web version: stands in for the Android shell (window.Native). Audio files live next to this page in audio/<post>.opus. */
window.IS_WEB = true;
(function () {
  const K = 'fs:', audio = new Audio();
  let speed = 1, durs = {}, cur = '';
  fetch('audio/durations.json').then(r => r.json()).then(d => durs = d, () => {});
  audio.preload = 'auto';
  audio.addEventListener('ended', () => window.Bridge && Bridge.ended());
  const ls = { get: k => { try { return localStorage.getItem(K + k) || ''; } catch (e) { return ''; } }, set: (k, v) => { try { localStorage.setItem(K + k, v); } catch (e) {} } };
  const audioUrl = rel => { const m = rel.match(/-(\d+)\.ogg$/); return 'audio/' + (m ? m[1] : '0') + '.opus'; };
  window.Native = {
    version: () => '1.6',
    exists: rel => rel.startsWith('audio/') || !!ls.get(rel),
    readText: rel => ls.get(rel),
    writeText: (rel, t) => ls.set(rel, t),
    remove: rel => { try { Object.keys(localStorage).filter(k => k.startsWith(K + rel)).forEach(k => localStorage.removeItem(k)); } catch (e) {} },
    cacheSize: () => 0,
    get: (id, url) => fetch(url, { cache: 'no-store' }).then(r => r.ok ? r.text() : Promise.reject('HTTP ' + r.status)).then(t => Bridge.done(id, true, t), e => Bridge.done(id, false, String(e))),
    download: id => Bridge.done(id, false, 'web'),
    play: (rel, from) => { audio.src = audioUrl(rel); cur = (rel.match(/-(\d+)\.ogg$/) || [])[1] || ''; audio.currentTime = (from || 0) / 1000; audio.playbackRate = speed; audio.play().catch(() => {}); },
    pause: () => audio.pause(),
    resume: () => { audio.playbackRate = speed; audio.play().catch(() => {}); },
    stop: () => { audio.pause(); audio.removeAttribute('src'); audio.load(); },
    seek: ms => { audio.currentTime = ms / 1000; },
    setSpeed: s => { speed = s; audio.playbackRate = s; },
    position: () => Math.round(audio.currentTime * 1000) || 0,
    duration: () => (isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration * 1000) : durs[cur] || 0),
    playing: () => !audio.paused && !audio.ended,
    openUrl: u => window.open(u, '_blank', 'noopener'),
    setBars: c => { let m = document.querySelector('meta[name=theme-color]'); if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); } m.content = c; },
    installUpdate: id => Bridge.done(id, false, 'web'),
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && window.App) App.back(); });
})();
// The phone's back button / browser back goes back inside the app instead of leaving the site.
history.pushState({ app: 1 }, '');
window.addEventListener('popstate', () => { const stay = window.App && App.back(); if (stay) history.pushState({ app: 1 }, ''); else history.back(); });
