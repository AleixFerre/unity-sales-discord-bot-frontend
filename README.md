# Unity Sales Embed Builder (Frontend)
_Important: this UI requires the backend repo to send embeds. Grab both repos._
_Backend repo: https://github.com/AleixFerre/unity-sales-discord-bot_

Dark-themed Angular UI for composing Discord embeds and sending them to the backend API.

## Requirements

- Node.js 18+
- npm or Bun

## Install

```bash
cd unity-sales-frontend
npm install
```

## Configure the backend URL

This app reads the backend endpoint from a runtime `env.js` file so deployments can change it without rebuilding.

1. Edit `public/env.js` and set:

```js
window.__ENV = window.__ENV || {};
window.__ENV.BACKEND_URL = "https://your-backend.example.com/message";
```

2. Optional build-time fallback:

```bash
export NG_APP_BACKEND_URL="https://your-backend.example.com/message"
```

## Run locally

```bash
npm start
```

Open `http://localhost:4200`.

## Build

```bash
npm run build
```

The output is in `dist/unity-sales-frontend/`.

## Deploy

This is a static site. Upload the contents of `dist/unity-sales-frontend/` to any static host and make sure `env.js` is alongside `index.html`.

For GitHub Pages (configured in `package.json`):

```bash
npm run deploy
```

Then update `env.js` in your published site to point at your backend.

## Usage

- Fill in the embed fields.
- Paste the backend `API_TOKEN` in the bearer token field (sent as `Authorization: Bearer <token>`).
- Click “Send embed to backend”.

## Related repos

- https://github.com/AleixFerre/unity-sales-discord-bot
- https://github.com/AleixFerre/unity-sales-discord-bot-frontend
