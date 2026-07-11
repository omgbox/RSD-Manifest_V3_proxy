const $ = (sel) => document.querySelector(sel);

const toggle   = $('#toggle');
const label    = $('#toggle-label');
const hostEl   = $('#host');
const portEl   = $('#port');
const bypassEl = $('#bypass');
const applyBtn = $('#apply');
const dot      = $('#status-dot');
const statusTx = $('#status-text');
const errorMsg = $('#error-msg');

let busy = false;

async function init() {
  try {
    const stored = await chrome.runtime.sendMessage({ action: 'getStatus' });

    if (!stored) {
      showError('Extension service worker is not ready. Reopen the popup.');
      return;
    }

    hostEl.value   = stored.proxyHost    || '';
    portEl.value   = stored.proxyPort    || 1080;
    bypassEl.value = stored.bypassList   || '<local>';
    toggle.checked = !!stored.proxyEnabled;

    updateUI(stored.proxyEnabled);
  } catch (err) {
    showError('Failed to initialize: ' + err.message);
  }
}

function updateUI(enabled) {
  if (enabled) {
    dot.className  = 'dot dot-on';
    statusTx.textContent = 'Connected';
    label.textContent = 'ON';
  } else {
    dot.className  = 'dot dot-off';
    statusTx.textContent = 'Disconnected';
    label.textContent = 'OFF';
  }
  errorMsg.classList.add('hidden');
}

function setBusy(state) {
  busy = state;
  applyBtn.disabled = state;
  toggle.disabled = state;
  hostEl.disabled = state;
  portEl.disabled = state;
  bypassEl.disabled = state;
}

function showError(text) {
  errorMsg.textContent = text;
  errorMsg.classList.remove('hidden');
}

toggle.addEventListener('change', () => {
  if (busy) {
    toggle.checked = !toggle.checked;
    return;
  }

  const on = toggle.checked;
  label.textContent = on ? 'ON' : 'OFF';

  if (!on) {
    setBusy(true);
    chrome.runtime.sendMessage({ action: 'disable' }, (res) => {
      setBusy(false);
      if (chrome.runtime.lastError || !res?.ok) {
        showError(chrome.runtime.lastError?.message || res?.error || 'Failed to disable proxy.');
        toggle.checked = true;
        label.textContent = 'ON';
        return;
      }
      updateUI(false);
    });
  } else {
    const host   = hostEl.value.trim();
    const port   = Number(portEl.value);
    const bypass = bypassEl.value.trim();

    if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
      showError('Set valid Host and Port (1-65535) first.');
      toggle.checked = false;
      label.textContent = 'OFF';
      return;
    }

    setBusy(true);
    chrome.runtime.sendMessage(
      { action: 'enable', host, port, bypassList: bypass },
      (res) => {
        setBusy(false);
        if (chrome.runtime.lastError || !res?.ok) {
          showError(chrome.runtime.lastError?.message || res?.error || 'Failed to enable proxy.');
          toggle.checked = false;
          label.textContent = 'OFF';
          return;
        }
        updateUI(true);
      }
    );
  }
});

applyBtn.addEventListener('click', () => {
  if (busy) return;

  const host   = hostEl.value.trim();
  const port   = Number(portEl.value);
  const bypass = bypassEl.value.trim();

  if (!host) {
    showError('Host is required.');
    return;
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    showError('Port must be 1-65535.');
    return;
  }

  setBusy(true);
  chrome.runtime.sendMessage(
    { action: 'enable', host, port, bypassList: bypass },
    (res) => {
      setBusy(false);
      if (chrome.runtime.lastError || !res?.ok) {
        showError(chrome.runtime.lastError?.message || res?.error || 'Failed to enable proxy.');
        toggle.checked = false;
        label.textContent = 'OFF';
        return;
      }
      toggle.checked = true;
      label.textContent = 'ON';
      updateUI(true);
    }
  );
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'proxyError') {
    dot.className = 'dot dot-error';
    statusTx.textContent = 'Error';
    showError(msg.error);
  }
});

init();
