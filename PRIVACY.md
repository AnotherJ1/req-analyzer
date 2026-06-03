# Privacy Policy — Req Analyzer

_Last updated: 2026-06-03_

Req Analyzer ("the extension") is a developer tool that helps website developers
inspect and debug network traffic on pages they are working on. This policy
explains exactly what data the extension touches and where it goes.

## Summary

- The extension does **not** have its own backend server.
- The extension does **not** collect, transmit, sell, or share your data with the
  developer of this extension or any analytics/advertising service.
- All captured data stays **locally** in your browser by default.
- The extension does **not** provide any AI service. Any AI analysis is performed
  by a **third-party, OpenAI-compatible API endpoint that you configure yourself**.
  Data is sent there **only when you explicitly click "Analyze"**.

## What the extension accesses

To perform its debugging function, the extension can capture, on the tab you are
inspecting:

- Network requests and responses (URL, method, status, headers, bodies).
- JavaScript runtime hooks for `fetch`, `XMLHttpRequest`, `crypto.subtle`, and
  `document.cookie`.
- Storage snapshots: cookies, `localStorage`, and `sessionStorage`.
- Optional Chrome cookies API snapshots (HttpOnly cookie values are masked as
  `[HttpOnly]` and never exposed).

This data is captured only while you have started a capture session, and only for
the tab you are inspecting.

## Where the data is stored

- Captured requests, hooks, and storage snapshots are kept **in memory / local
  browser storage** within the extension UI. They are not uploaded anywhere by
  the extension itself.
- Your settings (AI endpoint base URL, API key, model, language preference) are
  stored using `chrome.storage.local` on your own device.
- You can clear captured data at any time with the "Clear" button, and you fully
  control any exported files (Session JSON, HAR, etc.) that you choose to save.

## Third-party AI endpoint (user-provided)

The extension does **not** include or operate any AI model or AI service.

If you want AI-assisted analysis, you must enter your own credentials for a
legitimate, OpenAI-compatible API endpoint (for example one you are authorized to
use from your AI provider). When — and only when — you click "Analyze" or send a
chat message, the extension sends the relevant captured data (request summaries,
selected bodies, hooks, storage snapshots, and your question) directly from your
browser to **the endpoint you configured**.

That endpoint is operated by a third party of your choosing. Its handling of your
data is governed by **that provider's own privacy policy and terms**, not by this
extension. You are responsible for ensuring you are authorized to send the data to
that endpoint.

## Permissions and why they are needed

- `debugger` / `<all_urls>` host access — required to capture network traffic on
  the site you are debugging.
- `cookies` — required for the optional cookie snapshot feature.
- `storage` — to persist your settings on your device.
- `scripting`, `tabs`, `sidePanel` — to inject the analysis hooks and render the
  side panel / DevTools panel for the inspected tab.

## Data we do NOT do

- We do not run any remote server that receives your captured data.
- We do not collect telemetry, usage analytics, or personal information.
- We do not sell or transfer your data to third parties (the AI endpoint is one
  you choose and control).

## Intended users

Req Analyzer is intended for **web developers** debugging and troubleshooting
their own websites and applications. You should only capture traffic on sites and
in contexts where you are authorized to do so.

## Contact

For questions about this policy, please open an issue on the project repository:
<https://github.com/AnotherJ1/req-analyzer>
