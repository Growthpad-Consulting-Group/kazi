# Asana completed-task import

Kazi lets each employee connect their own Asana account, then select assigned tasks they completed during the current check-in week. Selected tasks are inserted into **Wins & accomplishments** as editable bullet points.

## Setup

1. Create an OAuth app in Asana's developer console.
2. Register this redirect URI:

   ```text
   https://your-kazi-domain.com/api/integrations/asana/callback
   ```

   For local development, use the same callback URL on your local application origin.
3. Apply `supabase/migrations/008_asana_checkin_import.sql`.
4. Set these server-side environment variables:

   ```bash
   ASANA_CLIENT_ID=...
   ASANA_CLIENT_SECRET=...
   ASANA_REDIRECT_URI=https://your-kazi-domain.com/api/integrations/asana/callback
   ASANA_TOKEN_ENCRYPTION_KEY=...
   ```

   Generate the encryption key with `openssl rand -base64 32`. Keep it stable: changing it prevents Kazi from decrypting existing connections.

## Permissions and behaviour

The connection requests read-only access to tasks, projects, users, and workspaces. Kazi searches the connected employee's assigned tasks that were completed within the selected weekly check-in period; it does not create, edit, or complete Asana tasks.

Asana's workspace task-search endpoint may require a paid Asana tier. If the connected workspace does not include that capability, the employee will see Asana's returned access error and can still complete their check-in manually.

