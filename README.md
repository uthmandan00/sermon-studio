# Sermon Studio

A local-first sermon management workspace for pastors and church leaders.

## Run Locally

From this folder:

```powershell
node server.mjs
```

Then open:

```text
http://127.0.0.1:4173/
```

Use the local server URL instead of opening files directly with `file://`. The server gives the app the most reliable behavior for JavaScript modules, routing, and local storage.

## Data Storage

The app stores sermons, series, settings, safety snapshots, and activity in the browser's `localStorage` on your computer. Data stays local unless you export and move a backup file yourself.

## Backups

Use **Settings -> Export Backup** to save a JSON backup.

The app also creates safety snapshots before destructive actions such as deletes, imports, and sample-data resets. You can create or restore snapshots from **Settings -> Safety Backups**.

## Current Features

- Dashboard with next-sermon prep, quick stats, activity, and insights
- Sermon library with search, filters, statuses, duplication, archive, and delete
- Bulk `.docx` Word sermon import from the Sermons page
- Manuscript-first sermon builder with paste import and structured outline sync
- Series planning and week-by-week overview
- Preaching calendar
- Preaching view and print/export tools
- Dark mode
- Local backup, import, reset, and safety snapshots
