# Signoff to Kazi Signatures migration

## Goal

Move Signoff's signature-management data, assets and operational configuration into Kazi so Kazi becomes the single product surface and the Signoff Supabase project can be retired safely.

## Migration checkpoint — 21 October 2026

- [x] Kazi Signatures schema deployed.
- [x] Data imported and idempotency checked: 2 domains, 1 template, 52 template versions, 11 staff profiles, 11 assignments, 22 media records and 447 tracked-link clicks.
- [x] 22 storage objects copied to Kazi R2; persisted media and template URLs now resolve through Kazi storage.
- [ ] Re-encrypt any legacy domain credentials with a new `SIGNATURE_ENCRYPTION_KEY` in Kazi and verify deployment against a non-production mailbox.
- [ ] Reconcile or invite the 11 signature staff profiles. None currently have a matching Kazi user email.
- [ ] Build the Kazi Signatures user interface and server-side APIs, then complete the reconciliation window before retiring Signoff.

## Data ownership decisions

| Signoff data | Kazi destination | Migration rule |
| --- | --- | --- |
| `users`, `sessions`, `magic_tokens` | Kazi `users` and NextAuth | Do not copy sessions or tokens. Match admins by normalised email; reuse a compatible password hash only after review. |
| `staff` | `signature_staff_profiles` plus Kazi `users` | Match by normalised email. Preserve unmatched mailboxes as profiles with `user_id = null`; invite them later instead of creating unknown passwords. |
| `departments` | Kazi `departments` | Merge case-insensitively and keep Kazi as the canonical list. |
| Domains, templates, versions, assignments, campaigns and analytics | `signature_*` tables | Preserve IDs during import so every relationship remains intact. |
| `signature-assets` storage | Kazi R2 | Copy objects, rewrite every media URL in templates/campaigns/media records, then validate rendered HTML. |
| Cloudflare tokens and Gmail configuration | Kazi secrets/configuration | Re-encrypt domain tokens with a Kazi-owned key. Never copy opaque encrypted values because Signoff's key cannot decrypt them in Kazi. |

## Execution plan

1. Apply `009_kazi_signatures.sql` to the Kazi database.
2. Take a Supabase backup/export of the Signoff project and record table and storage-object counts.
3. Run `scripts/migrate-signoff.ts --dry-run`; reconcile every unmatched staff email and duplicate department before any write.
4. Use the guarded apply-mode importer after backup confirmation: `SIGNOFF_BACKUP_CONFIRMED=yes npx tsx scripts/migrate-signoff.ts --apply`. It is idempotent and preserves source IDs. It will not copy the old encrypted domain tokens.
5. Copy `signature-assets` into the Kazi R2 namespace; rewrite public URLs and validate all template HTML, campaign images and thumbnails.
6. Decrypt/re-encrypt domain secrets, move Gmail service-account configuration, and verify one non-production mailbox deployment.
7. Switch Kazi Signatures to the new tables. Keep Signoff read-only for at least one reconciliation window.
8. Compare source and target counts, sample rendered signatures, assignments, click totals and campaign status. Obtain sign-off.
9. Export a final Signoff backup, then retire its Supabase project and revoke its credentials.

## Exit criteria before retirement

- Every Signoff row has a target row or documented exclusion.
- Every asset has been copied and every stored URL resolves from Kazi-managed storage.
- Every active staff mailbox has a mapped Kazi user or an approved pending-invite profile.
- Domain and Gmail deployment checks pass in production.
- A final backup is stored outside the Signoff project and its restore procedure is tested.
