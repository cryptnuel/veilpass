"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createStore, type Store } from "@starknet-io/get-starknet-discovery";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";
import type { WALLET_API } from "@starknet-io/types-js";
import { RpcProvider, WalletAccountV6, constants, num, walletV6 } from "starknet";
import { analyzeRequest, verdictFor } from "@/lib/risk";
import { amountToUnits, decodeSignedRequest, encodeSignedRequest, randomNonce, requestTypedData, STRK_TOKEN } from "@/lib/request";
import type { PaymentRequest, SignedRequest } from "@/lib/types";

const rpcUrl = process.env.NEXT_PUBLIC_STARKNET_RPC_URL || "https://starknet-mainnet.public.blastapi.io/rpc/v0_8";
const provider = new RpcProvider({ nodeUrl: rpcUrl });

function short(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-5)}` : value;
}

function signatureArray(signature: unknown): string[] {
  if (Array.isArray(signature)) return signature.map(String);
  if (signature && typeof signature === "object" && "r" in signature && "s" in signature) {
    const value = signature as { r: bigint | string; s: bigint | string };
    return [num.toHex(value.r), num.toHex(value.s)];
  }
  throw new Error("The wallet returned an unsupported signature format.");
}

export default function VeilPassApp() {
  const [wallets, setWallets] = useState<WalletWithStarknetFeatures[]>([]);
  const [picker, setPicker] = useState(false);
  const [account, setAccount] = useState<WalletAccountV6>();
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState<string>(constants.StarknetChainId.SN_MAIN);
  const [mode, setMode] = useState<"create" | "check">("check");
  const [amount, setAmount] = useState("1");
  const [memo, setMemo] = useState("");
  const [hours, setHours] = useState("24");
  const [signed, setSigned] = useState<SignedRequest>();
  const [signatureValid, setSignatureValid] = useState<boolean | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [alreadyPaid, setAlreadyPaid] = useState(false);

  useEffect(() => {
    const store: Store = createStore({ eip1193Adapters: [] });
    setWallets(store.getWallets().slice());
    return store.subscribe((next) => setWallets(next.slice()));
  }, []);

  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get("request");
    if (!encoded) return;
    try {
      setSigned(decodeSignedRequest(encoded));
      setMode("check");
    } catch {
      setError("This payment link is malformed or incomplete.");
    }
  }, []);

  useEffect(() => {
    if (!signed) return;
    setAlreadyPaid(localStorage.getItem(`veilpass:paid:${signed.request.nonce}`) !== null);
    setSignatureValid(null);
    provider
      .verifyMessageInStarknet(requestTypedData(signed.request), signed.signature, signed.request.recipient)
      .then(setSignatureValid)
      .catch(() => setSignatureValid(false));
  }, [signed]);

  const findings = useMemo(() => {
    if (!signed) return [];
    const result = analyzeRequest(signed.request);
    if (alreadyPaid) result.unshift({ id: "replay", severity: "danger", title: "Already paid on this device", detail: "This request was previously submitted from this browser. Do not pay it twice." });
    return result;
  }, [signed, alreadyPaid]);
  const verdict = signed ? verdictFor(findings, signatureValid) : null;

  async function connect(selected: WalletWithStarknetFeatures) {
    setBusy("Connecting wallet");
    setError("");
    try {
      const walletAccount = await WalletAccountV6.connect(provider, selected);
      const accounts = await walletV6.requestAccounts(selected);
      if (!Array.isArray(accounts) || !accounts[0]) throw new Error("The wallet did not return an account.");
      const connectedChain = String(await walletV6.requestChainId(selected));
      setAccount(walletAccount);
      setAddress(num.toHex(accounts[0]));
      setChainId(connectedChain);
      setPicker(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet connection failed.");
    } finally {
      setBusy("");
    }
  }

  async function createRequest() {
    if (!account || !address) return setError("Connect the receiving wallet first.");
    if (chainId !== constants.StarknetChainId.SN_MAIN) return setError("Switch your wallet to Starknet Mainnet.");
    setBusy("Waiting for signature");
    setError("");
    try {
      amountToUnits(amount);
      const request: PaymentRequest = {
        version: 1,
        recipient: address,
        token: STRK_TOKEN,
        amount,
        memo: memo.trim(),
        expiresAt: Math.floor(Date.now() / 1000) + Number(hours) * 3600,
        nonce: randomNonce(),
        privacy: "required",
      };
      const signature = signatureArray(await account.signMessage(requestTypedData(request, chainId)));
      const value = { request, signature };
      const url = `${window.location.origin}${window.location.pathname}?request=${encodeSignedRequest(value)}`;
      setSigned(value);
      setShareUrl(url);
      setSignatureValid(true);
      setMode("check");
      window.history.replaceState({}, "", url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign the request.");
    } finally {
      setBusy("");
    }
  }

  async function payPrivately() {
    if (!signed || verdict === "nay") return;
    if (!account) return setPicker(true);
    if (chainId !== constants.StarknetChainId.SN_MAIN) return setError("Switch your wallet to Starknet Mainnet.");
    setBusy("Submitting private transfer");
    setError("");
    try {
      const actions: WALLET_API.STRK20_ACTION[] = [{
        type: "transfer",
        token: signed.request.token,
        amount: num.toHex(amountToUnits(signed.request.amount)),
        recipient: signed.request.recipient,
      }];
      const result = await account.strk20InvokeTransaction(actions);
      setTxHash(result.transaction_hash);
      localStorage.setItem(`veilpass:paid:${signed.request.nonce}`, result.transaction_hash);
      setAlreadyPaid(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The private transfer failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <main>
      <nav>
        <Link className="brand" href="/"><span>V</span> VeilPass</Link>
        <button className="wallet-button" onClick={() => setPicker(true)}>{address ? short(address) : "Connect wallet"}</button>
      </nav>

      <section className="hero">
        <div className="eyebrow">SCAM-RESISTANT · PRIVATE BY DESIGN</div>
        <h1>Know before<br />you pay.</h1>
        <p>Authenticate the request. Spot manipulation. Pay through Starknet’s private pool only when it checks out.</p>
      </section>

      <section className="workspace">
        <div className="tabs">
          <button className={mode === "check" ? "active" : ""} onClick={() => setMode("check")}>Check a request</button>
          <button className={mode === "create" ? "active" : ""} onClick={() => setMode("create")}>Create a request</button>
        </div>

        {mode === "create" ? (
          <div className="panel form-panel">
            <div className="panel-title"><div><small>FOR RECIPIENTS</small><h2>Create an authenticated request</h2></div><span className="step">01</span></div>
            <label>Amount in STRK<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" /></label>
            <label>Reason for payment<textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="Describe the real purpose clearly" maxLength={280} /></label>
            <label>Expires in<select value={hours} onChange={(event) => setHours(event.target.value)}><option value="1">1 hour</option><option value="24">24 hours</option><option value="72">3 days</option></select></label>
            <button className="primary" onClick={createRequest} disabled={Boolean(busy)}>{busy || "Sign and create request"}</button>
            <p className="fineprint">Your Starknet signature makes unauthorized changes detectable. VeilPass never asks for a private key.</p>
          </div>
        ) : signed ? (
          <div className="review-grid">
            <div className="panel request-card">
              <div className="panel-title"><div><small>PAYMENT REQUEST</small><h2>{signed.request.amount} STRK</h2></div><span className="step">02</span></div>
              <dl><div><dt>Recipient</dt><dd>{short(signed.request.recipient)}</dd></div><div><dt>Purpose</dt><dd>{signed.request.memo || "Not provided"}</dd></div><div><dt>Expires</dt><dd>{new Date(signed.request.expiresAt * 1000).toLocaleString()}</dd></div><div><dt>Route</dt><dd>STRK20 private transfer</dd></div></dl>
              {shareUrl && <button className="secondary" onClick={() => navigator.clipboard.writeText(shareUrl)}>Copy secure link</button>}
            </div>
            <div className={`panel verdict ${verdict}`}>
              <small>VEILPASS VERDICT</small>
              <div className="verdict-word">{signatureValid === null ? "Checking" : verdict}</div>
              <p className="verdict-copy">{verdict === "yay" ? "The request is authentic and no behavioral red flags were found." : verdict === "nay" ? "Do not pay this request. A critical integrity or validity check failed." : "Pause and independently confirm the request before paying."}</p>
              <div className="checks">
                <div><span className={signatureValid ? "dot good" : signatureValid === false ? "dot bad" : "dot"} />{signatureValid === null ? "Verifying account signature" : signatureValid ? "Account signature verified" : "Signature invalid or unverifiable"}</div>
                {findings.map((finding) => <div key={finding.id}><span className={`dot ${finding.severity}`} /> <span><b>{finding.title}</b><small>{finding.detail}</small></span></div>)}
              </div>
              <button className="primary" onClick={payPrivately} disabled={Boolean(busy) || verdict === "nay" || signatureValid !== true || alreadyPaid}>{busy || (alreadyPaid ? "Payment already submitted" : account ? "Pay privately" : "Connect to pay")}</button>
              {txHash && <a className="receipt" href={`https://voyager.online/tx/${txHash}`} target="_blank" rel="noreferrer">Payment submitted · View receipt ↗</a>}
            </div>
          </div>
        ) : (
          <div className="panel empty"><div className="shield">✓</div><h2>Open a VeilPass link</h2><p>Signed payment details are checked locally and against the recipient’s Starknet account before you pay.</p><button className="secondary" onClick={() => setMode("create")}>Create the first request</button></div>
        )}
        {error && <div className="error" role="alert">{error}</div>}
      </section>

      <section className="truth"><small>WHAT VEILPASS PROTECTS</small><div><article><b>01</b><h3>Request integrity</h3><p>Detects changed amounts, recipients, expiry times and memos through Starknet signatures.</p></article><article><b>02</b><h3>Human pressure</h3><p>Surfaces common urgency, secrecy, impersonation and advance-fee patterns without claiming certainty.</p></article><article><b>03</b><h3>Financial privacy</h3><p>Approved payments use STRK20. Deposits, withdrawals and timing can remain observable.</p></article></div></section>

      {picker && <div className="modal-backdrop" onClick={() => !busy && setPicker(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><button className="close" onClick={() => setPicker(false)}>×</button><small>STARKNET WALLETS</small><h2>Choose a wallet</h2>{wallets.filter((wallet) => !wallet.name.toLowerCase().includes("metamask")).map((wallet) => <button className="wallet-row" key={wallet.name} onClick={() => connect(wallet)} disabled={Boolean(busy)}><img src={wallet.icon} alt="" />{wallet.name}<span>→</span></button>)}{!wallets.length && <p>No compatible wallet detected. Install Ready Wallet to use STRK20.</p>}</div></div>}
    </main>
  );
}
