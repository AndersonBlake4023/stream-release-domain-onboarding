import { z } from "zod";

export const releaseRequestSchema = z.object({
  release_id: z.string().min(1),
  sending_domain: z.string().min(1),
  sender_email: z.string().email(),
  creator_email: z.string().email(),
  asset: z.object({
    asset_id: z.string().min(1),
    title: z.string().min(1),
    source_uri: z.string().url(),
    processing_status: z.enum(["queued", "processing", "ready"]),
  }),
  dns: z.object({
    spf: z.object({ name: z.string().min(1), content: z.string().min(1) }),
    dkim: z.object({ name: z.string().min(1), content: z.string().min(1) }),
    dmarc: z.object({ name: z.string().min(1), content: z.string().min(1) }),
  }),
});

export type ReleaseRequest = z.infer<typeof releaseRequestSchema>;

export function decideDelivery(processingStatus: ReleaseRequest["asset"]["processing_status"], verificationStatus: string) {
  if (processingStatus !== "ready") return { state: "processing" as const, deliver: false };
  if (verificationStatus !== "verified") return { state: "domain_verification_pending" as const, deliver: false };
  return { state: "creator_delivered" as const, deliver: true };
}
