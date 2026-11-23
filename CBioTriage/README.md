# CMUbiotrage (XAMPP / PHP version, no Netlify needed)

## Run on your PC (XAMPP)
1. Copy this folder into `C:\xampp\htdocs\` (any folder name works).
2. XAMPP Control Panel → start **Apache** only (no MySQL needed).
3. Open `http://localhost/CMUBioTriage/`.
4. Staff login PIN is `1234` (change it in `api/config.php`).

Reports are saved in `api/_data/reports.json`. The folder must be writable (it is by default on XAMPP/Windows).

## Open it on a phone
- **Same Wi-Fi:** run `ipconfig`, then open `http://YOUR-PC-IP/CMUBioTriage/` on the phone. Allow Apache in Windows Firewall. Reports and staff login work. Over plain http the phone browser blocks GPS, offline install and the service worker.
- **Full features (https):** keep XAMPP running and start a tunnel, e.g. `ngrok http 80` or Cloudflare Tunnel, then open `https://<tunnel-address>/CMUBioTriage/` on the phone. GPS, install and offline then work, and the phone still talks to your PC's PHP backend.

## Files
- `api/reports.php` – users POST reports; staff GET them (needs login)
- `api/report.php` – staff: mark handled / reopen / delete a report (deletions are logged by ID and time only in `api/_data/audit.json`)
- `api/session.php` – staff PIN login / logout / check
- `api/config.php` – PIN and settings (blocked from web access by `.htaccess`)
- `api/_data/` – stored reports (blocked from web access)

## Notes
- Netlify and other static hosts cannot run PHP. `netlify.toml` blocks `/api/*` there so PHP source is never exposed; public screens still work but report submission and staff login will say the service is unavailable.
- Change `STAFF_PIN` and `SITE_SALT` in `api/config.php` before real use.
- If you change files, bump the cache name in `sw.js` and `app.js` (now `cmubiotrage-v7`), then hard-refresh (Ctrl+Shift+R).
- Reports are plain JSON on disk: fine for a class demo, not for real patient data.
