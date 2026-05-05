# WealthPulse — Claude Code Notes

## Persistence strategy

Three-phase data-loss protection (decided May 2026):

**Phase 1 — shipped**: `navigator.storage.persist()` called on boot; `StorageStatusCard` in Settings shows persistence state + quota; stale-backup banner in Dashboard; install-as-PWA card in Settings.

**Phase 2 — shipped**: Opt-in Google Drive sync to `appDataFolder` (hidden per-app folder). Scope: `drive.appdata` only — cannot access user files. Auto-syncs after every save (5s debounce). Restore from Drive button in Settings and on empty Dashboard.

**Phase 3 — deferred**: E2E-encrypted cloud sync (Actual Budget / Bitwarden pattern). Full design in `~/.claude/projects/-Users-ravindradave-Documents-Github-NetWorthTracker/memory/project_phase3_e2e_sync.md`. Build when multi-device zero-knowledge sync is required. Uses `window.crypto.subtle` (no deps), Supabase or PocketBase as backend, passphrase → PBKDF2 → AES-GCM-256.

## Key files

- `src/utils/storagePersist.ts` — `requestPersist`, `estimateStorage`, `formatBytes`
- `src/utils/cloudSync/google/gis.ts` — GIS OAuth wrapper
- `src/utils/cloudSync/google/drive.ts` — Drive `appDataFolder` REST helpers
- `src/components/settings/CloudSyncCard.tsx` — Drive sync UI in Settings
- `src/hooks/useAutoBackup.ts` — local auto-backup tick (extended to call cloud sync)
