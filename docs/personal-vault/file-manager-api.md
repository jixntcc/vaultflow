# OS4.1D-2 — Personal Vault file manager API

All endpoints are same-origin and require the existing VaultFlow bearer access token in the `Authorization: Bearer <token>` header. Responses are JSON and sent with `Cache-Control: no-store`.

## Storage usage

`GET /api/vault/usage`

Returns the user's quota ledger:

- `quotaBytes`
- `usedBytes`
- `reservedBytes`
- `availableBytes`

The per-user usage record is initialized with the existing 2 GiB default when it does not exist.

## Folders

`GET /api/vault/folders?parentId=<id>`

Lists direct child folders. Omit `parentId` (or use `root`) for root folders. A supplied parent must belong to the authenticated user.

`POST /api/vault/folders`

JSON body: `{ "name": "Receipts", "parentId": null }`

Creates a folder at the root or beneath an owned parent. Names are trimmed, limited to 80 characters, and cannot contain path separators or control characters. Sibling names are unique, case-insensitively. Duplicate names return 409.

`PATCH /api/vault/folders/:folderId`

JSON body: `{ "name": "Tax records" }`

Renames an owned folder. Folder moves and deletion are not part of this phase.

## Files

`GET /api/vault/files?folderId=<id>&page=1&limit=25`

Lists files in the root or an owned folder. Only files with status `available` are returned. The response includes a paginated `files` array and `pagination` metadata. The maximum page size is 100. Storage object keys and staging keys are never returned.

Uploads in `pending_upload` or `quarantined` are intentionally excluded; the quarantine/scanning approval workflow is not implemented yet.

`GET /api/vault/files/:fileId/download`

Returns a short-lived (60-second) presigned R2 download URL only when the file belongs to the authenticated user and has status `available`. The URL is private and expires quickly. Files still in quarantine cannot be downloaded.

## Status and security

- Every endpoint authenticates the bearer token and checks the user's current `sessionVersion`.
- Database queries are scoped by the authenticated `userId`.
- Folder parent IDs and file folder IDs are validated against the authenticated user.
- Download links are issued only for `available` files; object keys are not exposed in API responses.
- This phase does not implement malware scanning, folder moves/deletion, file trash, or permanent deletion.
