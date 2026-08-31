export type PaymentRequest = {
  version: 1;
  recipient: string;
  token: string;
  amount: string;
  memo: string;
  expiresAt: number;
  nonce: string;
  privacy: "required";
};

export type SignedRequest = {
  request: PaymentRequest;
  signature: string[];
};

export type RiskFinding = {
  id: string;
  severity: "info" | "warning" | "danger";
  title: string;
  detail: string;
};

export type Verdict = "yay" | "caution" | "nay";
