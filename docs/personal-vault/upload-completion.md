# Personal Vault — Upload Completion (OS4.3)

## Endpoint

`POST /api/vault/uploads/:fileId/complete`

Requires the existing VaultFlow Bearer JWT. The handler validates the JWT and current user session, then loads the file by both `fileId` and authenticated `userId`. The request body is not used to determine the object key, size, MIME type, or ownership.

## Upload flow

1. OS4.2 creates a metadata record in `pending_upload`, reserves quota, and returns a five-minute presigned PUT URL.
2. The browser uploads directly to the private R2 bucket using the staging key and the signed headers.
3. The browser calls the completion endpoint.
4. The server uses R2 `HeadObject` to inspect the staging object. It requires the exact declared byte length and exact expected content type.
5. The server promotes the verified staging object to a separate, opaque final object key. The copy is conditional on the source ETag so a concurrent overwrite of the staging object cannot silently change the bytes selected for promotion.
6. The server HEAD-checks the final object, then uses a MongoDB transaction to change the file from `pending_upload` to `quarantined` and atomically convert the quota reservation into used storage.
7. The staging object is deleted after the database transaction. A failed staging cleanup is logged and reported as `stagingCleanupPending`; it does not make the final object public.

## Why staging and final keys are separate

A presigned PUT URL is a bearer credential and can be reused until it expires. The browser only receives permission to write to `vault-staging/<random-id>`. The final `vault/<random-id>` key is never included in the browser response and is populated only by the server-side copy. Reusing an unexpired URL therefore cannot overwrite the finalized file.

The file model stores both keys as immutable values. The final key is the canonical object key for later read, download, trash, and delete operations. The staging key exists only to receive the upload and should be removed after completion or by a reconciliation job if cleanup fails.

## Responses

- `200`: verified file is now `quarantined`; repeated completion calls are idempotent.
- `404`: no file exists for this ID and authenticated user.
- `409`: object has not arrived yet, or the file is not in a completable state.
- `422`: actual object size or content type differs from the declared metadata; the pending record is failed and its reservation is released transactionally.
- `5xx`: storage or database verification could not be completed. The endpoint does not claim success.

## Quota and security

- On success, one MongoDB transaction updates file status and moves `sizeBytes` from `reservedBytes` to `usedBytes`.
- Concurrent/repeated completion requests cannot increment used storage twice because only a `pending_upload` record can perform the transition.
- Ownership is enforced on every metadata query.
- R2 remains private. No public object URL or R2 credentials are returned.
- The completion endpoint never marks a file `available`. Quarantined files remain unavailable until a future content-signature and malware-scanning pipeline explicitly clears them.
- R2 copy operations use source ETag matching. R2 documents support for `CopyObject` and `x-amz-copy-source-if-match`. See Cloudflare's [S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/) and [conditional operations](https://developers.cloudflare.com/r2/api/s3/conditional-operations/).

## Operational requirement

MongoDB transactions require a replica set or sharded cluster. The intended MongoDB Atlas deployment satisfies this requirement; a standalone local MongoDB server will not. Validate the completion endpoint against the deployed Atlas and R2 environment before enabling the browser UI.
