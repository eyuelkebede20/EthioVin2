# EthioVin API Reference — v1

Decode any VIN imported to Ethiopia — make, model, year, and verified hardware specs — with a
single API call. Coverage is built for the actual Ethiopian car park: ASEAN-market VINs
(including characters `I`, `O`, `Q` that many global decoders reject), correct model-year
decoding for the pre-2010 import fleet, and human-verified spec data that improves as the
network records more vehicles.

> This document is the authoritative `/v1` contract. Changes within v1 are strictly additive
> (new optional fields may appear); breaking changes ship as `/v2`.

## Base URL

```
https://api.ethiovin.com/v1
```

All endpoints accept and return JSON (`Content-Type: application/json`).

## Authentication

Every request (except `/health`) requires an API key, created in your
[developer dashboard](/dashboard/api). Send it either way:

```
Authorization: Bearer evn_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

or

```
X-API-Key: evn_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Your key is shown **once** at creation — store it in a secret manager. Keys are hashed on our
side and cannot be recovered; if you lose one, revoke it and create a new one.

⚠️ **Server-side use only.** Never embed a key in a browser, mobile app, or public repository.
Anyone holding the key can spend your credits. Cross-origin browser requests are not supported
by design.

## Credits

Usage is prepaid in **credits**:

- A decode that returns vehicle data (`match: "exact"` or `"model"`) costs **1 credit**.
- A parse-only result (`match: "none"` — valid VIN, model not yet in our records) is **free**.
- An invalid VIN (`422`) is **free**.

New accounts receive a free evaluation grant when they create their first API key. Buy more
credits or redeem promo codes in the dashboard (payments in ETB via Chapa — telebirr, CBE
Birr, cards). Every successful response includes your remaining balance, and an empty balance
returns `402` — your integration is never silently cut off mid-request.

## Rate limits

| Tier | Requests per minute |
|------|---------------------|
| Free | 10 |
| Paid (any purchase) | 60 |
| Enterprise | Custom — contact us |

Limits are per key. Responses include standard `RateLimit-*` headers; exceeding the limit
returns `429` with a `Retry-After` header. Rate limits smooth traffic — your credit balance is
the actual volume control.

## Quick start

```bash
curl -X POST https://api.ethiovin.com/v1/decode \
  -H "Authorization: Bearer $ETHIOVIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"vin": "LCO..............."}'
```

---

## POST /v1/decode

Decode one VIN.

### Request body

| Field | Type | Notes |
|-------|------|-------|
| `vin` | string | The 17-character VIN. Case-insensitive; spaces and dashes are stripped. Characters `I`/`O`/`Q` are **kept** (ASEAN-market VINs legitimately contain them). |

### Response `200`

```json
{
  "request_id": "req_x7Kd91mQ2p",
  "vin": "LCO...............",
  "valid": true,
  "match": "model",
  "parsed": {
    "wmi": "LCO",
    "vds": "CE4CB",
    "vis": ".........",
    "plant_code": "S",
    "model_year": 2025,
    "country": "China",
    "manufacturer": "..."
  },
  "vehicle": {
    "make": "...",
    "model": "...",
    "year": 2025,
    "image_url": "https://..."
  },
  "specs": {
    "engine": { "...": "..." },
    "transmission": { "...": "..." },
    "weightAndCapacity": { "...": "..." },
    "dimensions": { "...": "..." },
    "tiresAndChassis": { "...": "..." },
    "classification": { "...": "..." },
    "marketInformation": { "...": "..." }
  },
  "credits": { "charged": 1, "balance": 249 }
}
```

### The `match` field

| Value | Meaning | `vehicle` / `specs` | Cost |
|-------|---------|--------------------|------|
| `exact` | This exact VIN has been recorded in the EthioVin network. | Present | 1 credit |
| `model` | This VIN's model (same manufacturer + hardware code) has been verified from another vehicle. Specs are model-level; the year is decoded from **your** VIN. | Present | 1 credit |
| `none` | Valid VIN, but this model isn't in our records yet. You still get the parsed structure (manufacturer, country, model year). | `null` | Free |

Notes:

- `model_year` is decoded from the VIN itself (position 10, with the position-7 cycle rule
  that correctly handles pre-2010 vehicles). It is a strong heuristic derived from the VIN,
  not a registration record.
- `specs` sections are typical, not guaranteed exhaustive — treat the object as open;
  additional sections may appear as coverage grows.
- Coverage is self-improving: a `none` today frequently becomes a `model` hit once any vehicle
  of that model is verified in the network.

### Idempotency

Send an optional `Idempotency-Key` header (any unique string, max 64 chars) to make retries
safe. Replaying the same key + body within 24 hours returns the original response **without a
second charge**. The same key with a different body returns `409`.

```
Idempotency-Key: order-8842-attempt-1
```

---

## POST /v1/decode/batch

Decode up to **50 VINs** in a single call. Each VIN is decoded and charged **independently**,
using the exact same rules as `/v1/decode` — a data hit costs 1 credit, a parse-only result or
an invalid VIN is free. Results are **partial**: one VIN failing (invalid, or your balance
running out partway through) never fails the others.

### Request body

