# RSD SOCKS5 Proxy Switcher — Specification

## Overview

A Chrome Extension (Manifest V3) that allows users to toggle a remote SOCKS5 proxy on/off and configure the server IP and port from a popup UI.

## Architecture

```
RSD-Manifest_V3_proxy/
├── manifest.json          # MV3 manifest
├── background.js          # Service worker — applies proxy config
├── popup.html             # Popup UI markup
├── popup.js               # Popup logic
├── popup.css              # Popup styles
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── SPEC.md                # This file
```

## Manifest V3 Requirements

| Field | Value |
|---|---|
| manifest_version | 3 |
| minimum_chrome_version | 100 |
| permissions | `proxy`, `storage` |
| background | service_worker → `background.js` |
| action | default_popup → `popup.html` |

## Features

### 1. Proxy Toggle (On/Off)
- Single toggle switch in popup.
- When **ON**: Chrome routes traffic through the configured SOCKS5 server.
- When **OFF**: Chrome uses `direct` mode (no proxy).
- State persisted in `chrome.storage.local` and survives browser restart.
- Toggling ON re-applies the stored host/port/bypass config (no need to click Apply again).

### 2. Server Configuration
- **Host** input: IP address or hostname of the SOCKS5 server.
- **Port** input: port number (default 1080).
- Values persisted in `chrome.storage.local`.

### 3. Connection Status Indicator
- Green dot + "Connected" when proxy is active.
- Red dot + "Disconnected" when proxy is off.
- Orange dot + "Error" if `chrome.proxy.onProxyError` fires.

### 4. Bypass List (optional, configurable)
- Text input where users can enter comma-separated domains to bypass the proxy.
- Default: `<local>` (bypasses simple hostnames).

## Proxy Configuration (chrome.proxy API)

### Enable Proxy
```json
{
  "mode": "fixed_servers",
  "rules": {
    "singleProxy": {
      "scheme": "socks5",
      "host": "<user-host>",
      "port": <user-port>
    },
    "bypassList": ["<local>"]
  }
}
```
Applied via:
```js
await chrome.proxy.settings.set({ value: config, scope: 'regular' });
```

### Disable Proxy
```json
{ "mode": "direct" }
```

## Storage Schema (`chrome.storage.local`)

```json
{
  "proxyEnabled": false,
  "proxyHost": "",
  "proxyPort": 1080,
  "bypassList": "<local>"
}
```

## UI Design

```
┌─────────────────────────────┐
│  RSD Proxy Switcher         │
├─────────────────────────────┤
│  ● Disconnected             │
│                             │
│  [====●============]  OFF   │
│                             │
│  Host: [________________]   │
│  Port: [________________]   │
│                             │
│  Bypass: [______________]   │
│                             │
│  [   Apply & Connect   ]    │
│                             │
│  (error messages appear     │
│   below the button)         │
└─────────────────────────────┘
```

## Service Worker Lifecycle (`background.js`)

1. **Top-level IIFE**: On every service worker startup (idle wake, update, re-enable), read storage and re-apply proxy if `proxyEnabled` is true. This is idempotent and handles Chrome resetting proxy on disable/re-enable.
2. **onInstalled**: Merge storage defaults with any existing values (non-destructive).
3. **onStartup**: Read stored state; if `proxyEnabled === true` and host is valid, re-apply proxy config.
4. **onMessage** (from popup):
   - `{ action: 'enable', host, port, bypassList }` — apply SOCKS5 proxy and persist.
   - `{ action: 'disable' }` — set `direct` mode and persist.
   - `{ action: 'getStatus' }` — return current stored state.
5. **onProxyError**: Log errors and send `{ type: 'proxyError', error }` message to popup.

## Storage Validation (`isValidStoredConfig`)

Before applying proxy from stored values, the service worker validates:
- `proxyEnabled` is truthy
- `proxyHost` is a non-empty string within max length
- `proxyPort` is an integer in 1–65535

Corrupted storage values are silently skipped (proxy not applied).

## Message Protocol (popup → background)

| Action | Payload | Response |
|---|---|---|
| `enable` | `{ host: string, port: number, bypassList: string }` | `{ ok: true }` or `{ ok: false, error: string }` |
| `disable` | *(none)* | `{ ok: true }` or `{ ok: false, error: string }` |
| `getStatus` | *(none)* | `{ proxyEnabled, proxyHost, proxyPort, bypassList }` |

## Input Validation (background.js)

All `enable` payloads are validated before applying:

| Field | Rule |
|---|---|
| `host` | Required, string, max 253 chars, regex `^[a-zA-Z0-9.:\-\[\]]+$` |
| `port` | Integer, 1–65535 |
| `bypassList` | String, max 4096 chars (optional) |

Invalid payloads return `{ ok: false, error: "<reason>" }` without touching proxy settings.

## Error Handling

- `chrome.proxy.settings.set` failures are caught and returned as `{ ok: false, error }`.
- All `onInstalled` / `onStartup` logic is wrapped in try/catch to prevent service worker crashes.
- Popup displays error messages in a red `#error-msg` element.
- `chrome.proxy.onProxyError` events are forwarded to the popup via `runtime.sendMessage` with type `proxyError`.
- If the popup is closed, the forwarded message is silently caught (`.catch(() => {})`).

## Race Condition Prevention (popup.js)

A `busy` flag prevents overlapping operations:

- While a message is in-flight (enable/disable), all inputs and the toggle are disabled.
- The flag is cleared when the response arrives.
- Rapid toggling or double-clicking Apply is safely no-ops.

## Security Notes

- No credentials are stored in this extension (SOCKS5 auth is not supported by `chrome.proxy`).
- Proxy config applies to all traffic in the `regular` scope.
- The extension does not inject content scripts or access page data.
- Host input is validated against a strict regex to prevent injection into proxy config.
- Bypass list entries are trimmed and filtered for empty strings before being applied.
