# Federation Architecture

## Status

Federation is **dormant** (federation_peers = 0, federated_resources = 0, federation_sync_log entries = 0).
The infrastructure is wired and ready; no real peer has onboarded.

---

## Wave history

| Wave | Work | Commit |
|------|------|--------|
| 1 | Smoke tests, eslint guard, observability catalog, proxy logging | `1c2fbb2` |
| 2 | Align edge signer to cavage Signature scheme; single-resource route | `ba5496a` |
| 3 | Inbound edge fns (federation-resources, federation-inbox); thin Next proxies; service_role off Next runtime | HEAD |

---

## Architecture

### Outbound (local → remote peers)

`federation-sync` edge function (cron/manual trigger):
- Signs outbound GET requests with draft-cavage Signature using `FEDERATION_PRIVATE_KEY`
- Fetches resource collections from remote `/api/federation/resources`
- Upserts into `federated_resources`, writes `federation_sync_log`

`federation-webhook` edge function (outbound):
- POSTs HMAC-signed change notifications to registered peers
- Secret = `FEDERATION_PRIVATE_KEY[:64]`

### Inbound (remote peers → local)

**Path:** remote peer → Next.js thin proxy → Supabase edge function

```
GET /api/federation/resources[/id]
  → apps/web/src/app/api/federation/resources/route.ts  (thin proxy)
  → supabase/functions/federation-resources/index.ts     (cavage verify + DB)

POST /api/federation/webhook
  → apps/web/src/app/api/federation/webhook/route.ts    (thin proxy)
  → supabase/functions/federation-inbox/index.ts         (HMAC verify + DB)

GET /api/federation/instance
  → apps/web/src/app/api/federation/instance/route.ts   (anon, unchanged)
```

The Next.js proxy routes hold **no** `SUPABASE_SERVICE_ROLE_KEY`. All privileged
DB operations run inside the edge function under the auto-injected service_role.

### Signature passthrough

The cavage signing string is computed over `(request-target)`, `host`, `date`,
`(created)`, `(expires)`, and optionally `digest`. The signer uses the **Next.js
host** (`x-original-host`) and the **original path+query** (`x-original-target`),
not the edge function URL. The thin proxy sets both headers so the edge function
reconstructs the exact signing string the remote peer used.

---

## Auth schemes

| Endpoint | Scheme | Secret |
|----------|--------|--------|
| `/api/federation/resources[/id]` | draft-cavage Signature (RSA-SHA256) | peer's public key in `federated_instances` |
| `/api/federation/webhook` | HMAC-SHA256 over raw body | `FEDERATION_PRIVATE_KEY[:64]` |

---

## Rate limiting

**Tier 0 (current):** The signature/HMAC gate rejects all unsigned or unknown
callers before any DB read or write occurs. This provides adequate protection
at federation_peers = 0.

**First-peer upgrade path:** add Upstash Redis keyed by verified `instance.id`
once `federation_peers > 0`. The edge functions are the correct insertion point
(not the Next.js proxy).

---

## Edge function config

`supabase/config.toml` sets `verify_jwt = false` for all five federation functions:

- `federation-resources` — public, cavage-gated
- `federation-inbox` — public, HMAC-gated
- `federation-sync` — cron/service-triggered
- `federation-webhook` — service-triggered
- `federation-health-check` — public discovery

---

## Onboarding a real peer (trigger)

When `federation_peers > 0`:
1. Ensure `FEDERATION_PRIVATE_KEY` and `FEDERATION_INSTANCE_URL` are set as
   Supabase edge function secrets.
2. Deploy the five federation edge functions:
   ```
   npx supabase functions deploy federation-resources --project-ref ndtpovonpadugthmcntl
   npx supabase functions deploy federation-inbox --project-ref ndtpovonpadugthmcntl
   npx supabase functions deploy federation-sync --project-ref ndtpovonpadugthmcntl
   npx supabase functions deploy federation-webhook --project-ref ndtpovonpadugthmcntl
   npx supabase functions deploy federation-health-check --project-ref ndtpovonpadugthmcntl
   ```
3. Insert the peer into `federated_instances` and `federation_peers`.
4. Run a manual `federation-sync` invocation and confirm `federation_sync_log` entries appear.
5. Upgrade rate-limiting to Upstash Redis keyed by `instance.id`.