| Field | Type | Notes |
|-------|------|-------|
| `vins` | string[] | 1 to 50 VIN strings. Each is cleaned and decoded exactly like the single endpoint (I/O/Q kept). |

```json
{ "vins": ["LCO...............", "MMB...............", "notavin"] }
```

### Response `200`

The call is **always `200`** when the batch itself is well-formed — per-VIN outcomes live in
`results`, in the same order as the request. Each element is either a decode result (the same
shape as a single `/v1/decode` response, minus the top-level fields) or a per-VIN `error`.

```json
{
  "request_id": "req_batch_9f2Kd1",
  "results": [
    {
      "request_id": "req_x7Kd91mQ2p",
      "vin": "LCO...............",
      "valid": true,
      "match": "model",
      "parsed": { "wmi": "LCO", "vds": "CE4CB", "vis": "...", "plant_code": "S", "model_year": 2025, "country": "China", "manufacturer": "..." },
      "vehicle": { "make": "...", "model": "...", "year": 2025, "image_url": "https://..." },
      "specs": { "engine": { "...": "..." } },
      "credits": { "charged": 1, "balance": 248 }
    },
    {
      "vin": "MMB...............",
      "valid": true,
      "match": "none",
      "parsed": { "wmi": "MMB", "vds": "...", "...": "..." },
      "vehicle": null,
      "specs": null,
      "credits": { "charged": 0, "balance": 248 }
    },
    { "vin": "notavin", "valid": false, "error": { "code": "invalid_vin", "message": "The VIN did not clean to 17 characters." } }
  ],
  "credits": { "charged": 1, "balance": 248 }
}
```

- Top-level `credits.charged` is the **total** credits spent by the batch; `credits.balance` is
  your balance **after** the batch.
- Each successful result carries its own `credits.balance` reflecting the balance at that point
  in the batch (charges are applied in order).
- If your balance runs out mid-batch, the remaining data-hit VINs return a per-VIN
  `insufficient_credits` error (**no vehicle data**), while later parse-only VINs still return
  their free result.

### Charging & idempotency

- Charging is sequential, so a batch can never overspend your balance.
- The optional `Idempotency-Key` header covers the **whole batch**: replaying the same key + body
  returns the stored batch response with no additional charges; a different body returns `409`.

### Errors (batch-level)

Only a malformed batch envelope fails the whole call:

| HTTP | `code` | Meaning |
|------|--------|---------|
| 422 | `invalid_request` | `vins` is missing, empty, or has more than 50 entries. |

Per-VIN problems (`invalid_vin`, `insufficient_credits`) appear inside `results`, not as a
top-level error.

---

## GET /v1/account

Balance and key info for the calling key.

```json
{
  "balance": 249,
  "key": { "name": "production", "prefix": "evn_live_9f3K", "rate_limit_per_min": 60 },
  "usage_this_month": { "decodes": 1210, "credits_spent": 1094 }
}
```

## GET /v1/usage?from=YYYY-MM-DD&to=YYYY-MM-DD

Per-day usage for the calling key's account. Maximum range: 92 days.

```json
{
  "from": "2026-07-01",
  "to": "2026-07-10",
  "days": [
    { "date": "2026-07-01", "decodes": 141, "hits": 128, "credits_spent": 128 }
  ]
}
```

## GET /v1/health

Unauthenticated liveness probe. Returns `{ "status": "ok" }`.

---

## Errors

All errors use one envelope:

```json
{
  "error": {
    "code": "insufficient_credits",
    "message": "Your balance is 0. Top up to continue decoding.",
    "doc_url": "https://api.ethiovin.com/developers/docs#errors"
  }
}
```

| HTTP | `code` | Meaning |
|------|--------|---------|
| 401 | `unauthorized` | Missing, invalid, revoked, or expired API key. |
| 402 | `insufficient_credits` | Balance is empty. No vehicle data is returned. Top up in the dashboard. |
| 409 | `idempotency_conflict` | This `Idempotency-Key` was already used with a different request body. |
| 422 | `invalid_vin` | The VIN did not clean to 17 characters. Free. |
| 422 | `invalid_request` | Malformed request body (e.g. batch `vins` missing, empty, or over 50). Free. |
| 429 | `rate_limited` | Per-key rate limit exceeded. Honor `Retry-After`. |
| 500 | `server_error` | Something broke on our side. Retry with the same `Idempotency-Key`; you will not be double-charged. |

`402` vs `429` are distinct on purpose: `402` means buy credits, `429` means slow down.

---

## Code samples

**Node.js**

```js
const res = await fetch("https://api.ethiovin.com/v1/decode", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.ETHIOVIN_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ vin }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error.code);
console.log(data.match, data.vehicle, data.credits.balance);
```

**Python**

```python
import os, requests

r = requests.post(
    "https://api.ethiovin.com/v1/decode",
    headers={"Authorization": f"Bearer {os.environ['ETHIOVIN_API_KEY']}"},
    json={"vin": vin},
    timeout=15,
)
data = r.json()
r.raise_for_status()
print(data["match"], data["vehicle"], data["credits"]["balance"])
```

---

## Changelog

- **v1 (unreleased)** — initial public surface: `decode`, `decode/batch`, `account`, `usage`,
  `health`; idempotency.
