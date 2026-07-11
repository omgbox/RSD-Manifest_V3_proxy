const DEFAULTS = {
  proxyEnabled: false,
  proxyHost: '',
  proxyPort: 1080,
  bypassList: '<local>',
};

const MAX_HOST_LEN = 253;
const MAX_BYPASS_LEN = 4096;

// Re-apply proxy on every service worker startup (idle wake, update, re-enable).
// chrome.proxy.settings persists in the browser, but Chrome may reset it on
// disable/re-enable. This is idempotent and cheap.
(async () => {
  try {
    const stored = await chrome.storage.local.get(DEFAULTS);
    if (isValidStoredConfig(stored)) {
      await enableProxy(stored.proxyHost, stored.proxyPort, stored.bypassList);
    }
  } catch (err) {
    console.error('[RSD Proxy] startup re-apply error:', err);
  }
})();

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const stored = await chrome.storage.local.get(DEFAULTS);
    await chrome.storage.local.set({ ...DEFAULTS, ...stored });
  } catch (err) {
    console.error('[RSD Proxy] onInstalled error:', err);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  try {
    const stored = await chrome.storage.local.get(DEFAULTS);
    if (isValidStoredConfig(stored)) {
      await enableProxy(stored.proxyHost, stored.proxyPort, stored.bypassList);
    }
  } catch (err) {
    console.error('[RSD Proxy] onStartup error:', err);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'enable') {
    const err = validateEnablePayload(msg);
    if (err) {
      sendResponse({ ok: false, error: err });
      return false;
    }

    const host = msg.host.trim();
    const port = Number(msg.port);
    const bypassList = typeof msg.bypassList === 'string' ? msg.bypassList : '';

    enableProxy(host, port, bypassList)
      .then(() => {
        return chrome.storage.local.set({
          proxyEnabled: true,
          proxyHost: host,
          proxyPort: port,
          bypassList: bypassList,
        });
      })
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error('[RSD Proxy] enable error:', err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }

  if (msg.action === 'disable') {
    disableProxy()
      .then(() => chrome.storage.local.set({ proxyEnabled: false }))
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error('[RSD Proxy] disable error:', err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }

  if (msg.action === 'getStatus') {
    chrome.storage.local
      .get(DEFAULTS)
      .then((data) => {
        sendResponse({
          proxyEnabled: !!data.proxyEnabled,
          proxyHost: String(data.proxyHost || ''),
          proxyPort: Number(data.proxyPort) || 1080,
          bypassList: String(data.bypassList || '<local>'),
        });
      })
      .catch((err) => {
        console.error('[RSD Proxy] getStatus error:', err);
        sendResponse(null);
      });
    return true;
  }

  return false;
});

chrome.proxy.onProxyError.addListener((details) => {
  console.error('[RSD Proxy] onProxyError:', details.error, details.details);
  chrome.runtime
    .sendMessage({ type: 'proxyError', error: details.error })
    .catch(() => {});
});

function validateEnablePayload(msg) {
  if (typeof msg.host !== 'string' || !msg.host.trim()) {
    return 'Host is required.';
  }
  if (msg.host.length > MAX_HOST_LEN) {
    return 'Host is too long (max 253 characters).';
  }
  if (!/^[a-zA-Z0-9.:\-\[\]]+$/.test(msg.host)) {
    return 'Host contains invalid characters.';
  }
  const port = Number(msg.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return 'Port must be an integer between 1 and 65535.';
  }
  if (typeof msg.bypassList === 'string' && msg.bypassList.length > MAX_BYPASS_LEN) {
    return 'Bypass list is too long (max 4096 characters).';
  }
  return null;
}

function isValidStoredConfig(stored) {
  const host = String(stored.proxyHost || '');
  const port = Number(stored.proxyPort);
  return (
    !!stored.proxyEnabled &&
    typeof host === 'string' &&
    host.length > 0 &&
    host.length <= MAX_HOST_LEN &&
    Number.isInteger(port) &&
    port >= 1 &&
    port <= 65535
  );
}

async function enableProxy(host, port, bypassList) {
  const raw = typeof bypassList === 'string' ? bypassList.trim() : '';
  const bypassArray = raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const config = {
    mode: 'fixed_servers',
    rules: {
      singleProxy: {
        scheme: 'socks5',
        host: String(host),
        port: Number(port),
      },
      bypassList: bypassArray,
    },
  };
  await chrome.proxy.settings.set({ value: config, scope: 'regular' });
  console.log(`[RSD Proxy] Enabled -> socks5://${host}:${port}`);
}

async function disableProxy() {
  await chrome.proxy.settings.set({
    value: { mode: 'direct' },
    scope: 'regular',
  });
  console.log('[RSD Proxy] Disabled');
}
