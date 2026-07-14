# WorkBuddy Update Server

This service exposes a read-only update manifest for the WorkBuddy desktop app.

Public endpoint:

```text
https://www.hillmanpick.xin/workbuddy/api/v1/update/windows
```

Deployment directory:

```text
/root/workbuddy-update-server
```

The installer is served by the existing Nginx `/download/` location. To publish a release:

1. Copy the installer to `/root/openclaw-stack/downloads/workbuddy/`.
2. Update `data/latest.json` with the version, URL, SHA-256, size, date, and notes.
3. Validate the endpoint and installer checksum.

Run or rebuild the API:

```sh
docker compose up -d --build
docker compose logs --tail=100 update-api
```
