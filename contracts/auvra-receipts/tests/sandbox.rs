#![cfg(feature = "sandbox-tests")]

use anyhow::Result;
use near_sdk::serde_json::{json, Value};

fn digest(character: char) -> String {
    character.to_string().repeat(64)
}

#[tokio::test]
async fn sandbox_writes_and_public_reads_are_hash_only() -> Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let wasm_path = concat!(env!("CARGO_MANIFEST_DIR"), "/target/wasm32-unknown-unknown/release/auvra_receipts.wasm");
    let wasm = std::fs::read(wasm_path)?;
    let contract = worker.dev_deploy(&wasm).await?;
    let owner = worker.dev_create_account().await?;
    let writer = worker.dev_create_account().await?;
    let stranger = worker.dev_create_account().await?;

    contract
        .call("new")
        .args_json(json!({ "owner": owner.id() }))
        .transact()
        .await?
        .into_result()?;
    owner
        .call(contract.id(), "add_writer")
        .args_json(json!({ "account_id": writer.id() }))
        .transact()
        .await?
        .into_result()?;

    let reference_hash = digest('a');
    let canonical_record_hash = digest('b');
    let arguments = json!({
        "schema_version": 1,
        "reference_hash": reference_hash,
        "canonical_record_hash": canonical_record_hash,
    });
    let recorded = writer
        .call(contract.id(), "record_project_receipt")
        .args_json(arguments.clone())
        .transact()
        .await?
        .into_result()?;
    let events = recorded.logs();
    assert!(events.iter().any(|event| event.contains("project_receipt_recorded")));
    assert!(events.iter().all(|event| !event.contains("private brief")));

    writer
        .call(contract.id(), "record_project_receipt")
        .args_json(arguments.clone())
        .transact()
        .await?
        .into_result()?;
    let receipt: Value = contract
        .view("get_project_receipt")
        .args_json(json!({ "reference_hash": reference_hash }))
        .await?
        .json()?;
    assert_eq!(receipt["canonical_record_hash"], canonical_record_hash);
    assert_eq!(receipt["issuer"], writer.id().as_str());

    let conflict = writer
        .call(contract.id(), "record_project_receipt")
        .args_json(json!({
            "schema_version": 1,
            "reference_hash": reference_hash,
            "canonical_record_hash": digest('c'),
        }))
        .transact()
        .await?;
    assert!(conflict.is_failure());

    let unauthorized = stranger
        .call(contract.id(), "record_settlement_receipt")
        .args_json(json!({
            "schema_version": 1,
            "reference_hash": digest('d'),
            "canonical_record_hash": digest('e'),
            "provider_receipt_hash": digest('f'),
        }))
        .transact()
        .await?;
    assert!(unauthorized.is_failure());

    let settlement_reference_hash = digest('d');
    let settlement_record_hash = digest('e');
    let provider_receipt_hash = digest('f');
    let settlement_args = json!({
        "schema_version": 1,
        "reference_hash": settlement_reference_hash,
        "canonical_record_hash": settlement_record_hash,
        "provider_receipt_hash": provider_receipt_hash,
    });
    let settlement = writer
        .call(contract.id(), "record_settlement_receipt")
        .args_json(settlement_args.clone())
        .transact()
        .await?
        .into_result()?;
    assert!(settlement
        .logs()
        .iter()
        .any(|event| event.contains("settlement_receipt_recorded")));
    writer
        .call(contract.id(), "record_settlement_receipt")
        .args_json(settlement_args)
        .transact()
        .await?
        .into_result()?;
    let settlement_receipt: Value = contract
        .view("get_settlement_receipt")
        .args_json(json!({ "reference_hash": settlement_reference_hash }))
        .await?
        .json()?;
    assert_eq!(settlement_receipt["canonical_record_hash"], settlement_record_hash);
    assert_eq!(settlement_receipt["provider_receipt_hash"], provider_receipt_hash);

    owner
        .call(contract.id(), "remove_writer")
        .args_json(json!({ "account_id": writer.id() }))
        .transact()
        .await?
        .into_result()?;
    let revoked = writer
        .call(contract.id(), "record_project_receipt")
        .args_json(json!({
            "schema_version": 1,
            "reference_hash": digest('1'),
            "canonical_record_hash": digest('2'),
        }))
        .transact()
        .await?;
    assert!(revoked.is_failure());
    Ok(())
}
