import { requestIp } from "@/lib/rate-limit";

type RecaptchaResponse = { success?: boolean };

/** Verify the browser's CAPTCHA token with Google; tokens are never trusted client-side. */
export async function verifyRecaptcha(token: string | undefined, headers: Headers) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret || !token) return false;

  try {
    const payload = new URLSearchParams({ secret, response: token, remoteip: requestIp(headers) });
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload,
    });
    const result = await response.json().catch(() => null) as RecaptchaResponse | null;
    return response.ok && result?.success === true;
  } catch (error) {
    console.error("reCAPTCHA verification failed", error);
    return false;
  }
}
