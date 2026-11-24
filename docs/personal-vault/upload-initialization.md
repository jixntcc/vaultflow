# Personal Vault — Upload Initialization (OS4.2)

## Endpoint

`POST /api/vault/uploads`

Requires the existing VaultFlow Bearer JWT. The handler verifies the token issuer, audience, subject, user existence, and current `sessionVersion` against the `users` collection.

All responses include `Cache-Control: no-store`.

## Request

JSON body:

```json
{
  "originalName": "receipt.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 245760,
  "folderId": null
}
```

- `originalName`: 1–255 characters; path separators and control characters are rejected.
- `mimeType`: must be in the server allowlist.
- `sizeBytes`: positive safe integer; maximum 104,857,600 bytes (100 MiB).
- `folderId`: optional MongoDB ObjectId; when supplied, it must belong to the authenticated user.

Initial MIME allowlist: PDF, JPEG, PNG, WebP, GIF, plain text, CSV, DOCX, and XLSX. The declared MIME type is metadata, not proof of file content. Upload completion must inspect the actual object before it can become available.

## Successful response

Returns HTTP 201 with:
- A server-created `fileId`.
- `pending_upload` status.
- A five-minute presigned PUT URL.
- The required `Content-Type` header.
- The file's display metadata and quota snapshot.

The browser sends the file bytes directly to R2 using the returned URL and PUT method. The R2 URL is a bearer credential: do not log it, persist it in analytics, or share it. The R2 access key and secret never leave the server.

The URL signs the expected content type and content length. The browser must upload the exact declared byte length and matching content type.

## Quota behavior

The per-user usage record is created idempotently. The unique per-user usage index is created before reservation. Reservation is a single conditional MongoDB update that succeeds only when:

`usedBytes + reservedBytes + requestedBytes <= quotaBytes`

The reservation is made before a file record and presigned URL are returned. If file creation or URL signing fails, the API removes the pending metadata (when created) and releases the reservation. Cleanup failures are logged for reconciliation; they do not cause the API to claim the reservation was released.

The initial free quota is 2 GiB. A quota failure returns HTTP 409.

## Security and lifecycle boundaries

- Object keys are random UUID-based values and do not contain user filenames or user IDs.
- A supplied folder is queried with both its ID and the authenticated owner ID.
- R2 remains private; the API does not expose bucket credentials or public object URLs.
- Only `pending_upload` metadata is created here.
- This endpoint does not mark a file `available`.
- A later completion endpoint must HEAD the object, verify exact size and expected content type, perform content-signature/scanning checks, then move the file into quarantine/available according to the security pipeline.
- Failed, expired, and abandoned uploads require a later cleanup/reconciliation job.

## Deployment notes

The API is explicitly routed in `vercel.json`. The MongoDB deployment identity must be allowed to create the declared unique and query indexes the first time the endpoint runs.

The R2 bucket CORS policy must allow the exact VaultFlow application origins, PUT, and the request headers required by the browser (at minimum `Content-Type`). Test the actual browser upload against the deployed bucket before enabling the UI.
