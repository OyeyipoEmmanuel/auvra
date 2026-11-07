# Auvra receipt canonicalization v1

Private records are UTF-8 JSON with object keys sorted lexicographically at every level. Arrays preserve order. Values are strings, booleans, null, or safe integer numbers; floats, `undefined`, and non-JSON values are rejected. SHA-256 is computed over the exact UTF-8 bytes and rendered as lowercase 64-character hex. On chain, only opaque reference and record hashes are submitted. Never submit the canonical JSON, request brief, identity, URLs, messages, or commercial amounts as contract arguments or event data.

The project reference hash is SHA-256 of a private stable project reference. `canonicalRecordHash` is SHA-256 of the complete private canonical record. A project record includes a `quoteHash` over the accepted version, scope, assumptions, exclusions, terms, asset, price, and supplier cap. A settlement record includes hashes of the reconciled ledger entries and provider references. The contract validates schema version, hash syntax, authorized writers, uniqueness, and exact replay; it does not trust or inspect the private record.

Golden vector:

```json
{"kind":"PROJECT","projectReference":"project-demo-1","quoteVersion":1,"schemaVersion":1,"scopeHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
```

The TypeScript and Rust tests must agree on the SHA-256 digest of these exact bytes.

Expected digest: `27c375b605e6dd27dc8bdd8e2db4bf354177f18542beb71917dd0d4254788d44`.

## Local contract verification

Build the Wasm and run the Rust unit suite from `contracts/auvra-receipts`:

```sh
cargo build --release --target wasm32-unknown-unknown
cargo test
```

The sandbox test needs Linux or macOS with `near-workspaces-rs` support and reads the Wasm from that contract's `target/wasm32-unknown-unknown/release` directory:

```sh
cargo test --features sandbox-tests --test sandbox
```

This deploys only to a process-local NEAR sandbox. It neither creates a public testnet/mainnet account nor proves a live receipt transaction. Keep the network and contract account explicit when a public deployment is eventually authorized.
