import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRequest, verdictFor } from "./risk.ts";
import type { PaymentRequest } from "./types.ts";

const safe: PaymentRequest = {
  version: 1,
  recipient: "0x1234",
  token: "0x4718f5a0fc34c",
  amount: "5",
  memo: "Dinner contribution",
  expiresAt: 2_000_000_000,
  nonce: "abc",
  privacy: "required",
};

test("safe signed request receives yay", () => {
  const findings = analyzeRequest(safe, 1_800_000_000_000);
  assert.equal(verdictFor(findings, true), "yay");
});

test("urgency produces caution", () => {
  const findings = analyzeRequest({ ...safe, memo: "Urgent: pay immediately" }, 1_800_000_000_000);
  assert.equal(verdictFor(findings, true), "caution");
});

test("expired or tampered requests are nay", () => {
  const findings = analyzeRequest({ ...safe, expiresAt: 1 }, 1_800_000_000_000);
  assert.equal(verdictFor(findings, true), "nay");
  assert.equal(verdictFor(analyzeRequest(safe, 1_800_000_000_000), false), "nay");
});
