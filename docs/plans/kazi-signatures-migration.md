# Signoff to Kazi Signatures migration

## Goal

Move Signoff's signature-management data, assets and operational configuration into Kazi so Kazi becomes the single product surface and the Signoff Supabase project can be retired safely.

## Shipping checklist

### 1. Migration foundation

- [x] Deploy the isolated Kazi Signatures schema and service-role access.
- [x] Import 546 source records and prove the importer is idempotent.
- [x] Copy 22 assets to Kazi R2 and verify a public Kazi asset URL.
- [x] Provision and link the 11 real Growthpad staff accounts; deactivate 10 named demo accounts while preserving the analytics administrator.
- [x] Validate copied encryption/Gmail environment configuration. No legacy Cloudflare tokens or zone IDs existed to re-encrypt; Gmail domain-wide delegation succeeds.

### 2. Product foundation

- [x] Add Kazi Signatures to the authenticated Kazi navigation and create its live overview.
- [x] Add protected read APIs for the overview and staff profiles.
- [x] Add protected read APIs for templates, assignments and domains.
- [x] Add assignment write API for HR/admin.
- [x] Add template write API with version snapshots and default-template management.
- [x] Add domain write API.
- [x] Add role rules: admins and HR can manage the module; staff can view only their own signature.

### 3. Signature operations

- [x] Build the staff and assignment workspace: search, assigned template and deployment state.
- [x] Add editable signature profile fields to the staff workspace.
- [x] Build the template workspace preview for migrated designs.
- [x] Add editable HTML/content and default-template selection.
- [x] Add version-history browsing and restore.
- [x] Add the Kazi visual builder: a dedicated full-page canvas with click/drag block insertion, reordering, merge tags, per-staff photos and email-safe export.
- [x] Extend the visual builder with a desktop/mobile responsive preview.
- [x] Add the signature media library and image uploads inside the visual builder.
- [x] Build the domain workspace: status, verification guidance and Gmail delivery readiness.
- [x] Build the campaign reporting workspace using the migrated library and tracking data.

### 4. Gmail rollout

- [x] Add Kazi’s Gmail sync service and audit deployment outcomes per staff member.
- [x] Sync and verify one approved Growthpad mailbox (`emmanuel.eshun@growthpad.net`) in Gmail. Gmail normalized the HTML but preserved staff identity and Kazi R2 assets.
- [x] Batch-sync the remaining ten approved Growthpad mailboxes, excluding the separately verified Emmanuel mailbox. All ten completed successfully.

### 5. Staff security and cutover

- [ ] Replace the shared temporary password with individual credentials or password-reset invitations before staff adoption.
- [ ] Reconcile templates, photos, assignments and tracked links in Kazi with the Growthpad team.
- [ ] Keep Signoff read-only for the agreed reconciliation window.
- [ ] Take a final external backup, revoke Signoff credentials, retire its deployment and then retire its Supabase project.

## Data ownership decisions

| Signoff data                                                       | Kazi destination                             | Migration rule                                                                                                                                      |
| ------------------------------------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`, `sessions`, `magic_tokens`                                | Kazi `users` and NextAuth                    | Do not copy sessions or tokens. Match admins by normalised email; reuse a compatible password hash only after review.                               |
| `staff`                                                            | `signature_staff_profiles` plus Kazi `users` | Match by normalised email. Preserve unmatched mailboxes as profiles with `user_id = null`; invite them later instead of creating unknown passwords. |
| `departments`                                                      | Kazi `departments`                           | Merge case-insensitively and keep Kazi as the canonical list.                                                                                       |
| Domains, templates, versions, assignments, campaigns and analytics | `signature_*` tables                         | Preserve IDs during import so every relationship remains intact.                                                                                    |
| `signature-assets` storage                                         | Kazi R2                                      | Copy objects, rewrite every media URL in templates/campaigns/media records, then validate rendered HTML.                                            |
| Cloudflare tokens and Gmail configuration                          | Kazi secrets/configuration                   | Re-encrypt domain tokens with a Kazi-owned key. Never copy opaque encrypted values because Signoff's key cannot decrypt them in Kazi.               |

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
