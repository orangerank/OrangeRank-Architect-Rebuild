# Outreach click codes

Outreach emails link to the site with `utm_content` set to an opaque code such as `b18-0001`. The page stays static. A same-origin beacon reads that code and POSTs it once per browser session to `/api/outreach-click`. Invalid or missing codes are ignored.

The record is only the code, the page path, and the server time. Names, email addresses, IP addresses, and user agents are not stored. Each UTC day is a Redis list, `or:clicks:YYYY-MM-DD`, kept for about 90 days after the last click written to that day. Recording stops once that day has 2,000 clicks. One code can add at most 20 of those clicks. One network address can add at most 30 clicks in 10 minutes; only a hash of that address is kept, on a key that expires with that window, and the hash is not part of the click record. This uses the existing `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` database. No new service is required.

Accepted codes match `b18-0001` after trimming and lowercasing: a short letter-led batch, a hyphen, four digits, and an optional short follow-up suffix such as `b18-0001-f2`. Anything else, including an email address, is dropped.

## Read secret

Set `ORANGERANK_OUTREACH_CLICKS_SECRET` on the Vercel environment that should allow reads. It must be at least 32 characters and different from `ORANGERANK_AUDIT_SECRET`, `ORANGERANK_DISPATCH_SECRET`, `ORANGERANK_REVIEW_REPLAY_SECRET`, and `ORANGERANK_SANDBOX_CORRECTION_SECRET`. The public beacon does not use this secret. Do not put it in the browser.

## Query clicks

One UTC day:

```bash
curl -sS \
  -H "Authorization: Bearer $ORANGERANK_OUTREACH_CLICKS_SECRET" \
  "https://www.getorangerank.com/api/internal/outreach-clicks?date=2026-10-24"
```

An inclusive range is at most 90 UTC days:

```bash
curl -sS \
  -H "Authorization: Bearer $ORANGERANK_OUTREACH_CLICKS_SECRET" \
  "https://www.getorangerank.com/api/internal/outreach-clicks?from=2026-10-01&to=2026-10-24"
```

A 200 response is `{ "from", "to", "truncated", "clicks": [{ "code", "path", "at" }] }`. `at` is UTC. `truncated` is true when a day held more than 5000 clicks and the response stopped at that cap. An empty day is `200` with `"clicks": []`. `401` means the secret is missing or rejected. `400` means the date query is invalid. `503` means Redis could not be read; do not treat that as zero clicks.
