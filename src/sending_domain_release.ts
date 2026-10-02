import { createHash } from "node:crypto";
import { infrai } from "./infrai_client.js";
import { decideDelivery, type ReleaseRequest } from "./media_release.js";

function operationKey(releaseId: string, operation: string): string {
  return createHash("sha256").update(`${releaseId}:${operation}`).digest("hex");
}

export async function onboardAndDeliver(input: ReleaseRequest) {
  const zone = await infrai.dns.domain.get(input.sending_domain);
  const records = [
    { record_type: "TXT", ...input.dns.spf },
    { record_type: "TXT", ...input.dns.dkim },
    { record_type: "TXT", ...input.dns.dmarc },
  ];

  await Promise.all(
    records.map((record, index) =>
      infrai.dns.record.upsert(
        { zone_id: zone.zone_id, ...record, ttl: 300 },
        operationKey(input.release_id, `dns-${index}`),
      ),
    ),
  );

  const domain = await infrai.email.domain.verify(
    input.sending_domain,
    operationKey(input.release_id, "verify-domain"),
  );
  const decision = decideDelivery(input.asset.processing_status, domain.verification.status);
  if (!decision.deliver) {
    return { release_id: input.release_id, asset_id: input.asset.asset_id, ...decision };
  }

  const sent = await infrai.email.send(
    {
      to: input.creator_email,
      from: input.sender_email,
      subject: `${input.asset.title} is ready for review`,
      html: `<p>Your processed media asset ${input.asset.asset_id} is ready for creator delivery.</p>`,
    },
    operationKey(input.release_id, "creator-delivery"),
  );
  return {
    release_id: input.release_id,
    asset_id: input.asset.asset_id,
    state: decision.state,
    deliver: decision.deliver,
    message_id: sent.message_id,
  };
}
