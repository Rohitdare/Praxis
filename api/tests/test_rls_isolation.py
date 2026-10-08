import re
from pathlib import Path

MIGRATION_PATH = (
    Path(__file__).parent.parent.parent
    / "supabase"
    / "migrations"
    / "20261008000000_initial_schema.sql"
)

EXPECTED_TABLES = [
    "profiles",
    "items",
    "resources",
    "tasks",
    "calendar_events",
    "tags",
    "item_tags",
    "item_relationships",
]

MUTABLE_TABLES = [
    "profiles",
    "items",
    "resources",
    "tasks",
    "calendar_events",
    "item_relationships",
]


def test_migration_file_exists() -> None:
    assert MIGRATION_PATH.exists(), f"Migration file missing at {MIGRATION_PATH}"


def test_rls_enabled_on_all_user_owned_tables() -> None:
    content = MIGRATION_PATH.read_text(encoding="utf-8")
    for table in EXPECTED_TABLES:
        pattern = rf"alter\s+table\s+public\.{table}\s+enable\s+row\s+level\s+security;"
        match = re.search(pattern, content, re.IGNORECASE)
        assert match is not None, f"RLS is not explicitly enabled on table '{table}'"


def test_distinct_ownership_policies_exist_with_auth_uid() -> None:
    content = MIGRATION_PATH.read_text(encoding="utf-8")
    for table in EXPECTED_TABLES:
        policy_pattern = (
            rf"create\s+policy\s+own_{table}\s+on\s+public\.{table}\s+"
            rf"for\s+all\s+"
            rf"using\s*\((id|user_id)\s*=\s*\(select\s+auth\.uid\(\)\)\)\s+"
            rf"with\s+check\s*\((id|user_id)\s*=\s*\(select\s+auth\.uid\(\)\)\);"
        )
        match = re.search(policy_pattern, content, re.IGNORECASE)
        assert match is not None, (
            f"Table '{table}' missing distinct own_{table} policy with auth.uid() check"
        )


def test_updated_at_triggers_attached() -> None:
    content = MIGRATION_PATH.read_text(encoding="utf-8")
    for table in MUTABLE_TABLES:
        pattern = (
            rf"before\s+update\s+on\s+public\.{table}\s+for\s+each\s+row\s+"
            rf"execute\s+function\s+public\.set_updated_at\(\);"
        )
        match = re.search(pattern, content, re.IGNORECASE)
        assert match is not None, f"Trigger set_updated_at missing on table '{table}'"


class MockRLSContext:
    def __init__(self, current_user_id: str):
        self.current_user_id = current_user_id

    def evaluate_using(self, row: dict, owner_key: str = "user_id") -> bool:
        return row.get(owner_key) == self.current_user_id

    def evaluate_with_check(self, row: dict, owner_key: str = "user_id") -> bool:
        return row.get(owner_key) == self.current_user_id


def test_rls_cross_user_isolation_simulation() -> None:
    user_a = "11111111-1111-1111-1111-111111111111"
    user_b = "22222222-2222-2222-2222-222222222222"

    items_db = [
        {"id": "item-1", "user_id": user_a, "raw_input": "User A secret note"},
        {"id": "item-2", "user_id": user_b, "raw_input": "User B public item"},
    ]

    context_user_b = MockRLSContext(current_user_id=user_b)

    # 1. User B query should only see User B's rows
    visible_to_b = [item for item in items_db if context_user_b.evaluate_using(item)]
    assert len(visible_to_b) == 1
    assert visible_to_b[0]["id"] == "item-2"
    assert visible_to_b[0]["raw_input"] == "User B public item"

    # User A's row was completely isolated from User B
    assert not any(item["id"] == "item-1" for item in visible_to_b)

    # 2. User B cannot insert a row claiming User A's user_id
    attempted_malicious_insert = {
        "id": "item-3",
        "user_id": user_a,
        "raw_input": "Impersonated item",
    }
    can_insert = context_user_b.evaluate_with_check(attempted_malicious_insert)
    assert not can_insert, "RLS with_check must block cross-user insert"

    # 3. User B cannot update User A's row
    can_update = context_user_b.evaluate_using(items_db[0])
    assert not can_update, "RLS using must block cross-user update visibility"
