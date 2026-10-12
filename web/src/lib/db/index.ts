import Dexie, { type Table } from "dexie"
import type { LocalItem, OutboxRecord, SyncMetaRecord } from "./schema"

export class PersonalMemoryDB extends Dexie {
  local_items!: Table<LocalItem, string>
  outbox!: Table<OutboxRecord, string>
  sync_meta!: Table<SyncMetaRecord, string>

  constructor(databaseName = "personal_memory_db") {
    super(databaseName)
    this.version(1).stores({
      local_items: "id, user_id, captured_at, updated_at, type, status, deleted_at, synced",
      outbox: "id, item_id, status, created_at",
      sync_meta: "key",
    })

    this.version(2)
      .stores({
        local_items:
          "id, user_id, captured_at, updated_at, type, status, deleted_at, synced, [user_id+deleted_at]",
        outbox: "id, item_id, user_id, status, created_at, [user_id+status]",
        sync_meta: "key",
      })
      .upgrade((tx) => {
        return tx
          .table("outbox")
          .toCollection()
          .modify((record: OutboxRecord) => {
            if (!record.user_id && record.payload?.user_id) {
              record.user_id = record.payload.user_id
            }
          })
      })
  }
}

export const db = new PersonalMemoryDB()
