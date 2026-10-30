/** Google commonly returns `=s96-c` profile URLs. Request a useful source size
 * before Next.js optimizes it so large staff avatars are not blurred by upscaling. */
export function highResGoogleProfilePhoto(url: string | null | undefined) {
  if (!url || !/\.googleusercontent\.com(?:\/|$)/.test(url)) return url ?? null;
  return url.replace(/=s\d+(?:-c)?(?=(&|$))/, "=s512-c");
}
