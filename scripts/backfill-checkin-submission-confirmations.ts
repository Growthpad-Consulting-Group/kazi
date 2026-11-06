import { backfillCheckinSubmissionConfirmations } from "../src/lib/slack";

async function main() {
  const counts = await backfillCheckinSubmissionConfirmations();
  console.info("Weekly check-in Slack confirmation backfill:", counts);
}

main().catch((error) => {
  console.error(
    "Weekly check-in Slack confirmation backfill failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
