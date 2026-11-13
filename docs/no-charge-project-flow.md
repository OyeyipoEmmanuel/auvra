# No-charge project and NEAR testnet receipt flow

## Customer journey

1. Sign in, submit a request, complete clarification, and accept the quote.
2. Select **Start project**. The small checkout note says no payment is collected and this action does not hire a marketplace agent.
3. Auvra creates the project, task plan, no-charge ledger record, and a pending project receipt in one database transaction.
4. Open `/app/projects/{projectId}/receipt` to view and download the receipt. The quoted value is distinct from the **0.00 charged** amount.
5. When a deployed NEAR testnet receipt contract is configured, the worker anchors only the hash of the approved project record. The UI shows **Verified on NEAR testnet** only when the stored hash is read back and matches.

The project receipt proves the approved project record. It is not a payment receipt, supplier settlement receipt, or proof that a marketplace agent was hired. The workflow view shows the plan and observed matches; actual supplier jobs and deliverables remain separate project records.

## Testnet setup

Use a dedicated NEAR **testnet** contract and writer account. In the worker environment, set:

```dotenv
AUVRA_RUNTIME_MODE=DEMO_SANDBOX
MARKETPLACE_WRITES_ENABLED=false
AUVRA_M7_ENABLED=true
AUVRA_TESTNET_RECEIPTS_ENABLED=true
NEAR_RECEIPT_NETWORK=testnet
NEAR_RECEIPT_CONTRACT_ACCOUNT=<deployed contract account>.testnet
NEAR_RECEIPT_SIGNER_ACCOUNT=<writer account>.testnet
NEAR_RECEIPT_SIGNER_PRIVATE_KEY=<writer account private key>
```

The existing worker also requires `DATABASE_URL` and `REDIS_URL`. Deploy the Rust contract from `contracts/auvra-receipts` to NEAR testnet and authorize the writer account. Keep the signer key in server or worker secrets; never expose it to the browser. Set `NEAR_RECEIPT_CONTRACT_ACCOUNT` in the web environment to enable the read-only **Verify on NEAR** action. The worker flag is off by default and never enables marketplace hiring.

No testnet deployment or transaction is performed by this implementation. Until the contract, writer, and worker are running, receipts remain pending and the UI does not claim onchain verification.
