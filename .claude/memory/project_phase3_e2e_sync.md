# Phase 3 — E2E Encrypted Cloud Sync (Deferred)

**Status:** Deferred. Build only when multi-device zero-knowledge sync is required.
**Prerequisite:** Phase 2 (Drive sync, B1 hosted OAuth proxy) must ship first.

## Design

- Pattern: Actual Budget / Bitwarden style — passphrase-derived key, never leaves device.
- Crypto: `window.crypto.subtle` only — no third-party crypto deps.
  - Passphrase → PBKDF2 (SHA-256, 600k iterations, 16-byte salt) → 256-bit key
  - Encryption: AES-GCM-256, random 12-byte IV per payload
- Backend candidates: Supabase or PocketBase (both self-hostable; Supabase preferred for managed hosting).
- Data unit: entire snapshot JSON, encrypted as a single blob. No field-level granularity needed.
- Key derivation is per-user, per-passphrase. Server sees only ciphertext + IV + salt.

## Files to create (when building)

- `src/utils/cloudSync/encryption.ts` — PBKDF2 derive + AES-GCM encrypt/decrypt helpers
- `src/utils/cloudSync/e2eSync.ts` — upload/download/list blobs from backend
- `src/components/settings/E2ESyncCard.tsx` — UI: passphrase setup, sync status, restore
- `src/hooks/useE2ESync.ts` — auto-sync hook (mirrors `useAutoBackup` pattern)

## Key decisions already made

- No key escrow — if passphrase is lost, data is unrecoverable. Show explicit warning in UI.
- IV + salt stored alongside ciphertext in the backend row (not secret, just unique).
- Merge strategy on conflict: last-write-wins per month key (same as Drive sync Phase 2).
- Do NOT reuse Drive `appDataFolder` for E2E — separate backend so it works for users who skip GCP setup.
