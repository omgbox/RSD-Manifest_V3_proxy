# RSD SOCKS5 Proxy Switcher

A Chrome extension (Manifest V3) to toggle a remote SOCKS5 proxy on/off with a single click.

## What It Does

Routes all Chrome traffic through a SOCKS5 proxy server you control. Toggle it on/off from the toolbar popup, configure IP and port, and the setting persists across browser restarts.

## Install

1. Download or clone this repo
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `RSD-Manifest_V3_proxy` folder

## Usage

1. Click the extension icon in the toolbar
2. Enter your SOCKS5 server **Host** (IP or hostname)
3. Enter the **Port** (default 1080)
4. Click **Apply & Connect**

The status dot turns green when connected. Use the toggle switch or the Apply button to connect/disconnect.

### Fields

| Field | Description |
|---|---|
| **Host** | IP address or hostname of your SOCKS5 server |
| **Port** | Port number (1-65535, default 1080) |
| **Bypass List** | Comma-separated domains to skip the proxy. Default `<local>` bypasses simple hostnames like `localhost` |

### Status Indicators

| Dot | Meaning |
|---|---|
| Green | Proxy active |
| Red | Proxy off |
| Orange | Proxy error (check host/port) |

## How It Works

Uses the `chrome.proxy` API to set Chrome's proxy to `socks5://host:port`. The setting applies to all traffic in regular windows. State is saved in `chrome.storage.local` and re-applied on browser startup.

## Permissions

- `proxy` — to set Chrome's proxy settings
- `storage` — to remember your config across sessions

No data is collected, no external requests are made.

## Files

```
manifest.json    Extension manifest (MV3)
background.js    Service worker — applies proxy config
popup.html/js/css  Toolbar popup UI
icons/           Extension icons
SPEC.md          Full technical specification
```

## License

MIT
