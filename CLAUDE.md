# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Cadence — a Japanese-language calendar & task management web app ("予定表 & タスク管理アプリ"). It has no backend database and no build step: Express only serves static files, and all application state (events, tasks, timetable, memos, theme) lives in the browser's `localStorage`. The app is designed to also run as a static site with zero server (see Deployment below).

## Commands

```bash
npm install   # install dependencies (Express only)
npm start     # runs `node server.js`, serves the app at http://localhost:3000
```

There is no build step, bundler, linter, or test suite configured in this repo — `docs/` is served as-is. When making changes, verify manually in a browser rather than looking for a test command.

## Architecture

The entire app is three static files served from `docs/`, plus a one-file Express server:

- **`server.js`** — Express app that does nothing but `express.static('docs')` on `PORT` (default 3000). No API routes, no server-side logic.
- **`docs/index.html`** — All DOM structure: header, stats row, calendar panel, and a side stack of panels (day detail / timetable / memo / tasks), plus the shared add/edit-event modal. Elements are wired up by `id` from `app.js` — there is no templating.
- **`docs/app.js`** — A single IIFE containing all client logic (no modules/framework). Organized into clearly commented sections (search for `// ---------- <Section> ----------`): Storage, Date helpers, Theme, Calendar rendering, Day panel, Timetable, Memo, Event modal, Tasks, Stats, and a top-level `renderAll()`.
- **`docs/style.css`** — All styling, theme via CSS custom properties on `:root` / `:root[data-theme="dark"]`.

### State model

Everything lives in one in-memory `store` object, loaded from and saved to `localStorage` under the key `calendarTaskApp.v1`:

```js
{ events: [], tasks: [], timetable: {}, memos: {} }
```

- `events`: `{ id, title, date, time, note, color }` — calendar entries, edited via the modal.
- `tasks`: `{ id, title, due, priority, done }` — todo items, filterable (all/active/done).
- `timetable`: keyed by `YYYY-MM-DD`, each value is a 6-element array (period 1–6). If a date has no explicit entry, it falls back to `TIMETABLE_WEEKLY_TEMPLATE[dayOfWeek]` (see `getWeeklyTemplate`/`getTimetableEntries` in `app.js`). An entry is deleted entirely once all 6 periods are cleared.
- `memos`: keyed by `YYYY-MM-DD`, free-text note per day. Auto-reflected into the day panel's event list and calendar mini-preview.

`saveStore()` writes the whole object back to `localStorage` after every mutation; there is no debouncing or diffing. Theme preference is stored separately under `calendarTaskApp.theme`.

Every user action follows the same pattern: mutate `store` → `saveStore()` → re-render the affected view(s) (often via the top-level `renderAll()`, which re-renders calendar, day panel, timetable, memo, and tasks together).

### Calendar is Mon–Fri only

The month grid intentionally excludes weekends (`isWeekend` filters out Sat/Sun) and lays out cells in a 5-column grid, padding with adjacent-month weekdays so the grid length is a multiple of 5. Keep this in mind before assuming a standard 7-column calendar.

### Timetable domain rules

Fixed at 6 periods/day (`TIMETABLE_PERIOD_COUNT`). A lunch break is inserted for display purposes only after period `TIMETABLE_LUNCH_AFTER` (4) — it is not stored as data and doesn't count toward the 6 periods. `TIMETABLE_PRESETS` provides a dropdown of common period labels plus free-text input (`__custom`). `TIMETABLE_WEEKLY_TEMPLATE` defines the default per-weekday pattern used when a specific date hasn't been edited.

### Cache busting

`index.html` references `style.css?v=8` and `app.js?v=8`. Bump these query-string versions when shipping changes to either file, since GitHub Pages / static hosting has no other cache-invalidation mechanism.

## Deployment

No server-side API or database — `docs/` is fully self-contained and safe to publish as-is via GitHub Pages (repo Settings → Pages → source: `main` branch, `/docs` folder). `docs/index.html` also works opened directly from the filesystem (`file://`), though some browsers restrict local-file `localStorage`/script behavior.
