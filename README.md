# Org Chart

Frontend-only org chart built with React + Vite. Org data lives in a static
JSON file (`public/org.json`) — no backend.

## Requirements

- Node 22+

## Getting started

```
npm install
npm run dev
```

The dev server runs at http://localhost:5173 and opens automatically.

## Editing the data

Edit `public/org.json`. Each node has `id`, `name`, `title`, and a `reports`
array of child nodes.

## Scripts

- `npm run dev` — start the Vite dev server (HMR)
- `npm run build` — build a static bundle into `dist/`
- `npm run preview` — preview the production build locally
