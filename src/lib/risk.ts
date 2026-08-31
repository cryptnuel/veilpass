import type { PaymentRequest, RiskFinding, Verdict } from "./types.ts";

const patterns = [
  {
    id: "urgency",
    re: /\b(urgent|immediately|right now|act now|last chance|emergency)\b/i,
    title: "Urgency pressure",
    detail: "Scammers often manufacture urgency so you pay before checking the story.",
  },
  {
    id: "secrecy",
    re: /\b(keep (this|it) secret|do not tell|don't tell|between us|confidential request)\b/i,
    title: "Secrecy request",
    detail: "A demand to hide the payment from trusted people is a common social-engineering signal.",
  },
  {
    id: "impersonation",
    re: /\b(bank|support|customer service|police|government|tax|irs|boss|ceo)\b/i,
    title: "Authority or support claim",
    detail: "Confirm authority claims through a separate, trusted communication channel.",
  },
  {
    id: "recovery",
    re: /\b(recovery fee|unlock funds|release funds|verification payment|processing fee)\b/i,
    title: "Pay-to-unlock claim",
    detail: "Advance-fee scams commonly promise larger funds after a small irreversible payment.",
  },
  {
    id: "romance",
    re: /\b(love you|my love|future together|travel to see you|medical bill|stuck abroad)\b/i,
    title: "Relationship-based pressure",
    detail: "Unexpected financial emergencies in online relationships deserve independent verification.",
  },
];

export function analyzeRequest(request: PaymentRequest, now = Date.now()): RiskFinding[] {
  const findings: RiskFinding[] = [];
  if (request.expiresAt * 1000 <= now) {
    findings.push({ id: "expired", severity: "danger", title: "Request expired", detail: "Do not pay an expired request. Ask the recipient to create a new one." });
  }
  if (!/^0x[0-9a-f]{1,64}$/i.test(request.recipient)) {
    findings.push({ id: "recipient", severity: "danger", title: "Invalid recipient", detail: "The recipient is not a valid Starknet address." });
  }
  const amount = Number(request.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    findings.push({ id: "amount", severity: "danger", title: "Invalid amount", detail: "The requested amount must be greater than zero." });
  } else if (amount >= 1000) {
    findings.push({ id: "large-amount", severity: "warning", title: "Large payment", detail: "Pause and confirm large payments through a separate trusted channel." });
  }
  for (const pattern of patterns) {
    if (pattern.re.test(request.memo)) findings.push({ ...pattern, severity: "warning" });
  }
  if (!findings.length) {
    findings.push({ id: "clean", severity: "info", title: "No behavioral red flags found", detail: "This is not a guarantee. Confirm the recipient and purpose before paying." });
  }
  return findings;
}

export function verdictFor(findings: RiskFinding[], signatureValid: boolean | null): Verdict {
  if (signatureValid === false || findings.some((finding) => finding.severity === "danger")) return "nay";
  if (signatureValid === null || findings.some((finding) => finding.severity === "warning")) return "caution";
  return "yay";
}
