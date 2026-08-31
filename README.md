# VeilPass

Scam-resistant private payment requests on Starknet, powered by STRK20.

VeilPass lets a recipient sign an expiring payment request with their Starknet account. Before a payer moves money, VeilPass checks that the request was not modified, explains social-engineering warning signs, and routes approved payments through the STRK20 privacy pool.

## Why it exists

Private transfers solve linkability, but privacy alone does not tell a payer whether a request is authentic. Crypto users are still exposed to address poisoning, impersonation, modified payment links, urgency pressure, romance scams and advance-fee fraud. VeilPass puts a security decision in front of the irreversible payment.

## Security model

VeilPass verifies objective facts:

- The request is signed by the receiving Starknet account.
- The recipient, amount, memo, expiry and nonce have not changed.
- The request is not expired and its values are structurally valid.
- Payment is submitted as a STRK20 private transfer, not a public ERC-20 transfer.

It also highlights behavioral warning signs such as urgency, secrecy, authority impersonation and pay-to-unlock language. These signals are warnings, not proof that a person is fraudulent. Users should confirm suspicious requests through a separate trusted channel.

## Privacy boundary

Inside STRK20, private transfers hide the sender, recipient, amount, token and spent notes. Shielding and unshielding are public ERC-20 legs, pool interaction and timing remain observable, and correlated behavior can still weaken privacy. VeilPass does not access viewing keys; the privacy-enabled wallet handles the STRK20 action.

## Run locally

Requirements: Node.js 20+, npm, and a privacy-enabled Starknet wallet such as Ready.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. A custom RPC URL is optional.

## Test and build

```bash
npm test
npm run lint
npm run build
```

## Stack

- Next.js 16, React 19 and TypeScript
- starknet.js `WalletAccountV6`
- Starknet Wallet API via wallet-standard discovery
- STRK20 shielded transfer action

## Mainnet evidence

Mainnet transaction hashes, deployed addresses, the live demo and demo video are tracked in [`strk20.json`](./strk20.json). These fields will be populated as the release is deployed and exercised.

## License

MIT
