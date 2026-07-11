const $ = (sel) => document.querySelector(sel);

const hostEl   = $('#host');
const portEl   = $('#port');
const bypassEl = $('#bypass');
const applyBtn = $('#apply');
const toggleBtn = $('#toggle');
const pill     = $('#status-pill');
const statusTx = $('#status-text');
const errorBar = $('#error-bar');
const errorMsg = $('#error-msg');

let busy = false;
let proxyOn = false;

async function init() {
  try {
    const stored = await chrome.runtime.sendMessage({ action: 'getStatus' });

    if (!stored) {
      showError('Service worker not ready. Reopen popup.');
      return;
    }

    hostEl.value   = stored.proxyHost    || '';
    portEl.value   = stored.proxyPort    || 1080;
    bypassEl.value = stored.bypassList   || '<local>';
    proxyOn = !!stored.proxyEnabled;

    renderState(proxyOn);
  } catch (err) {
    showError('Init failed: ' + err.message);
  }
}

function renderState(on) {
  if (on) {
    pill.className = 'pill pill-on';
    statusTx.textContent = 'connected';
    toggleBtn.classList.add('active');
    applyBtn.innerHTML = '<span class="btn-icon">&#9632;</span> Disconnect';
  } else {
    pill.className = 'pill pill-off';
    statusTx.textContent = 'disconnected';
    toggleBtn.classList.remove('active');
    applyBtn.innerHTML = '<span class="btn-icon">&#9654;</span> Connect';
  }
  hideError();
}

function renderError() {
  pill.className = 'pill pill-error';
  statusTx.textContent = 'error';
}

function setBusy(state) {
  busy = state;
  applyBtn.disabled = state;
  toggleBtn.disabled = state;
  hostEl.disabled = state;
  portEl.disabled = state;
  bypassEl.disabled = state;
}

function showError(text) {
  errorMsg.textContent = text;
  errorBar.classList.remove('hidden');
}

function hideError() {
  errorBar.classList.add('hidden');
}

function getInputs() {
  const host   = hostEl.value.trim();
  const port   = Number(portEl.value);
  const bypass = bypassEl.value.trim();
  return { host, port, bypass };
}

function validate({ host, port }) {
  if (!host) return 'Host is required.';
  if (!Number.isInteger(port) || port < 1 || port > 65535) return 'Port must be 1-65535.';
  return null;
}

function doConnect() {
  const { host, port, bypass } = getInputs();
  const err = validate({ host, port });
  if (err) { showError(err); return; }

  setBusy(true);
  chrome.runtime.sendMessage(
    { action: 'enable', host, port, bypassList: bypass },
    (res) => {
      setBusy(false);
      if (chrome.runtime.lastError || !res?.ok) {
        showError(chrome.runtime.lastError?.message || res?.error || 'Connection failed.');
        proxyOn = false;
        renderState(false);
        return;
      }
      proxyOn = true;
      renderState(true);
    }
  );
}

function doDisconnect() {
  setBusy(true);
  chrome.runtime.sendMessage({ action: 'disable' }, (res) => {
    setBusy(false);
    if (chrome.runtime.lastError || !res?.ok) {
      showError(chrome.runtime.lastError?.message || res?.error || 'Disconnect failed.');
      return;
    }
    proxyOn = false;
    renderState(false);
  });
}

applyBtn.addEventListener('click', () => {
  if (busy) return;
  if (proxyOn) {
    doDisconnect();
  } else {
    doConnect();
  }
});

toggleBtn.addEventListener('click', () => {
  if (busy) return;
  if (proxyOn) {
    doDisconnect();
  } else {
    doConnect();
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'proxyError') {
    renderError();
    showError(msg.error);
  }
});

init();
