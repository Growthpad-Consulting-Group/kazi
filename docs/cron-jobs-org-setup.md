# cron-jobs.org Setup — Kazi Automations Runner

This guide explains how to schedule the Kazi automations endpoint using
[cron-jobs.org](https://cron-jobs.org) (free tier is sufficient).

---

## Endpoint details

| Field  | Value                                                  |
| ------ | ------------------------------------------------------ |
| URL    | `https://<your-kazi-domain>/api/pulse/automations/run` |
| Method | `POST`                                                 |
| Auth   | `Authorization: Bearer <your CRON_SECRET>`             |

Replace `<your-kazi-domain>` with your deployed Kazi URL (e.g. `kazi.example.com`).  
Your `CRON_SECRET` value is in `.env.local` — paste it when prompted below; never commit it.

---

## Step-by-step setup

### 1. Create a cron-jobs.org account

1. Go to <https://cron-jobs.org> and click **Sign Up**.
2. Confirm your e-mail address and log in.

### 2. Create a new cron job

1. From the dashboard, click **Create cronjob**.

### 3. Configure the URL and HTTP method

1. In the **URL** field, enter:
   ```
   https://<your-kazi-domain>/api/pulse/automations/run
   ```
2. In the **Request method** dropdown, select **POST**.

### 4. Add the Authorization header

1. Scroll to the **Request headers** (or **Advanced**) section.
2. Click **Add header** (or the `+` button).
3. Set the header name to:
   ```
   Authorization
   ```
4. Set the header value to:
   ```
   Bearer <paste your CRON_SECRET from .env.local here>
   ```

### 5. Set the schedule

Daily at 09:00 UTC is a sensible default for anniversary and campaign notifications.

- Select the **Custom** schedule option.
- Enter the following cron expression:
  ```
  0 9 * * *
  ```
  This means: minute 0, hour 9, every day, every month, every day of the week.

Adjust the time to match when you want automations to fire (use UTC).

### 6. Enable failure notifications (recommended)

1. Tick **Enable notifications** (or **Notify me on failure**).
2. Enter the e-mail address that should receive alerts when the job fails.

### 7. Save the job

1. Click **Create** (or **Save**).
2. The job now appears in your dashboard with its next scheduled run shown.

---

## Verifying the setup

- Open the job in cron-jobs.org and click **Execute now** to do a manual test run.
- Check the **Execution log** tab:
  - HTTP `200` with body `{"ok":true,"processed":<n>}` → success.
  - HTTP `401` → the Authorization header is missing or the secret value is wrong.
    Double-check the header name and value, then retry.

---

## Removing the Vercel cron (if previously set)

If `vercel.json` contains a `crons` entry for this path, remove it to avoid
duplicate runs. Do **not** rely on Vercel's built-in cron when using cron-jobs.org.
