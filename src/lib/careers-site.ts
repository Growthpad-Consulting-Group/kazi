export async function notifyCareersSiteJobsChanged(): Promise<void> {
  const url = process.env.CAREERS_REVALIDATE_URL;
  const secret = process.env.CAREERS_REVALIDATE_SECRET;
  if (!url || !secret) return;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    if (!response.ok)
      console.error("Careers site revalidation failed", response.status);
  } catch (error) {
    console.error("Careers site revalidation error", error);
  }
}
