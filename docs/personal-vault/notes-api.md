# OS4.1E — Notes editor and attachments

## API

All routes require the VaultFlow bearer token and validate the current user session. Responses use `Cache-Control: no-store`.

- `GET /api/notes?status=active&page=1&limit=25` — owner-scoped, paginated notes. Status may be active, archived, or trashed. Maximum limit is 100.
- `POST /api/notes` — create a note with title, content, category, tags, optional folderId, and attachment IDs.
- `GET /api/notes/:id` — read one owned note.
- `PATCH /api/notes/:id` — update supported fields including title, content, category, tags, pinned, folderId, attachments, and status.
- `DELETE /api/notes/:id` — move an owned note to trashed; attached files are not deleted.

## Attachment rules

An attachment must reference a VaultFile owned by the authenticated user with status `available`. Pending, quarantined, trashed, failed, deleted, unknown, or other users' files are rejected. At most 20 attachment IDs may be submitted. The API stores file IDs only; it does not expose R2 object keys or download URLs.

## Limits and lifecycle

- Title: required, 1–160 characters.
- Content: up to 100,000 characters.
- Category: up to 60 characters.
- Tags: up to 20 unique tags, 40 characters each.
- Notes list page size: 1–100.
- Notes are soft-trashed. Trashing a note never deletes attachments.
- Folder and attachment references are revalidated on create and update.
- Encryption mode remains the model's existing `provider_managed` default. This is not end-to-end encryption.

## UI

The Personal Vault page includes a Notes list and editor for title, content, category, tags, pin/unpin, and attachment selection from the first 100 available files. File upload and file verification are not part of this phase, so quarantined files cannot be attached.
