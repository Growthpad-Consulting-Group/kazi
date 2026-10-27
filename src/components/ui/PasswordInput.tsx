"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Icon } from "@iconify/react";

/** A password field with a control to show or hide what's typed. Takes the same props as an input. */
export function PasswordInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${className ?? ""} pr-10`} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--text-lo)] transition-colors hover:text-[var(--text-hi)]"
      >
        <Icon icon={visible ? "solar:eye-closed-broken" : "solar:eye-broken"} className="h-4 w-4" />
      </button>
    </div>
  );
}
