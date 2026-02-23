/* Config, data loading, event listeners, and init. Loaded after ui.js. */

function getDesiredLangCode() {
  const v = languageInput.value.trim();
  const lang = languagesList.find(l => l.name === v || (l.code || '').toLowerCase() === v.toLowerCase());
  return lang?.code?.toLowerCase() || '';
}

function getLangQuery() {
  const code = getDesiredLangCode();
  return code ? '?language=' + encodeURIComponent(code) : '';
}

async function loadConfig() {
  const c = await api('/api/config');
  const cc = (c.testing_country || '').toUpperCase();
  const lc = (c.desired_language || '').toLowerCase();
  countryInput.value = countriesList.find(x => (x.code || '').toUpperCase() === cc)?.name || cc;
  languageInput.value = languagesList.find(x => (x.code || '').toLowerCase() === lc)?.name || lc;
  if (cc && lc) { configApplied = true; updateLockedState(); }
}

async function saveConfig() {
  const cn = countryInput.value.trim(), ln = languageInput.value.trim();
  const country = countriesList.find(c => c.name === cn || (c.code || '').toUpperCase() === cn.toUpperCase());
  const lang = languagesList.find(l => l.name === ln || (l.code || '').toLowerCase() === ln.toLowerCase());
  await api('/api/config', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      testing_country: country ? country.code : '',
      desired_language: lang ? lang.code : (ln.length <= 4 ? ln : '')
    })
  });
}

async function loadCountries() {
  countriesList = await api('/api/countries');
  $('countryList').innerHTML = countriesList.map(c => `<option value="${c.name}">${c.code}</option>`).join('');
}

async function loadLanguages() {
  languagesList = await api('/api/languages');
  $('languageList').innerHTML = languagesList.map(l => `<option value="${l.name}">${l.code}</option>`).join('');
}

function updateLockedState() {
  if (configApplied) lockedOverlay.classList.add('hidden');
  else lockedOverlay.classList.remove('hidden');
}

function slugify(s) { return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }

async function refreshDownloadBtn() {
  try {
    const { count } = await api('/api/works-count');
    downloadBtn.disabled = count === 0;
  } catch { downloadBtn.disabled = true; }
}

async function downloadM3U() {
  const r = await fetch('/api/download-m3u');
  const blob = await r.blob();
  const cfg = await api('/api/config');
  const country = slugify(countriesList.find(c => (c.code || '').toUpperCase() === (cfg.testing_country || '').toUpperCase())?.name || cfg.testing_country || 'unknown');
  const language = slugify(languagesList.find(l => (l.code || '').toLowerCase() === (cfg.desired_language || '').toLowerCase())?.name || cfg.desired_language || 'all');
  const filename = `works_in_${country}_in_${language}.m3u`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function loadChannels() {
  channels = await api('/api/channels' + getLangQuery());
  renderChannelList();
  if (configApplied) {
    const resume = channelsInOrder.find(ch => !ch.status && ch.streams?.length);
    if (resume) loadStream(resume);
  }
  refreshDownloadBtn();
}

// --- Event listeners ---

applyConfig.addEventListener('click', async () => {
  const cn = countryInput.value.trim(), ln = languageInput.value.trim();
  if (!cn || !ln) { toast('Both country and language are required', 'warning'); return; }
  await saveConfig();
  configApplied = true;
  updateLockedState();
  toast('Config saved — reviewing enabled', 'success');
  selectedId = null;
  await loadChannels();
});

resetBtn.addEventListener('click', async () => {
  if (!confirm('Reset database? This clears all saved statuses and re-fetches channels.')) return;
  toast('Resetting database…', 'warning');
  resetBtn.disabled = true;
  try {
    await api('/api/reset', { method: 'POST' });
    toast('Database reset complete', 'success');
    selectedId = null;
    configApplied = false;
    updateLockedState();
    localStorage.removeItem('iptv_accordion');
    await loadCountries();
    await loadLanguages();
    await loadConfig();
    await loadChannels();
  } catch (e) { toast('Reset failed: ' + e.message, 'error'); }
  resetBtn.disabled = false;
});

refetchBtn.addEventListener('click', async () => {
  refetchBtn.disabled = true;
  refetchBtn.textContent = 'Refetching…';
  toast('Refetching channel data from API…', 'info');
  try {
    await api('/api/fetch', { method: 'POST' });
    toast('Channels updated', 'success');
    await loadCountries();
    await loadLanguages();
    await loadChannels();
  } catch (e) { toast('Refetch failed: ' + e.message, 'error'); }
  refetchBtn.disabled = false;
  refetchBtn.textContent = 'Refetch';
});

btnWorks.addEventListener('click', () => markChannel('works'));
btnIgnore.addEventListener('click', () => markChannel('ignore'));
btnDoesntWork.addEventListener('click', () => markChannel('doesnt-work'));
btnNotMyLang.addEventListener('click', () => markChannel('not-my-language'));
downloadBtn.addEventListener('click', downloadM3U);

// --- Init ---

async function initApp() {
  const { ready } = await api('/api/ready');
  if (!ready) {
    playerPlaceholder.textContent = 'Fetching channels from API…';
    toast('First load — downloading channel data…', 'info');
    try {
      await api('/api/fetch', { method: 'POST' });
      toast('Channel data ready', 'success');
    } catch (e) {
      playerPlaceholder.textContent = 'Failed to fetch channels';
      toast('Fetch failed: ' + e.message, 'error');
      return;
    }
  }
  await loadCountries();
  await loadLanguages();
  await loadConfig();
  updateLockedState();
  await loadChannels();
}

initApp();
