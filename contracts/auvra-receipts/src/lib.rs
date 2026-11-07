use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::store::LookupMap;
use near_sdk::{env, near, AccountId, BorshStorageKey, PanicOnDefault};

const SCHEMA_VERSION: u8 = 1;

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
    Writers,
    ProjectReceipts,
    SettlementReceipts,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct ProjectReceipt {
    pub schema_version: u8,
    pub reference_hash: String,
    pub canonical_record_hash: String,
    pub issuer: AccountId,
    pub block_timestamp_ns: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct SettlementReceipt {
    pub schema_version: u8,
    pub reference_hash: String,
    pub canonical_record_hash: String,
    pub provider_receipt_hash: String,
    pub issuer: AccountId,
    pub block_timestamp_ns: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct ReceiptRegistry {
    owner: AccountId,
    writers: LookupMap<AccountId, bool>,
    project_receipts: LookupMap<String, ProjectReceipt>,
    settlement_receipts: LookupMap<String, SettlementReceipt>,
}

#[near]
impl ReceiptRegistry {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        assert!(!env::state_exists(), "Already initialized");
        Self {
            owner,
            writers: LookupMap::new(StorageKey::Writers),
            project_receipts: LookupMap::new(StorageKey::ProjectReceipts),
            settlement_receipts: LookupMap::new(StorageKey::SettlementReceipts),
        }
    }

    pub fn owner(&self) -> AccountId {
        self.owner.clone()
    }

    pub fn is_writer(&self, account_id: AccountId) -> bool {
        account_id == self.owner || self.writers.get(&account_id).copied().unwrap_or(false)
    }

    pub fn add_writer(&mut self, account_id: AccountId) {
        self.require_owner();
        self.writers.insert(account_id.clone(), true);
        self.emit(
            "writer_added",
            near_sdk::serde_json::json!({ "account_id": account_id }),
        );
    }

    pub fn remove_writer(&mut self, account_id: AccountId) {
        self.require_owner();
        assert!(account_id != self.owner, "Owner cannot be removed");
        self.writers.remove(&account_id);
        self.emit(
            "writer_removed",
            near_sdk::serde_json::json!({ "account_id": account_id }),
        );
    }

    pub fn record_project_receipt(
        &mut self,
        schema_version: u8,
        reference_hash: String,
        canonical_record_hash: String,
    ) -> ProjectReceipt {
        self.require_writer();
        assert_eq!(schema_version, SCHEMA_VERSION, "Unsupported schema version");
        assert_hash(&reference_hash);
        assert_hash(&canonical_record_hash);
        if let Some(existing) = self.project_receipts.get(&reference_hash) {
            assert_eq!(
                existing.canonical_record_hash, canonical_record_hash,
                "Conflicting receipt"
            );
            return existing.clone();
        }
        let receipt = ProjectReceipt {
            schema_version: SCHEMA_VERSION,
            reference_hash: reference_hash.clone(),
            canonical_record_hash,
            issuer: env::predecessor_account_id(),
            block_timestamp_ns: env::block_timestamp(),
        };
        self.project_receipts
            .insert(reference_hash, receipt.clone());
        self.emit(
            "project_receipt_recorded",
            near_sdk::serde_json::to_value(&receipt).unwrap(),
        );
        receipt
    }

    pub fn record_settlement_receipt(
        &mut self,
        schema_version: u8,
        reference_hash: String,
        canonical_record_hash: String,
        provider_receipt_hash: String,
    ) -> SettlementReceipt {
        self.require_writer();
        assert_eq!(schema_version, SCHEMA_VERSION, "Unsupported schema version");
        assert_hash(&reference_hash);
        assert_hash(&canonical_record_hash);
        assert_hash(&provider_receipt_hash);
        if let Some(existing) = self.settlement_receipts.get(&reference_hash) {
            assert_eq!(
                existing.canonical_record_hash, canonical_record_hash,
                "Conflicting receipt"
            );
            assert_eq!(
                existing.provider_receipt_hash, provider_receipt_hash,
                "Conflicting provider receipt"
            );
            return existing.clone();
        }
        let receipt = SettlementReceipt {
            schema_version: SCHEMA_VERSION,
            reference_hash: reference_hash.clone(),
            canonical_record_hash,
            provider_receipt_hash,
            issuer: env::predecessor_account_id(),
            block_timestamp_ns: env::block_timestamp(),
        };
        self.settlement_receipts
            .insert(reference_hash, receipt.clone());
        self.emit(
            "settlement_receipt_recorded",
            near_sdk::serde_json::to_value(&receipt).unwrap(),
        );
        receipt
    }

    pub fn get_project_receipt(&self, reference_hash: String) -> Option<ProjectReceipt> {
        self.project_receipts.get(&reference_hash).cloned()
    }

    pub fn get_settlement_receipt(&self, reference_hash: String) -> Option<SettlementReceipt> {
        self.settlement_receipts.get(&reference_hash).cloned()
    }

    fn require_owner(&self) {
        assert_eq!(env::predecessor_account_id(), self.owner, "Owner only");
    }

    fn require_writer(&self) {
        assert!(self.is_writer(env::predecessor_account_id()), "Writer only");
    }

    fn emit(&self, event: &str, data: near_sdk::serde_json::Value) {
        env::log_str(&format!(
            "EVENT_JSON:{}",
            near_sdk::serde_json::json!({
                "standard": "auvra_receipts",
                "version": "1.0.0",
                "event": event,
                "data": [data]
            })
        ));
    }
}

fn assert_hash(value: &str) {
    assert!(
        value.len() == 64
            && value
                .bytes()
                .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase()),
        "Expected a lowercase SHA-256 hex digest"
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{get_logs, VMContextBuilder};
    use near_sdk::testing_env;

    fn account(value: &str) -> AccountId {
        value.parse().unwrap()
    }
    fn context(predecessor: &str) {
        testing_env!(VMContextBuilder::new()
            .predecessor_account_id(account(predecessor))
            .build());
    }
    fn hash(byte: char) -> String {
        byte.to_string().repeat(64)
    }

    #[test]
    fn owner_writer_and_append_only_replay() {
        context("owner.near");
        let mut registry = ReceiptRegistry::new(account("owner.near"));
        registry.add_writer(account("writer.near"));
        context("writer.near");
        let first = registry.record_project_receipt(1, hash('a'), hash('b'));
        let log = get_logs().last().cloned().unwrap();
        assert!(log.starts_with("EVENT_JSON:"));
        assert!(log.contains("project_receipt_recorded"));
        assert!(!log.contains("private-brief"));
        let replay = registry.record_project_receipt(1, hash('a'), hash('b'));
        assert_eq!(first, replay);
        assert_eq!(registry.get_project_receipt(hash('a')), Some(first));
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(
            || registry.record_project_receipt(1, hash('a'), hash('c'))
        ))
        .is_err());
        context("owner.near");
        registry.remove_writer(account("writer.near"));
        context("writer.near");
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(
            || registry.record_project_receipt(1, hash('d'), hash('e'))
        ))
        .is_err());
    }

    #[test]
    fn settlement_requires_authorization_and_valid_hashes() {
        context("owner.near");
        let mut registry = ReceiptRegistry::new(account("owner.near"));
        context("stranger.near");
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(
            || registry.record_settlement_receipt(1, hash('a'), hash('b'), hash('c'))
        ))
        .is_err());
        context("owner.near");
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(
            || registry.record_project_receipt(1, "private-brief".to_string(), hash('b'))
        ))
        .is_err());
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(
            || registry.record_project_receipt(2, hash('a'), hash('b'))
        ))
        .is_err());
        let receipt = registry.record_settlement_receipt(1, hash('a'), hash('b'), hash('c'));
        assert_eq!(registry.get_settlement_receipt(hash('a')), Some(receipt));
    }

    #[test]
    fn canonical_golden_vector() {
        context("owner.near");
        let bytes = br#"{"kind":"PROJECT","projectReference":"project-demo-1","quoteVersion":1,"schemaVersion":1,"scopeHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}"#;
        let digest = env::sha256(bytes);
        let actual: String = digest.iter().map(|byte| format!("{byte:02x}")).collect();
        assert_eq!(
            actual,
            "27c375b605e6dd27dc8bdd8e2db4bf354177f18542beb71917dd0d4254788d44"
        );
    }
}
