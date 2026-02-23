/* DOM refs, state, utilities, and all rendering/interaction logic. Loaded before app.js. */

const $ = id => document.getElementById(id);
const countryInput = $('countryInput'), languageInput = $('languageInput');
const applyConfig = $('applyConfig'), channelListEl = $('channelList');
const player = $('player'), playerPlaceholder = $('playerPlaceholder');
const btnWorks = $('btnWorks'), btnIgnore = $('btnIgnore'), btnDoesntWork = $('btnDoesntWork'), btnNotMyLang = $('btnNotMyLang');
const resetBtn = $('resetBtn'), refetchBtn = $('refetchBtn'), downloadBtn = $('downloadBtn');
const channelInfo = $('channelInfo'), channelInfoDl = channelInfo?.querySelector('dl');
const lockedOverlay = $('lockedOverlay');

let channels = [], channelsInOrder = [], countriesList = [], languagesList = [];
let selectedId = null, hlsInstance = null, configApplied = false;

function toast(msg, type = 'info') {
  const bg = { info: 'bg-blue-600', success: 'bg-emerald-600', warning: 'bg-amber-600', error: 'bg-red-600' };
  const el = document.createElement('div');
  el.className = `toast ${bg[type] || bg.info} text-white text-sm px-4 py-2 rounded shadow-lg`;
  el.textContent = msg;
  $('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

async function api(path, opts = {}) {
  const r = await fetch(path, opts);
  if (!r.ok) throw new Error(await r.text());
  return r.headers.get('content-type')?.includes('json') ? r.json() : r.text();
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function langMatch(a, b) {
  if (!a || !b) return false;
  a = a.toLowerCase(); b = b.toLowerCase();
  return a === b || a.startsWith(b) || b.startsWith(a);
}

// --- Accordion (localStorage) ---

function getAccordion() { try { return JSON.parse(localStorage.getItem('iptv_accordion') || '{}'); } catch { return {}; } }
function setAccordion(s) { localStorage.setItem('iptv_accordion', JSON.stringify(s)); }

function ensureGroupOpen(code) {
  const state = getAccordion();
  if (state[code] === false) {
    state[code] = true;
    setAccordion(state);
    channelListEl.querySelectorAll(`[data-group="${code}"]`).forEach(el => el.classList.remove('hidden'));
    const hdr = channelListEl.querySelector(`[data-toggle="${code}"] .chevron`);
    if (hdr) hdr.classList.remove('collapsed');
  }
}

// --- Rendering ---

function getFilteredChannelsForDisplay() {
  const code = getDesiredLangCode();
  if (!code) return channels;
  return channels.filter(ch => {
    const langs = (ch.languages || []).map(x => String(x).toLowerCase());
    return langs.length === 0 || langs.includes(code);
  });
}

function renderChannelList() {
  const list = getFilteredChannelsForDisplay();
  const byCountry = {};
  list.forEach(ch => { const c = ch.group || 'Other'; (byCountry[c] ||= []).push(ch); });
  const codes = Object.keys(byCountry).sort((a, b) => {
    const nA = (countriesList.find(c => c.code === a)?.name || a).toLowerCase();
    const nB = (countriesList.find(c => c.code === b)?.name || b).toLowerCase();
    return nA.localeCompare(nB);
  });
  const accordion = getAccordion();
  channelsInOrder = [];
  let html = '';
  codes.forEach(code => {
    const name = countriesList.find(c => c.code === code)?.name || code;
    const count = byCountry[code].length;
    const open = accordion[code] !== false;
    html += `<li data-toggle="${code}" class="px-2 py-1.5 text-stone-500 text-xs font-medium uppercase tracking-wide sticky top-0 bg-stone-100 border-b border-stone-200 cursor-pointer select-none flex items-center gap-1">
      <span class="chevron${open ? '' : ' collapsed'}">▾</span>
      <span class="flex-1">${name} (${code})</span>
      <span class="text-stone-400 font-normal normal-case">${count}</span></li>`;
    byCountry[code].forEach(ch => {
      channelsInOrder.push(ch);
      const bg = ch.status === 'works' ? 'bg-emerald-50 border-emerald-200'
        : ch.status === 'ignored' ? 'bg-sky-50 border-sky-200' : 'bg-white border-stone-100';
      const ring = ch.id === selectedId ? 'ring-2 ring-amber-500' : '';
      const badge = ch.status === 'works' ? '<span class="text-emerald-500 text-xs shrink-0">✓</span>'
        : ch.status === 'ignored' ? '<span class="text-sky-400 text-xs shrink-0">—</span>' : '';
      html += `<li data-id="${ch.id}" data-group="${code}" class="border ${bg} ${ring} rounded p-2 mb-1 flex items-center gap-2 group${open ? '' : ' hidden'}">
        <img src="${ch.logo || ''}" alt="" class="w-10 h-10 rounded object-cover bg-stone-200 shrink-0" onerror="this.src=''" />
        <div class="min-w-0 flex-1 cursor-pointer" data-click="channel"><div class="font-medium text-stone-800 truncate">${ch.name || ch.id}</div></div>
        ${badge}
        <button type="button" class="shrink-0 p-1 rounded text-stone-400 hover:text-stone-600 hover:bg-stone-200 opacity-0 group-hover:opacity-100 transition-opacity" data-action="hide" title="Hide" aria-label="Hide">✕</button></li>`;
    });
  });
  channelListEl.innerHTML = html;
  channelListEl.querySelectorAll('[data-toggle]').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const c = hdr.dataset.toggle, state = getAccordion();
      const nowOpen = state[c] === false;
      state[c] = nowOpen;
      setAccordion(state);
      hdr.querySelector('.chevron').classList.toggle('collapsed', !nowOpen);
      channelListEl.querySelectorAll(`[data-group="${c}"]`).forEach(el => el.classList.toggle('hidden', !nowOpen));
    });
  });
  channelListEl.querySelectorAll('li[data-id]').forEach(li => {
    const id = li.dataset.id;
    li.querySelector('[data-click="channel"]')?.addEventListener('click', () => {
      if (!configApplied) { toast('Apply your config first', 'warning'); return; }
      loadStream(channels.find(c => c.id === id));
    });
    li.querySelector('[data-action="hide"]')?.addEventListener('click', e => {
      e.stopPropagation();
      if (!configApplied) { toast('Apply your config first', 'warning'); return; }
      hideChannel(id);
    });
  });
  scrollToSelected();
}

