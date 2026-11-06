# ViralMint AI — Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict Ownership Isolation**: Every document in `/jobs/{jobId}`, `/clips/{clipId}`, `/activity_logs/{eventId}`, and `/user_settings/{userId}` belongs exclusively to `ownerId == request.auth.uid` with `request.auth.token.email_verified == true`.
2. **Unlisted Upload Enforcement**: Every `ClipRecord` in `/clips/{clipId}` MUST enforce `privacyStatus == 'unlisted'`. Public auto-publishing is strictly forbidden at the database rule level.
3. **Path Variable Hardening**: Every single-document ID (`jobId`, `clipId`, `eventId`, `userId`) must satisfy `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
4. **Temporal & Identity Immutability**: `ownerId` and `createdAt` are immutable across all updates; `createdAt` and `updatedAt` must match `request.time`.
5. **Query Enforcer on Lists**: Every `allow list` rule enforces `resource.data.ownerId == request.auth.uid`.

## 2. The "Dirty Dozen" Payloads
1. **Shadow Field Injection on Job Create**: Payload includes `isSuperAdmin: true` not in `hasOnly` allowlist -> `PERMISSION_DENIED`.
2. **Public Privacy Status Bypass on Clip Create**: `privacyStatus: "public"` instead of `"unlisted"` -> `PERMISSION_DENIED`.
3. **Cross-Tenant Owner Spoofing**: Authenticated user `uid_A` creates job with `ownerId: "uid_B"` -> `PERMISSION_DENIED`.
4. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts to create a job -> `PERMISSION_DENIED`.
5. **Path ID Poisoning**: Document ID with 300 chars or special characters `job/../admin` -> `PERMISSION_DENIED`.
6. **Oversized String Denial-of-Wallet**: `errorDetails` string of 50,000 characters (exceeds 1000 max) -> `PERMISSION_DENIED`.
7. **Immortal Field Mutation**: Updating `createdAt` or `ownerId` on an existing `/jobs/{jobId}` document -> `PERMISSION_DENIED`.
8. **Forged Client Timestamp**: Creating a job with a past/future `createdAt` not equal to `request.time` -> `PERMISSION_DENIED`.
9. **Unauthorized List Scraping**: Listing `/jobs` without filtering by `ownerId == request.auth.uid` -> `PERMISSION_DENIED`.
10. **Terminal State Mutation**: Attempting to mutate a `cancelled` job's `sourceVideoId` -> `PERMISSION_DENIED`.
11. **Value Poisoning on Update**: Updating `progress` on `/jobs/{jobId}` with a string `"100%"` instead of a number `0..100` -> `PERMISSION_DENIED`.
12. **Cross-User Settings Read**: User `uid_A` attempting `get` on `/user_settings/uid_B` -> `PERMISSION_DENIED`.
