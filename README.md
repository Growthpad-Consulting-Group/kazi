# Kazi

Kazi is Growthpad’s internal people-operations suite. It combines hiring, staff records, employee pulse, performance, recognition, rewards, and Gmail signatures in one Next.js application.

## Product areas

- **Kazi Hire** — job publishing, public applications, CV processing, AI-assisted screening, candidate pipelines, and interviews.
- **Kazi Pulse** — daily logs, weekly check-ins, goals, 1-on-1s, reviews, feedback, surveys, engagement, recognition, and rewards.
- **Staff** — staff directory, profiles, roles, reporting lines, access, and development context.
- **Kazi Signatures** — signature templates, campaigns, staff assignments, domains, Gmail deployment, and link analytics.

## Stack

- Next.js 16, React 19, TypeScript, and Tailwind CSS
- Supabase for the application database and authentication-adjacent data
- Upstash Redis for cache and background screening queues
- Cloudflare R2 for CV storage
- Google Calendar, Asana, Gmail, Slack, Resend, Groq, and reCAPTCHA integrations

## Local development

Requirements: Node.js 22+, pnpm 10, and the Supabase CLI for schema changes.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
pnpm seed:admin
```

`pnpm build` uses Turbopack. If local compilation is affected by a Turbopack issue, use `pnpm build -- --webpack` to isolate it; do not change the production build command without verifying the deployment platform.

## Environment configuration

Set the required values in `.env.local`. Never commit this file or any credential.

| Area                  | Variables                                                                                                                                                                                                                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core                  | `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`                                                                                                                                                                                                                                                                                              |
| Supabase              | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`                                                                                                                                                                                                                                                              |
| Cache and jobs        | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`                                                                                                                                                                                                                                                                                   |
| Files                 | `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`                                                                                                                                                                                                                                                |
| Email                 | `RESEND_API_KEY`, `EMAIL_FROM`                                                                                                                                                                                                                                                                                                                        |
| AI                    | `GROQ_API_KEY`, optional `GROQ_MODEL`, `AI_PROVIDER`                                                                                                                                                                                                                                                                                                  |
| CAPTCHA               | `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`                                                                                                                                                                                                                                                                                              |
| Google                | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY`, optional `GOOGLE_APPLICATION_CREDENTIALS` for JobPosting indexing. Add both `${NEXTAUTH_URL}/api/auth/callback/google` (work-account sign-in) and `GOOGLE_REDIRECT_URI` (Settings connection) as authorised redirect URIs in Google Cloud. |
| Asana                 | `ASANA_CLIENT_ID`, `ASANA_CLIENT_SECRET`, `ASANA_REDIRECT_URI`, `ASANA_TOKEN_ENCRYPTION_KEY`                                                                                                                                                                                                                                                          |
| Slack                 | `SLACK_BOT_TOKEN`, `SLACK_WEBHOOK_URL`                                                                                                                                                                                                                                                                                                                |
| Optional integrations | `GIPHY_API_KEY`, `CAREERS_REVALIDATE_SECRET`, `CAREERS_REVALIDATE_URL`                                                                                                                                                                                                                                                                                |

## Database and seed data

Migrations live in [`supabase/migrations`](supabase/migrations). Apply the linked database changes with:

```bash
pnpm exec dotenv run -f .env.local -- pnpm dlx supabase db push --remote
```

Confirm that local and linked migrations match:

```bash
pnpm exec dotenv run -f .env.local -- pnpm dlx supabase migration list --linked
```

Use the dedicated seed script only when intentionally resetting or preparing demo access:

```bash
pnpm seed:admin
```

## Scheduled work

GitHub Actions invokes authenticated routes using `APP_URL` and `CRON_SECRET`:

| Workflow            | Cadence          | Purpose                                                              |
| ------------------- | ---------------- | -------------------------------------------------------------------- |
| Screening Worker    | Every 5 minutes  | Parses uploaded CVs and performs queued AI screening.                |
| Signature Retry     | Every 15 minutes | Retries eligible failed Gmail signature syncs.                       |
| Review Reminders    | Daily            | Sends outstanding review reminders.                                  |
| AI Log Retention    | Monthly          | Removes expired, privacy-reduced AI audit logs in batches.           |
| Google Job Indexing | Hourly           | Notifies Google when scheduled job postings become public or expire. |

The retention endpoint supports a safe verification call:

```text
GET /api/admin/retention/ai-logs?dryRun=1
Authorization: Bearer <CRON_SECRET>
```

Set `AI_LOG_RETENTION_DAYS` to a whole number from 30 to 3650 to override the default 90-day retention period.

## Deployment

Kazi is deployed to Vercel. Configure production variables there, including `CRON_SECRET`, Supabase, Redis, R2, email, AI, CAPTCHA, integration credentials.

Use one deployment path per environment; production runs on Vercel.

## Project conventions

- Read [`AGENTS.md`](AGENTS.md) before changing the application.
- Reuse existing UI components and tokens before introducing a new pattern.
- Keep access checks in server actions and API routes; proxy checks are only an optimistic navigation layer.
- Do not log raw CVs, candidate prompts, generated correspondence, credentials, or tokens.
- Add focused tests for shared logic and run lint, TypeScript, and relevant tests before handing work over.

## Further documentation

- [Asana check-in import](docs/asana-checkin-import.md)
- [Cron and organization setup](docs/cron-jobs-org-setup.md)
- [Kazi Signatures migration plan](docs/plans/kazi-signatures-migration.md)
- [Kazi suite integration plan](docs/plans/kazi-suite-integration.md)
