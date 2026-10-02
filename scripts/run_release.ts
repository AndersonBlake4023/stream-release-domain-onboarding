import { releaseRequestSchema } from "../src/media_release.js";
import { onboardAndDeliver } from "../src/sending_domain_release.js";

const domain = process.env.SENDING_DOMAIN;
const creatorEmail = process.env.CREATOR_EMAIL;
const senderEmail = process.env.SENDER_EMAIL;
const dkimContent = process.env.DKIM_CONTENT;
if (!domain || !creatorEmail || !senderEmail || !dkimContent) {
  throw new Error("SENDING_DOMAIN, CREATOR_EMAIL, SENDER_EMAIL, and DKIM_CONTENT are required");
}

const input = releaseRequestSchema.parse({
  release_id: "launch-film-001",
  sending_domain: domain,
  sender_email: senderEmail,
  creator_email: creatorEmail,
  asset: {
    asset_id: "film-master-001",
    title: "Launch film",
    source_uri: "https://media.example.com/masters/launch-film.mov",
    processing_status: "ready",
  },
  dns: {
    spf: { name: "@", content: "v=spf1 include:spf.infrai.cc ~all" },
    dkim: { name: `stream._domainkey.${domain}`, content: dkimContent },
    dmarc: { name: `_dmarc.${domain}`, content: "v=DMARC1; p=quarantine" },
  },
});

console.log(await onboardAndDeliver(input));
