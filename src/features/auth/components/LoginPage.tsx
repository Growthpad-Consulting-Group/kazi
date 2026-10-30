"use client";

import { useState, useEffect, useRef } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import Image from "next/image";
import toast from "react-hot-toast";
import ReCAPTCHA from "react-google-recaptcha";
import { startAuthentication } from "@simplewebauthn/browser";
import { SimpleModal } from "@/components/ui/SimpleModal";

const SUPPORT_EMAIL = "njue.duncan@growthpad.net";

export default function LoginPage({
  googleWorkspaceLoginEnabled,
}: {
  googleWorkspaceLoginEnabled: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [signInHelpOpen, setSignInHelpOpen] = useState(false);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  useEffect(() => {
    const saved = localStorage.getItem("kazi_remembered_email");
    if (!saved) return;
    const frame = requestAnimationFrame(() => {
      setEmail(saved);
      setRememberMe(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    let recaptchaToken: string;
    try {
      const token = await recaptchaRef.current?.executeAsync();
      if (!token)
        throw new Error("CAPTCHA verification failed. Please try again.");
      recaptchaToken = token;
      recaptchaRef.current?.reset();
    } catch {
      setLoading(false);
      toast.error("CAPTCHA verification failed. Please try again.", {
        icon: "⚠️",
      });
      return;
    }

    const loadingToast = toast.loading("Signing in…");
    try {
      const res = await signIn("credentials", {
        email,
        password,
        recaptchaToken,
        redirect: false,
      });
      if (res?.error) throw new Error("Invalid email or password.");
      if (rememberMe) localStorage.setItem("kazi_remembered_email", email);
      else localStorage.removeItem("kazi_remembered_email");
      const session = await getSession();
      const firstName = session?.user?.name?.split(" ")[0];
      toast.success(
        firstName ? `Welcome back, ${firstName}!` : "Welcome back!",
        { id: loadingToast, icon: "✅" },
      );
      const role = session?.user?.role;
      router.push(role === "employee" ? "/pulse" : "/dashboard");
    } catch (err: unknown) {
      toast.error((err as Error).message, { id: loadingToast, icon: "❌" });
      recaptchaRef.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/" });
  }

  async function handlePasskeySignIn() {
    setPasskeyLoading(true);
    try {
      const options = await fetch("/api/auth/passkeys/authenticate/options", {
        method: "POST",
      }).then(async (res) => {
        const body = await res.json();
        if (!res.ok)
          throw new Error(body.error ?? "Could not start passkey sign-in.");
        return body;
      });
      const response = await startAuthentication({ optionsJSON: options });
      const result = await signIn("passkey", {
        response: JSON.stringify(response),
        redirect: false,
      });
      if (result?.error)
        throw new Error(
          "Passkey was not recognised. Try Google or your password.",
        );
      const session = await getSession();
      router.push(session?.user?.role === "employee" ? "/pulse" : "/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Passkey sign-in failed.",
      );
    } finally {
      setPasskeyLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f8f6f2]">
      {/* ── Left — sign-in ──────────────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex flex-col px-6 sm:px-12 lg:px-20 py-10">
        <Image
          src="/kazi-logo.svg"
          alt="Kazi"
          width={460}
          height={68}
          priority
          className="mb-8 h-auto w-full max-w-[460px]"
        />

        <div className="flex flex-1 items-center">
          <div className="w-full max-w-md">
            <div className="flex items-center gap-3">
              <span className="h-1 w-8 bg-brand-500" aria-hidden />
              <p className="text-[11px] font-semibold tracking-[0.15em] text-brand-500">
                YOUR GROWTHPAD WORKSPACE
              </p>
            </div>
            <h1 className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-[#231812]">
              Welcome back.
            </h1>
            <p className="mt-3 text-gray-500">
              Sign in to continue to your Kazi workspace.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="work-email"
                  className="block text-sm font-medium text-[#231812] mb-1.5"
                >
                  Work email
                </label>
                <input
                  id="work-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@growthpad.net"
                  autoComplete="email"
                  required
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-[#231812] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-[#231812] mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="w-full pl-4 pr-11 py-3 bg-white border border-gray-200 rounded-xl text-[#231812] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-500 transition-colors"
                  >
                    <Icon
                      icon={
                        showPassword
                          ? "solar:eye-closed-broken"
                          : "solar:eye-broken"
                      }
                      className="h-5 w-5"
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-[#231812] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 bg-white accent-brand-500 cursor-pointer"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => setSignInHelpOpen(true)}
                  className="font-medium text-brand-500 transition-colors hover:text-brand-600"
                >
                  Need help signing in?
                </button>
              </div>

              {/* Invisible reCAPTCHA — executes programmatically on submit */}
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY as string}
                size="invisible"
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl shadow-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                {loading ? (
                  <>
                    <Icon
                      icon="solar:wheel-angle-broken"
                      className="h-5 w-5 animate-spin"
                    />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in to Kazi
                    <Icon icon="solar:arrow-right-broken" className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>

            {googleWorkspaceLoginEnabled && (
              <>
                <div className="my-5 flex items-center gap-3 text-xs font-medium text-gray-400">
                  <span className="h-px flex-1 bg-gray-200" />
                  passwordless sign-in
                  <span className="h-px flex-1 bg-gray-200" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handlePasskeySignIn}
                    disabled={loading || googleLoading || passkeyLoading}
                    className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-[#231812] shadow-sm transition-colors hover:border-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon
                      icon={
                        passkeyLoading
                          ? "solar:wheel-angle-broken"
                          : "solar:shield-keyhole-broken"
                      }
                      className={`h-5 w-5 shrink-0 text-brand-500 ${passkeyLoading ? "animate-spin" : ""}`}
                    />
                    {passkeyLoading ? "Checking…" : "Use passkey"}
                  </button>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading || passkeyLoading || googleLoading}
                    className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-[#231812] shadow-sm transition-colors hover:border-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {googleLoading ? (
                      <Icon
                        icon="solar:wheel-angle-broken"
                        className="h-5 w-5 animate-spin text-brand-500"
                      />
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0"
                      >
                        <path
                          fill="#4285F4"
                          d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.23a4.47 4.47 0 0 1-1.94 2.93v2.79h3.14c1.84-1.69 2.92-4.18 2.92-7.75Z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 21.75c2.62 0 4.82-.87 6.43-2.35l-3.14-2.79c-.87.58-1.99.92-3.29.92-2.53 0-4.67-1.71-5.44-4.01H3.32v2.88A9.75 9.75 0 0 0 12 21.75Z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M6.56 13.52A5.87 5.87 0 0 1 6.25 12c0-.53.1-1.04.31-1.52V7.6H3.32A9.75 9.75 0 0 0 2.25 12c0 1.58.38 3.08 1.07 4.4l3.24-2.88Z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 6.47c1.43 0 2.72.49 3.73 1.45l2.8-2.8C16.82 3.53 14.62 2.25 12 2.25A9.75 9.75 0 0 0 3.32 7.6l3.24 2.88C7.33 8.18 9.47 6.47 12 6.47Z"
                        />
                      </svg>
                    )}
                    {googleLoading ? "Opening…" : "Use work account"}
                  </button>
                </div>
                <p className="mt-2 text-center text-xs leading-5 text-gray-500">
                  Your verified work account is connected for Calendar and
                  shared Google Docs.
                </p>
              </>
            )}

            <div className="mt-6 border-t border-gray-200 pt-5 flex items-center justify-between gap-4 text-sm text-gray-500">
              <p>Access is managed by Growthpad.</p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-medium text-brand-500 hover:text-brand-600 text-md transition-colors"
              >
                Contact administrator
              </a>
            </div>
          </div>
        </div>

        <div className="max-w-md w-full">
          <p className="mt-8 text-xs text-gray-400">
            © {new Date().getFullYear()} Growthpad Consulting Group
          </p>
        </div>
      </div>

      {/* ── Right — image ───────────────────────────────────────────────── */}
      <div className="hidden lg:block relative w-1/2 min-h-screen">
        <Image
          src="/assets/images/login-hero.png"
          alt="Growthpad team collaborating at a shared table"
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
      </div>

      <SimpleModal
        open={signInHelpOpen}
        onClose={() => setSignInHelpOpen(false)}
        title="Need help signing in?"
        icon="solar:question-circle-broken"
        maxWidth="max-w-md"
      >
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-[var(--text-lo)]">
            Try these quick checks before contacting your administrator.
          </p>
          <ol className="space-y-3 text-sm text-[var(--text-hi)]">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-xs font-bold text-brand-500">
                1
              </span>
              <span>Use your Growthpad work email address.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-xs font-bold text-brand-500">
                2
              </span>
              <span>
                Check that Caps Lock is off and try your password again.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-xs font-bold text-brand-500">
                3
              </span>
              <span>
                If you still cannot sign in, ask your administrator to confirm
                your access or reset your password.
              </span>
            </li>
          </ol>
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={() => setSignInHelpOpen(false)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-hi)] transition-colors hover:bg-[var(--surface-2)]"
            >
              Close
            </button>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Kazi%20sign-in%20help`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
            >
              <Icon icon="solar:letter-broken" className="h-3.5 w-3.5" />
              Contact administrator
            </a>
          </div>
        </div>
      </SimpleModal>
    </div>
  );
}
