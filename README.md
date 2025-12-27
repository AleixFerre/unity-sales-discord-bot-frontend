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

This app reads the backend base URL from `src/app/config.json` and sends requests to `${backendUrl}/message`, so any change requires a rebuild.

1. Edit `src/app/config.json`:

```json
{
  "backendUrl": "https://your-backend.example.com"
}
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

This is a static site. Upload the contents of `dist/unity-sales-frontend/` to any static host. Remember to update `src/app/config.json` and rebuild whenever the backend URL changes.

For GitHub Pages (configured in `package.json`):

```bash
npm run deploy
```
Then update `src/app/config.json`, rebuild, and deploy again if the backend URL changes.

## Usage

- Fill in the embed fields.
- Paste the backend `API_TOKEN` in the bearer token field (sent as `Authorization: Bearer <token>`).
- Click “Send embed to backend”.

## Related repos

- https://github.com/AleixFerre/unity-sales-discord-bot
- https://github.com/AleixFerre/unity-sales-discord-bot-frontend
