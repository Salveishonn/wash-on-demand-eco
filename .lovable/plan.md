# Fix: Botmaker Webchat not visible on Washero

## Root cause

The Botmaker init script at `https://go.botmaker.com/rest/webchat/p/O0FW1NYUKE/init.js` is just a redirect (HTTP 302). It points to the real widget code hosted on Google Cloud Storage:

```
https://storage.googleapis.com/botmaker/webchat2/99963/O0FW1NYUKE/index.756YD.js
```

Our current Content-Security-Policy in `index.html` allows `https://go.botmaker.com` but **not** `https://storage.googleapis.com`. The browser silently blocks the redirected script, so no widget ever renders. The init request succeeds, which is why earlier checks looked fine — but the actual chat code never executes.

Botmaker's webchat also typically loads styles, fonts, images, and opens a websocket connection back to its API, so a few more origins need to be allowed.

## Change

Single file: `index.html` — update the CSP `<meta>` tag to add Botmaker's runtime origins.

Add to:
- `script-src` → `https://storage.googleapis.com`
- `style-src` → `https://storage.googleapis.com`
- `img-src` → already permissive (`https:`), no change needed
- `font-src` → `https://storage.googleapis.com`
- `connect-src` → `https://storage.googleapis.com` `https://*.botmaker.com` `wss://*.botmaker.com`
- `frame-src` → keep `https://go.botmaker.com` (already there)

No code changes to `BotmakerWebchat.tsx` — the component and ID are already correct.

## Verification steps after implementation

1. Hard reload `/` in the preview (CSP meta is cached aggressively).
2. Confirm in DevTools Network: `index.756YD.js` from `storage.googleapis.com` returns 200 (not blocked).
3. Confirm no `Refused to load the script` / `Refused to connect` CSP violations in the console.
4. Confirm the Botmaker bubble appears bottom-right on `/`, `/servicios`, `/reservar`, etc.
5. Confirm it does **not** appear on `/admin/*` or `/ops/*`.

## Note on the screenshot

The WhatsApp panel you shared (WABA `4351528555162209`, phone id `1034528373087220`) is the Botmaker → WhatsApp Cloud API channel, which is separate from the webchat widget. The webchat is a different channel inside the same Botmaker workspace, identified by `O0FW1NYUKE`. Once the CSP is fixed, the on-site bubble will load — independent of the WhatsApp line.
