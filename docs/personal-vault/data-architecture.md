# Personal Vault — Data Architecture (OS4.1B)

## Scope

OS4.1B establishes MongoDB metadata models for Personal Vault. It does not add API routes, upload handlers, download handlers, UI, background jobs, or automatic database index creation.

Cloudflare R2 stores file bytes. MongoDB stores ownership, organization, lifecycle, quota, and note metadata. The R2 bucket remains private; browser access will use short-lived presigned URLs issued by authenticated server endpoints.

## Models

| Model | Collection | Responsibility |
|---|---|---|
| VaultFolder | `vaultfolders` | User-owned folders and nested folders |
| VaultFile | `vaultfiles` | Metadata for an R2 object and its lifecycle |
| VaultUsage | `vaultusage` | One quota and usage ledger per user |
| Note | `notes` | Text notes, tags, folders, and file attachments |

All four models use Mongoose timestamps and a required `userId` owner reference. Every API query and mutation must scope records by the authenticated user's ID. A supplied folder or attachment ID must be re-queried with that same owner; possession of an ObjectId is not authorization.

## Folder rules

- `parentId: null` means a root folder.
- A folder's parent must belong to the same user. Enforce this in the service/API layer.
- Folder names are normalized into `normalizedName`.
- The compound unique index prevents duplicate normalized names under the same user and parent.
- Folder moves must reject cycles and cross-user parents.
- Folder deletion and re-parenting behavior belongs to a later API lifecycle step; do not cascade-delete files implicitly.

## File metadata and object lifecycle

The `objectKey` is an opaque, server-generated R2 key. Never derive it from the original filename, username, or user-provided path. The key is immutable and unique.

Allowed lifecycle states:

1. `pending_upload` — metadata and quota reservation exist; upload URL may be issued.
2. `quarantined` — object upload completed but has not passed verification/scanning.
3. `available` — verified file may be listed and downloaded by its owner.
4. `trashed` — soft-deleted and retained during the recovery window.
5. `deleting` — permanent object deletion is in progress.
6. `deleted` — object deletion has been confirmed.
7. `failed` — upload or verification failed and reservations must be reconciled.

Only `available` files should be downloadable. A later upload-completion service must verify the object in R2 (including its size and signed metadata/checksum where available) before changing the status to `available`. Do not trust browser-supplied size, MIME type, ETag, or checksum as proof.

The model records the original filename for display, but it is never an R2 key. Restrict accepted MIME types, file size, and file signatures in the upload service. A file extension or browser-provided MIME type alone is not a security check.

## Quota accounting

The initial per-user quota is **2 GiB = 2,147,483,648 bytes**.

- `usedBytes` counts committed stored objects.
- `reservedBytes` counts in-flight uploads.
- Available capacity is `quotaBytes - usedBytes - reservedBytes`.
- Trash continues to count toward usage until permanent object deletion succeeds.
- Failed or expired uploads must release reservations safely.
- A user's usage document must be created idempotently.

Quota reservation and commit/release operations must be atomic conditional MongoDB updates (or transactions where appropriate). The service must reject a reservation if the resulting `usedBytes + reservedBytes + requestedBytes` would exceed `quotaBytes`. Do not rely on Mongoose document validation for concurrency control. Reconciliation jobs should compare metadata with R2 objects and repair stale reservations/counters.

The `plan` field and per-user `quotaBytes` allow future plan expansion without creating separate buckets per user.

## Notes and attachments

Notes are separate MongoDB records and may reference VaultFile IDs. The API must verify that every attachment belongs to the same user and is in an attachable state. Deleting a note must not delete its attached files automatically.

The initial `provider_managed` encryption mode means transport security and provider-managed storage encryption; it is **not** end-to-end encryption. The `client_side` mode and `cryptoVersion` fields reserve a migration path for future client-side encryption. When client-side encryption is introduced, content and file bytes must be encrypted in the browser before storage; server-side full-text search, previews, and malware scanning will have limitations for ciphertext.

## Indexes

Indexes are declared in the model files for owner-scoped folder listing, file listing by status/folder/tag, note listing, and unique folder/object/usage constraints. Production index creation should be reviewed and applied deliberately; do not assume declaring a Mongoose index means it has already been created in MongoDB.

## Not included in OS4.1B

- R2 upload/download API endpoints or presigned URL generation
- Quota reservation and reconciliation service implementation
- File scanning, content-signature inspection, or preview generation
- Folder/file/note CRUD endpoints
- Trash cleanup jobs
- Client-side encryption implementation
- Personal Vault UI or unified search

These belong to subsequent implementation stages.
