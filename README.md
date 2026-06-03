# Anything Analyzer Browser

[简体中文](README.zh-CN.md)

Anything Analyzer Browser is a Chrome/Edge DevTools extension inspired by
[Mouseww/anything-analyzer](https://github.com/Mouseww/anything-analyzer). It focuses on the part that works best inside a browser extension: analyzing the currently inspected tab.

## Features

- DevTools panel named `Analyzer`
- Browser side panel workspace opened from the extension action
- Chinese by default, with Chinese/English switching
- Start, pause, and stop capture controls
- Network capture through `chrome.devtools.network`
- Side panel network capture through `chrome.debugger`
- Response body collection with `request.getContent()`
- Page-level hooks for `fetch`, `XMLHttpRequest`, `crypto.subtle`, and `document.cookie`
- Storage snapshots for cookies, `localStorage`, and `sessionStorage`
- Optional Chrome cookies API snapshot, including HttpOnly cookie names and metadata
- Domain/search filtering
- Request detail viewer
- UI switches for Network, JS hooks, storage snapshots, and cookie API snapshots
- Session JSON, HAR, requests, hooks, storage, and analysis export
- One-click `fetch` and `cURL` reproduction snippets from the request detail view
- OpenAI-compatible AI analysis with configurable base URL, API key, model, and body limit
- Model input supports both typing and selecting fetched models
- Test the configured model with a minimal request
- Conversational AI analysis with preset prompts and custom follow-up questions
- Browser action opens the side panel

## Install Locally

1. Open Chrome or Edge.
2. Go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select this folder: `D:\work\cc\google-plagin`.
6. Open any page, then open DevTools.
7. Select the `Analyzer` panel.
8. Click `Start`, reload the page, and interact with the site.

## AI Setup

Open `Settings` in the Analyzer panel and set:

- `Base URL`: an OpenAI-compatible API base URL, for example `https://api.openai.com/v1`
- `API key`: your provider key
- `Model`: for example `gpt-4.1-mini`, or any model supported by your endpoint

The extension sends captured request summaries, selected bodies, hooks, and storage snapshots to the configured endpoint only when you click `Analyze`.

## Current Scope

This is the recommended MVP plugin version. It intentionally does not include the desktop-only parts of Anything Analyzer:

- MITM HTTPS proxy
- CA certificate installation
- System proxy switching
- Non-browser app capture
- Native MCP stdio server

Those should be added later through a Native Messaging companion app if needed.

## Files

```text
manifest.json
src/
  background.js   # service worker and panel/content message bridge
  content.js      # isolated-world bridge and storage snapshots
  injected.js     # main-world fetch/XHR/crypto/cookie hooks
  devtools.html   # DevTools extension entry
  devtools.js     # creates the Analyzer panel
  panel.html      # capture and analysis UI
  panel.css
  panel.js
```

## Notes

- DevTools network capture only sees requests available to DevTools. If DevTools is opened after the page loaded, reload the inspected page.
- `chrome.devtools.network` can retrieve response content, but very large or binary responses may be missing or truncated by Chrome.
- `document.cookie` cannot expose HttpOnly cookie values. The optional cookies API snapshot masks HttpOnly values as `[HttpOnly]`.
- The extension uses broad host permissions because traffic analysis needs access to arbitrary inspected sites. For production distribution, consider an allowlist or optional host permissions flow.
