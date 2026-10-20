"use client";

import { useState, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import Image from "next/image";
import toast from "react-hot-toast";
import ReCAPTCHA from "react-google-recaptcha";


export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  useEffect(() => {
    const saved = localStorage.getItem("kazi_remembered_email");
    if (saved) { setEmail(saved); setRememberMe(true); }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await recaptchaRef.current?.executeAsync();
      if (!token) throw new Error("CAPTCHA verification failed. Please try again.");
      setCaptchaToken(token);
      recaptchaRef.current?.reset();
    } catch {
      setLoading(false);
      toast.error("CAPTCHA verification failed. Please try again.", { icon: "⚠️" });
      return;
    }

    const loadingToast = toast.loading("Signing in…");
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) throw new Error("Invalid email or password.");
      if (rememberMe) localStorage.setItem("kazi_remembered_email", email);
      else localStorage.removeItem("kazi_remembered_email");
      toast.success("Welcome back!", { id: loadingToast, icon: "✅" });
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error((err as Error).message, { id: loadingToast, icon: "❌" });
      setCaptchaToken(null);
      recaptchaRef.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#fdfaf5]">
      {/* ── Left panel — login form ─────────────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12">
        <div className="max-w-md w-full mx-auto">
          {/* Logo */}
          <div className="mb-8">
            <Image
              src="/logo-tagline-orange.svg"
              alt="Growthpad Consulting Group"
              width={300}
              height={0}
              className="animate-fade-in"
            />
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-[#231812] mb-2">Welcome back</h1>
          <p className="text-gray-500 mb-8">Sign in to your Kazi workspace</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-[#231812] mb-1.5">Email Address</label>
              <div className="relative flex items-center">
                <Icon icon="solar:letter-broken" className="absolute left-3 text-gray-400 h-5 w-5 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f05d23] focus:border-transparent transition-all duration-200 text-[#231812] placeholder-gray-400"
                  placeholder="you@growthpad.co.ke"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-[#231812] mb-1.5">Password</label>
              <div className="relative flex items-center">
                <Icon icon="solar:lock-password-broken" className="absolute left-3 text-gray-400 h-5 w-5 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#f05d23] focus:border-transparent transition-all duration-200 text-[#231812] placeholder-gray-400"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 text-gray-400 hover:text-[#f05d23] focus:outline-none transition-colors"
                >
                  <Icon icon={showPassword ? "solar:eye-closed-broken" : "solar:eye-broken"} className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center">
              <label className="flex items-center gap-2 text-sm text-[#231812] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#f05d23] border-gray-300"
                />
                Remember me
              </label>
            </div>

            {/* Invisible reCAPTCHA — executes programmatically on submit */}
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY as string}
              size="invisible"
            />

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#f05d23] to-[#d94f1e] text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#f05d23] focus:ring-offset-2 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loading ? (
                <><Icon icon="solar:wheel-angle-broken" className="h-5 w-5 animate-spin" />Signing in…</>
              ) : (
                <>Sign In<Icon icon="solar:arrow-right-broken" className="h-5 w-5" /></>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <span className="text-[#f05d23] font-medium">Contact your administrator.</span>
          </p>

          <div className="mt-6 flex items-center justify-center gap-4 text-sm text-gray-500">
            <a href="https://growthpad.co.ke" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-[#f05d23] transition-colors">
              <Icon icon="solar:arrow-left-broken" className="h-4 w-4" />
              Back to Home
            </a>
            <span className="text-gray-300">•</span>
            <a href="mailto:support@growthpad.co.ke" className="flex items-center gap-1 hover:text-[#f05d23] transition-colors">
              <Icon icon="solar:info-circle-broken" className="h-4 w-4" />
              Need Help?
            </a>
          </div>

          <div className="mt-6 text-center text-xs text-gray-400 space-y-1">
            <p>
              Powered by{" "}
              <a href="https://growthpad.co.ke" target="_blank" rel="noopener noreferrer" className="text-[#f05d23] font-medium hover:text-[#d94f1e] transition-colors">
                Growthpad Consulting Group
              </a>
            </p>
            <p>© {new Date().getFullYear()} Growthpad Consulting Group. All rights reserved.</p>
          </div>
        </div>
      </div>

      {/* ── Right panel — brand showcase ────────────────────────────────── */}
      <div className="hidden lg:flex w-1/2 bg-[#f4ede2] relative overflow-hidden items-center justify-center px-16">
        <div className="relative z-10 max-w-lg w-full">
          <div className="flex items-center gap-3 mb-6">
            <Image
              src="/logo.svg"
              alt="GCG"
              width={200}
              height={0}
            />
          </div>

          <span className="inline-block mb-8 px-4 py-1.5 rounded-full bg-white/70 text-sm text-[#231812] border border-[#231812]/10">
            ● Kazi · People &amp; Hiring Platform
          </span>

          <div className="grid grid-cols-2 gap-5">
            <div className="bg-white/60 rounded-2xl p-6 border border-white/50">
              <div className="h-10 w-10 rounded-xl bg-[#fdf1e7] flex items-center justify-center mb-4">
                <Icon icon="solar:user-id-broken" className="h-5 w-5 text-[#f05d23]" />
              </div>
              <h3 className="font-bold text-[#231812] mb-1">People</h3>
              <p className="text-sm text-gray-500">Manage your entire workforce in one place</p>
            </div>
            <div className="bg-white/60 rounded-2xl p-6 border border-white/50">
              <div className="h-10 w-10 rounded-xl bg-[#e9f7ee] flex items-center justify-center mb-4">
                <Icon icon="solar:case-minimalistic-broken" className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="font-bold text-[#231812] mb-1">Hiring</h3>
              <p className="text-sm text-gray-500">Post jobs and screen candidates with AI</p>
            </div>
            <div className="bg-white/60 rounded-2xl p-6 border border-white/50">
              <div className="h-10 w-10 rounded-xl bg-[#e9f0fb] flex items-center justify-center mb-4">
                <Icon icon="solar:pulse-broken" className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="font-bold text-[#231812] mb-1">Pulse</h3>
              <p className="text-sm text-gray-500">Track engagement, feedback &amp; performance</p>
            </div>
            <div className="bg-white/60 rounded-2xl p-6 border border-white/50">
              <div className="h-10 w-10 rounded-xl bg-[#fdeaea] flex items-center justify-center mb-4">
                <Icon icon="solar:shield-check-broken" className="h-5 w-5 text-red-500" />
              </div>
              <h3 className="font-bold text-[#231812] mb-1">Secure</h3>
              <p className="text-sm text-gray-500">Role-based access &amp; bank-level security</p>
            </div>
          </div>
        </div>

        {/* Subtle radial gradient overlay */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #f05d23 0, transparent 40%), radial-gradient(circle at 80% 70%, #231812 0, transparent 40%)" }}
        />
      </div>
    </div>
  );
}
