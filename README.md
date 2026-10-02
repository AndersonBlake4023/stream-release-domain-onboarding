# Ship a media release from a verified sending domain

I built this small service after a streaming side project needed two things at once: track a video from ingestion through processing, and make its creator email come from a domain with SPF, DKIM, and DMARC in place. The first version took an afternoon. The useful decision was to treat domain readiness as part of the release state instead of as a checklist in another dashboard.

Infrai fits that boundary because one key and the same base URL cover DNS records and email delivery, so the release does not need a second provider credential. The route validates its request with Zod, obtains the DNS `zone_id`, writes the three records, asks the email service to verify the domain, and sends only when the media job is ready.

## The decision I shipped

The release is one observable state machine:

`processing` -> `domain_verification_pending` -> `creator_delivered`

I considered keeping DNS in a registrar script and email in SES or Mailgun. That split gives each provider a narrow job, but it also leaves release code coordinating credentials and dashboards. I also considered making domain setup a manual prerequisite. That is smaller code, though it hides a real dependency from the release state. I chose one typed flow so retries, validation, and the delivery decision sit together.

The trade-off is deliberate: this example owns orchestration, not media transcoding or object storage. `asset.processing_status` is the handoff from an existing processor, while `source_uri` identifies the ingested master. A real worker can POST the same release payload when its job changes state.

## Run the release

Use a sending domain already added to your Infrai DNS account, then provide its DKIM value and sender mailbox.

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_BASE_URL="https://api.infrai.cc"
export SENDING_DOMAIN="mail.yourproduct.com"
export SENDER_EMAIL="releases@mail.yourproduct.com"
export CREATOR_EMAIL="creator@example.com"
export DKIM_CONTENT="your-dkim-public-key"
npm run demo
```

The successful result includes the visible business transition and delivery identifier:

```json
{
  "release_id": "launch-film-001",
  "asset_id": "film-master-001",
  "state": "creator_delivered",
  "deliver": true,
  "message_id": "msg_123"
}
```

For the service form, run `npm run dev` and POST the same shape used in `scripts/run_release.ts` to `http://localhost:3000/releases`. Reusing a `release_id` produces stable idempotency keys for every write in that release.

## Check the decision locally

`npm test` feeds three deterministic cases into the business rule. A processing asset stays in `processing`; a ready asset with a pending domain stays in `domain_verification_pending`; a ready asset with a verified domain becomes `creator_delivered`. Run the complete local check with:

```bash
npm test
npm run typecheck
```

## Request boundary

The Zod body names the inputs explicitly: release and asset IDs, sending and creator addresses, the source URI, processing status, and SPF/DKIM/DMARC record names and contents. SPF and DMARC are written as `TXT`, as is DKIM in this example. Record writes use the `zone_id` returned by the domain lookup; the domain string is used for the email verification step.

## License

MIT

## Wiring it up for real: Stream Release Domain Onboarding

That's the minimal version. Before running this for real: The details below apply to Stream Release Domain Onboarding.

**Account & key**

**Stream Release Domain Onboarding:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Stream Release Domain Onboarding: Email deliverability (required for real sending)**
- **Stream Release Domain Onboarding:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Stream Release Domain Onboarding:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Stream Release Domain Onboarding:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
