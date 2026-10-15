## Rapidpro Shared Data - Access Code

Callable function to generate a unique access code for a shared parent group, used by parents to join the group via `groupJoin`.

Codes are generated server-side as app users cannot query other users' `shared_data` docs to check for conflicts. Each candidate code is checked against existing `shared_data` docs, retrying up to 10 times before returning an error.

Requests are validated using AppCheck, and the calling user must be the owner (`_created_by`) of the `shared_data` doc.

### Usage

Request: `{ shared_id: string }`

Response: `{ access_code: string }`

Errors (`HttpsError` codes): `unauthenticated`, `invalid-argument`, `not-found`, `permission-denied`, `resource-exhausted`

### Deploy

Deploy to the same firebase project as `groupJoin` (i.e. the facilitator app project)

```bash
firebase deploy --only functions:generateAccessCode
```
