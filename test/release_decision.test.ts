import assert from "node:assert/strict";
import test from "node:test";
import { decideDelivery } from "../src/media_release.js";

test("creator delivery waits for both processing and domain verification", () => {
  assert.deepEqual(decideDelivery("processing", "verified"), { state: "processing", deliver: false });
  assert.deepEqual(decideDelivery("ready", "pending"), {
    state: "domain_verification_pending",
    deliver: false,
  });
  assert.deepEqual(decideDelivery("ready", "verified"), { state: "creator_delivered", deliver: true });
});