function scrollToSelected() {
  if (!selectedId) return;
  channelListEl.querySelector(`li[data-id="${selectedId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// --- Player ---

function loadStream(ch) {
  if (!ch?.streams?.length || !configApplied) return;
  selectedId = ch.id;
  ensureGroupOpen(ch.group || 'Other');
  playerPlaceholder.classList.add('hidden');
  player.classList.remove('hidden');
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
  const url = ch.streams[0];
  if (url.includes('.m3u8') && Hls.isSupported()) {
    hlsInstance = new Hls({ enableWebVTT: true, enableCEA708Captions: true });
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(player);
    hlsInstance.on(Hls.Events.SUBTITLE_TRACKS_LOADED, () => {
      const lang = getDesiredLangCode();
      if (!hlsInstance.subtitleTracks.length) return;
      const idx = lang ? hlsInstance.subtitleTracks.findIndex(t => langMatch(t.lang, lang)) : -1;
      hlsInstance.subtitleTrack = idx >= 0 ? idx : 0;
      hlsInstance.subtitleDisplay = true;
    });
  } else {
    player.src = url;
  }
  player.muted = false;
  player.autoplay = true;
  player.addEventListener('loadeddata', () => {
    player.muted = false;
    player.play().catch(() => {});
    enableNativeSubtitles();
  }, { once: true });
  player.play().catch(() => {});
  [btnWorks, btnIgnore, btnDoesntWork, btnNotMyLang].forEach(b => b.disabled = false);
  renderChannelList();
  renderChannelInfo(ch);
}

function enableNativeSubtitles() {
  const lang = getDesiredLangCode();
  if (!player.textTracks.length) return;
  for (const t of player.textTracks) {
    if (lang && langMatch(t.language, lang)) { t.mode = 'showing'; return; }
  }
  if (player.textTracks.length) player.textTracks[0].mode = 'showing';
}

function renderChannelInfo(ch) {
  if (!channelInfoDl || !ch) { channelInfo?.classList.add('hidden'); return; }
  const country = countriesList.find(c => c.code === ch.group)?.name || ch.group || '—';
  const langs = (ch.languages || []).map(c => languagesList.find(l => l.code === c)?.name || c).join(', ') || '—';
  const status = { works: 'Added', ignored: 'Ignored', doesnt_work: "Doesn't work", not_my_language: 'Not my language' }[ch.status] || 'Unchecked';
  const n = (ch.streams || []).length;
  channelInfoDl.innerHTML = [
    ['Name', ch.name || ch.id || '—'], ['ID', ch.id || '—'], ['Country', country],
    ['Languages', langs], ['Status', status], ['Streams', n + (n === 1 ? ' URL' : ' URLs')],
    ['Stream URL', ch.streams?.[0] || '—']
  ].map(([l, v]) => `<dt class="text-stone-500">${l}</dt><dd class="break-all">${esc(String(v))}</dd>`).join('');
  channelInfo.classList.remove('hidden');
}

// --- Navigation ---

function clearPlayer() {
  selectedId = null;
  playerPlaceholder.textContent = 'All channels reviewed!';
  playerPlaceholder.classList.remove('hidden');
  player.classList.add('hidden');
  channelInfo?.classList.add('hidden');
  [btnWorks, btnIgnore, btnDoesntWork, btnNotMyLang].forEach(b => b.disabled = true);
}

async function hideChannel(id) {
  const curIdx = channelsInOrder.findIndex(c => c.id === id);
  const next = channelsInOrder.slice(curIdx + 1).find(c => c.id !== id && !c.status && c.streams?.length);
  await api('/api/channels/' + encodeURIComponent(id) + '/hide', { method: 'POST' });
  channels = channels.filter(c => c.id !== id);
  renderChannelList();
  if (selectedId === id) {
    if (next && channels.some(c => c.id === next.id)) loadStream(next);
    else clearPlayer();
  }
}

async function markChannel(path) {
  if (!selectedId || !configApplied) return;
  const curIdx = channelsInOrder.findIndex(c => c.id === selectedId);
  const next = channelsInOrder.slice(curIdx + 1).find(c => c.id !== selectedId && !c.status && c.streams?.length);
  await api('/api/channels/' + encodeURIComponent(selectedId) + '/' + path, { method: 'POST' });
  if (path === 'works') {
    const ch = channels.find(c => c.id === selectedId);
    if (ch) ch.status = 'works';
    toast('Added to list', 'success');
  } else if (path === 'ignore') {
    const ch = channels.find(c => c.id === selectedId);
    if (ch) ch.status = 'ignored';
    toast('Ignored — skipped', 'info');
  }
  if (path === 'doesnt-work' || path === 'not-my-language') channels = channels.filter(c => c.id !== selectedId);
  renderChannelList();
  if (next && channels.some(c => c.id === next.id)) loadStream(channels.find(c => c.id === next.id));
  else clearPlayer();
  refreshDownloadBtn();
}
