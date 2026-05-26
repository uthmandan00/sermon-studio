# Sermon Studio

A local-first sermon management workspace for pastors and church leaders.

## Run Locally

From this folder:

```powershell
npm start
```

Then open:

```text
http://127.0.0.1:4173/
```

Use the local server URL instead of opening files directly with `file://`. The server gives the app the most reliable behavior for JavaScript modules, routing, and local storage.

## Launch Readiness

Run this before deploying or handing the app to another user:

```powershell
npm run check
```

The check verifies required launch files, JavaScript syntax, and local HTML asset links.

## Deploying Live

This app is local-first: sermon data is stored in each browser's `localStorage`, not in a shared cloud database. That is good for privacy and simple personal use, but it means every pastor/device has its own workspace unless backups are exported and imported.

For a live hosted version, deploy it as a small Node app so Word `.docx` import keeps working:

```powershell
npm start
```

Production hosts should set:

```text
PORT=<the platform port>
HOST=0.0.0.0
```

Health check endpoint:

```text
/health
```

If you deploy this as static files only, the app will still open, but Word document import will not work because `/api/import-docx` requires `server.mjs`.

### Option 1: Render

This repo includes `render.yaml`. Create a new Render Blueprint from the repo, then Render will use:

```text
startCommand: npm start
healthCheckPath: /health
HOST=0.0.0.0
```

### Option 2: Docker

Build and run the container:

```powershell
docker build -t sermon-studio .
docker run --rm -p 4173:4173 sermon-studio
```

Then open:

```text
http://127.0.0.1:4173/
```

### Environment Variables

See `.env.example` for local defaults.

- `HOST`: use `127.0.0.1` locally and `0.0.0.0` on a host.
- `PORT`: defaults to `4173`.
- `MAX_UPLOAD_BYTES`: defaults to 25 MB for Word document imports.

## Current Go-Live Caveats

- There is no user login yet.
- Data does not sync across devices yet.
- Backups are user-managed JSON exports.
- Do not treat the hosted app as a multi-user church database until authentication and cloud storage are added.

## Data Storage

The app stores sermons, series, settings, safety snapshots, and activity in the browser's `localStorage` on your computer. Data stays local unless you export and move a backup file yourself.

## Backups

Use **Settings -> Export Backup** to save a JSON backup.

The app also creates safety snapshots before destructive actions such as deletes, imports, and sample-data resets. You can create or restore snapshots from **Settings -> Safety Backups**.

## Current Features

- Dashboard with next-sermon prep, quick stats, activity, and insights
- Sermon library with search, filters, statuses, duplication, archive, and delete
- Drag-and-drop sermon preparation board
- Bulk `.docx` Word sermon import from the Sermons page
- Manuscript-first sermon builder with paste import and structured outline sync
- Series planning and week-by-week overview
- Preaching calendar
- Preaching view and print/export tools
- Dark mode
- Local backup, import, reset, and safety snapshots
