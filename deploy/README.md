# Deploy — aurora.artdevelopers.site

Everything needed to put Aurora on a server, in one folder. The application is a
**Node API** (`backend/`), a **static frontend** (`frontend/dist`), and — optionally —
the **Python AI sidecar** (`ai-service/`) when the box has a GPU.

The host used in these examples is `169.58.119.44`, serving `aurora.artdevelopers.site`.

## What each file is

| File | Purpose |
| --- | --- |
| `nginx/aurora.conf` | Reverse proxy: serves the built frontend, proxies `/api` to the API on :3000 |
| `systemd/aurora-api.service` | Keeps the Node API running, restarts on failure |
| `systemd/aurora-ai.service` | Optional: the FastAPI sidecar (needs a GPU for the vision model) |
| `systemd/aurora-whatsapp.service` | Optional: the WhatsApp bridge (needs a linked session) |
| `aurora.env.example` | The environment keys to fill in on the server — **never commit the real one** |
| `deploy.sh` | Builds the frontend locally, ships code, restarts services |

## First deploy, from scratch

```bash
# on the server
sudo apt update && sudo apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt install -y nodejs
sudo adduser --system --group aurora
sudo mkdir -p /opt/aurora /var/www/aurora /etc/aurora
sudo chown -R aurora:aurora /opt/aurora /var/www/aurora

# secrets live outside the repo
sudo cp deploy/aurora.env.example /etc/aurora/aurora.env
sudo nano /etc/aurora/aurora.env            # fill in, then:
sudo chmod 600 /etc/aurora/aurora.env && sudo chown aurora:aurora /etc/aurora/aurora.env
```

Then, from your machine:

```bash
HOST=169.58.119.44 SSH_USER=root bash deploy/deploy.sh
```

## What the first run still needs by hand

1. **DNS** — an `A` record for `aurora.artdevelopers.site` pointing at the host.
2. **TLS** — `sudo certbot --nginx -d aurora.artdevelopers.site` (the config leaves room for it;
   until then the site answers on http).
3. **MongoDB** — the production database URI, in `/etc/aurora/aurora.env`.
4. **The admin account** — `MAIN_ADMIN_EMAIL` / `MAIN_ADMIN_PASSWORD` in the same file; the API
   bootstraps it on every start.
5. **Seed data** (only for a demo instance): `sudo -u aurora npm --prefix /opt/aurora/backend run seed`.

## Notes and caveats

- **Never commit** `deploy/.env`, `deploy/secrets/`, keys or certificates — `.gitignore` covers them.
- The AI sidecar is **optional**. Without it the app runs fully; the doctor's X-ray assistant and
  RAG answers degrade (they report unavailability rather than failing silently).
- The WhatsApp bridge needs a **QR scan** on first run on the server and an interactive session —
  it will not start unattended until that is done once.
- If the box has no GPU, the sidecar falls back to CPU: correct answers, slow X-rays.
