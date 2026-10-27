"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

/** Shows a one-time prompt when the proxy has sent someone here because they must choose a new password. */
export function PasswordChangeNotice() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const required = params.get("passwordRequired") === "1";

  useEffect(() => {
    if (!required) return;
    toast.error("Choose a new password before you go anywhere else.", { id: "password-required" });
    // Drop the flag from the address so a refresh doesn't repeat the prompt.
    router.replace(pathname);
  }, [required, router, pathname]);

  return null;
}
