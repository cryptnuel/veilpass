import { constants, type TypedData } from "starknet";
import type { PaymentRequest, SignedRequest } from "./types";

export const STRK_TOKEN = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

export function amountToUnits(amount: string): bigint {
  if (!/^\d+(\.\d{1,18})?$/.test(amount)) throw new Error("Enter a valid amount with at most 18 decimals.");
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0"));
}

export function requestTypedData(request: PaymentRequest, chainId = constants.StarknetChainId.SN_MAIN): TypedData {
  return {
    types: {
      StarknetDomain: [
        { name: "name", type: "shortstring" },
        { name: "version", type: "shortstring" },
        { name: "chainId", type: "shortstring" },
        { name: "revision", type: "shortstring" },
      ],
      VeilPassRequest: [
        { name: "recipient", type: "ContractAddress" },
        { name: "token", type: "ContractAddress" },
        { name: "amount", type: "u128" },
        { name: "memo", type: "string" },
        { name: "expiresAt", type: "timestamp" },
        { name: "nonce", type: "felt" },
        { name: "privacy", type: "shortstring" },
      ],
    },
    primaryType: "VeilPassRequest",
    domain: { name: "VeilPass", version: "1", chainId, revision: "1" },
    message: {
      recipient: request.recipient,
      token: request.token,
      amount: amountToUnits(request.amount).toString(),
      memo: request.memo,
      expiresAt: request.expiresAt,
      nonce: request.nonce,
      privacy: "required",
    },
  };
}

export function encodeSignedRequest(value: SignedRequest): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeSignedRequest(value: string): SignedRequest {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as SignedRequest;
}

export function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
