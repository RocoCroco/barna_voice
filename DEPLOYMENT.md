# Deploy Compass with Docker Compose

The three images run the existing Compass MVP on one host:

```text
Browser ── HTTP / HTTPS ── Frontend (Caddy + built React app)
                            ├── /api/*   ── Backend :8000 ── SQLite volume
                            └── /voice/* ── Voice agent :7860 ── SLNG / Nebius
Browser ══ WebRTC audio + data ═══════════════ Voice agent
                  direct UDP or a TURN relay
```

Only Caddy's HTTP/HTTPS ports and the voice agent's UDP media range are published.
Backend and voice HTTP traffic uses Compose service names on the private network.
The frontend uses relative URLs, so changing the deployment domain requires no
frontend rebuild and no production CORS change.

## Start locally

Install Docker Engine with the Docker Compose plugin (or Docker Desktop using
Linux containers). Run these commands from the repository root:

```bash
cp .env.example .env
# Edit .env and fill in SLNG_API_KEY and NEBIUS_API_KEY.
docker compose config --quiet
docker compose build
docker compose up -d --wait --wait-timeout 180
docker compose ps
```

Open [http://localhost:8080](http://localhost:8080). The first build downloads dependencies, trains
sample recommendation models, and compiles the voice agent. Subsequent starts
reuse those artifacts; no compilation, package installation or model training
runs at container startup.

Images can be built without credentials. Starting the complete stack requires
nonempty voice credentials; the agent refuses to start if they are missing.
The frontend waits for healthy backend and voice services. To work on the
frontend/backend alone before configuring voice:

```bash
docker compose up -d --wait backend
docker compose up -d --no-deps frontend
```

Voice requests will fail until the agent is configured and started.

## Configuration

Compose reads the root `.env`, independently of the local development env files
under `frontend/` and `voice-agent/`. Shell environment variables take precedence.

| Variable | Default | Purpose |
| --- | --- | --- |
| `SLNG_API_KEY` | Empty | Speech provider credential, voice container only |
| `NEBIUS_API_KEY` | Empty | LLM credential, voice container only |
| `NEBIUS_BASE_URL` | `https://api.tokenfactory.nebius.com/v1/` | LLM endpoint |
| `SITE_ADDRESS` | `:80` | Local HTTP listener, or public domain for automatic HTTPS |
| `HTTP_PORT` | `8080` | Host HTTP port |
| `HTTPS_PORT` | `8443` | Host HTTPS port; unused in default HTTP mode |
| `IMAGE_TAG` | `local` | Tag for the three locally built images |
| `SEED_DEMO_DATA` | `true` | Initialize demo profiles/history only in an empty database |
| `PIPECAT_ICE_SERVERS` | `stun:stun.l.google.com:19302` | STUN/TURN configuration shared with the WebRTC client |

`BACKEND_URL=http://backend:8000` and `COMPASS_DB_PATH=/data/tv_logs.db` are set
inside Compose. Each service has its own build context and `.dockerignore`:
local credentials, virtual environments, generated builds, databases and model
files are excluded. Provider keys are never build arguments or `VITE_*` values.
Avoid sharing the expanded output of `docker compose config`, which includes
runtime credentials; `--quiet` validates without printing them.

## Public HTTPS deployment

1. Point your domain's DNS records at the Docker host.
2. Set these values in the root `.env`, alongside your provider keys:

   ```dotenv
   SITE_ADDRESS=compass.example.com
   HTTP_PORT=80
   HTTPS_PORT=443
   ```

3. Allow inbound TCP 80 and 443 through the host/cloud firewall. Caddy needs
   outbound access to certificate authorities and working DNS.
4. Configure the media network described below, then run:

   ```bash
   docker compose up -d --build --wait --wait-timeout 180
   ```

Caddy obtains and renews certificates and redirects HTTP to HTTPS. Its certificate
state persists in `caddy-data`. This needs a real reachable domain: publishing
port 443 alone does not enable HTTPS. Browser audio access requires HTTPS, except
on localhost; plain HTTP on a remote IP is insufficient.

If an existing ingress already terminates HTTPS, leave `SITE_ADDRESS=:80` and
forward the complete origin to Caddy's HTTP port, preserving paths and the Host
header. Both `/api/*` and `/voice/*` must reach this same frontend proxy.

## WebRTC media and TURN

HTTPS carries signaling (`/voice/start`, followed by
`/voice/sessions/<id>/api/offer`, including PATCH requests). Audio and structured
recommendation events travel over WebRTC; an HTTP reverse proxy cannot relay
those packets.

On Linux, Compose restricts the voice container's ephemeral ports to
**40000–40100** and publishes that same UDP range. For direct media, allow/forward
UDP 40000–40100 to the host, preserving port numbers, and allow outbound STUN.
The range is shared by media and outbound connections and is intended for this
small single-host deployment; expand both the mapping and sysctl together if
capacity needs increase.

For reliable connections through Docker Desktop, restrictive firewalls or
multiple layers of NAT, configure a reachable TURN service. For example:

```dotenv
PIPECAT_ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com:3478","username":"replace-me","credential":"replace-me"}]'
```

Use your TURN provider's actual URLs and credentials. The relay is external to
this stack; Pipecat passes the configured ICE servers to both peers. TURN access
credentials are intentionally returned to the browser, unlike SLNG/Nebius keys.
The current configuration is static, so rotate TURN credentials or extend session
provisioning for short-lived credentials when needed.

See [Pipecat's ICE configuration](https://docs.pipecat.ai/api-reference/server/services/transport/small-webrtc)
and its [Docker networking example](https://github.com/pipecat-ai/pipecat-examples/tree/main/p2p-webrtc/docker).

## Data, models and restarts

- `backend-data` stores SQLite outside the application image. Containers run as
  UID 10001; existing bind mounts or restored volumes must be writable by that UID.
- The backend image trains its three models from the repository's sample event
  data during the build, using the same locked libraries as runtime. It verifies
  all model bundles load before completing the build.
- Startup creates the schema and optionally imports demo history only if there
  are no events. Existing history is preserved. `SEED_DEMO_DATA=false` starts an
  empty database; profiles appear once activity data is imported.
- These are sample-trained models. They do not retrain automatically when the
  persistent database changes. Updating training data requires rebuilding.
- `caddy-data` and `caddy-config` preserve TLS/configuration state.
- `docker compose down` preserves named volumes. Adding `--volumes` deletes
  database and certificate state.
- Use one backend and one voice replica: SQLite and in-memory voice sessions are
  scoped to this host/process. Restarting the voice container ends active calls;
  plan upgrades between sessions. Compose health checks do not restart an
  unhealthy process automatically; the restart policy handles process exits.

To back up SQLite, stop writes before copying it:

```bash
docker compose stop backend
docker compose cp backend:/data/tv_logs.db ./compass-backup.db
docker compose start backend
```

For a restore, stop the backend, copy the backup to the same container path,
ensure ownership is UID 10001, then restart it. Keep database backups private.

## Checks and operations

```bash
docker compose ps
docker compose logs --tail=100 backend voice-agent frontend
curl --fail http://localhost:8080/api/users
curl --fail http://localhost:8080/voice/status
docker compose exec backend python -c \
  "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/').read().decode())"
```

The backend health check verifies all three models are loaded and the database
can list users. The voice check verifies the HTTP runner advertises WebRTC.
The frontend check verifies Caddy responds on its internal health listener.
These checks do **not** authenticate provider keys or prove end-to-end media.
Validate a real voice conversation from your deployment network with your
SLNG/Nebius configuration before relying on voice availability.

To rebuild after an update:

```bash
docker compose build
docker compose up -d --wait --wait-timeout 180
```

## Dependency updates

Python images install hash-verified `requirements.lock` files. Refresh them
deliberately with uv 0.10.12, then rebuild and test. The exclusion date records
the reviewed dependency cutoff; advance it deliberately when updating.

```bash
uv pip compile backend/requirements.txt --python-version 3.12 \
  --exclude-newer 2026-09-12 --generate-hashes --no-emit-index-url \
  --output-file backend/requirements.lock

# Requires Unmute 0.4.2 on PATH; always compile from authored sources first.
python voice-agent/run.py --compile-only
uv pip compile voice-agent/build/pipecat/pyproject.toml --python-version 3.12 \
  --exclude-newer 2026-09-12 --generate-hashes --no-emit-index-url \
  --output-file voice-agent/requirements.lock
```

The frontend uses its existing frozen pnpm lockfile. The voice image validates,
compiles and patches the authored Unmute definitions during the build, preserving
the SLNG batching adapter and recommendation session integration. Edit the
authored definitions/runtime, never generated `voice-agent/build/` files.
