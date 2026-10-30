"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { signOut, useSession } from "next-auth/react";
import { useAvatar } from "@/shared/hooks/useAvatar";
import { navigationForRole, sidebarNavGroups } from "@/lib/nav";
import { useTheme } from "@/shared/contexts/ThemeContext";
import { useUnsavedChanges } from "@/shared/contexts/UnsavedChangesContext";

export default function KaziSidebar({
  isOpen,
  toggleSidebar,
}: {
  isOpen: boolean;
  toggleSidebar: () => void;
}) {
  const { resolvedMode: mode } = useTheme();
  const { data: session } = useSession();
  const avatarUrl = useAvatar();
  const [windowWidth, setWindowWidth] = useState<number | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { confirmNavigation } = useUnsavedChanges();

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sidebarNavGroups.map((g) => [g.category, true])),
  );

  useEffect(() => {
    const handle = () => setWindowWidth(window.innerWidth);
    handle();
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (
        isOpen &&
        windowWidth !== null &&
        windowWidth < 640 &&
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        toggleSidebar();
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [isOpen, windowWidth, toggleSidebar]);

  const toggleCat = useCallback((cat: string) => {
    setExpanded((p) => ({ ...p, [cat]: !p[cat] }));
  }, []);

  if (windowWidth === null) return null;

  const isMobile = windowWidth < 640;
  const isActive = (href: string) =>
    ["/dashboard", "/pulse", "/signatures"].includes(href)
      ? pathname === href
      : pathname.startsWith(href);
  const navGroups = navigationForRole(session?.user?.allowedPaths ?? []);
  const guardedPush = (href: string) => {
    if (!confirmNavigation()) return;
    router.push(href);
  };

  return (
    <div
      ref={sidebarRef}
      className={`shrink-0 z-50 transition-all duration-300 ${isMobile ? `fixed inset-y-0 left-0 m-0 overflow-hidden ${isOpen ? "" : "pointer-events-none"}` : `sticky top-0 h-screen p-1 ${isOpen ? "md:py-4 md:pl-4" : "md:p-1"}`}`}
      style={{ width: isOpen ? "240px" : isMobile ? "0" : "64px" }}
    >
      <div
        className={`relative h-full flex flex-col border transition-all duration-300 ${isMobile ? "rounded-none" : "rounded-3xl"} ${
          mode === "dark"
            ? "bg-[#131417]/80 backdrop-blur-2xl border-white/5 text-gray-100 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]"
            : "bg-white/70 backdrop-blur-2xl border-white/20 text-gray-800 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]"
        }`}
      >
        {/* Logo */}
        <div
          className={`flex items-center shrink-0 border-b border-white/10 dark:border-white/5 ${isOpen ? "min-h-[72px] px-6 py-3 justify-between" : "h-[72px] px-0 justify-center"}`}
        >
          {isOpen ? (
            <div className="flex flex-col">
              <Link
                href="/dashboard"
                title="Dashboard"
                onClick={(event) => {
                  if (confirmNavigation()) return;
                  event.preventDefault();
                }}
              >
                <Image
                  src={
                    mode === "dark"
                      ? "/assets/images/logo-white.svg"
                      : "/assets/images/logo.svg"
                  }
                  alt="Growthpad Kazi"
                  width={150}
                  height={48}
                  priority
                  style={{ height: "auto" }}
                  className="w-[140px] object-contain hover:opacity-80 transition-opacity"
                />
              </Link>
              <div className="mt-2 flex items-center gap-2">
                <p
                  className={`text-sm font-bold tracking-[0.2em] ${mode === "dark" ? "text-white" : "text-gray-900"}`}
                >
                  KAZI
                </p>
                <p className="text-[9px] tracking-[0.12em] text-gray-500">
                  STAFF ENGAGEMENT WORKSPACE
                </p>
              </div>
            </div>
          ) : (
            <Link
              href="/dashboard"
              title="Dashboard"
              onClick={(event) => {
                if (confirmNavigation()) return;
                event.preventDefault();
              }}
            >
              <Image
                src={mode === "dark" ? "/favicon-white.png" : "/favicon.png"}
                alt="Growthpad"
                width={40}
                height={40}
                className="object-contain mx-auto hover:opacity-80 transition-opacity"
              />
            </Link>
          )}
          {isMobile && (
            <button
              onClick={toggleSidebar}
              className="text-gray-500 dark:text-gray-400 hover:text-brand-500 transition-all p-2 rounded-full hover:bg-white/10"
            >
              <Icon icon="solar:close-circle-broken" className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-1 scrollbar-hide">
          {navGroups.map((group, gi) => (
            <div
              key={group.category}
              className={`w-full ${gi > 0 ? "pt-4" : ""} ${!isOpen ? "flex flex-col items-center" : ""}`}
            >
              {isOpen ? (
                <div
                  className="flex items-center justify-between px-3 py-2 cursor-pointer group transition-all duration-200"
                  onClick={() => toggleCat(group.category)}
                >
                  <span className="text-xs font-semibold uppercase text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                    {group.category}
                  </span>
                  <Icon
                    icon="solar:alt-arrow-right-broken"
                    className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${expanded[group.category] ? "rotate-90" : ""}`}
                  />
                </div>
              ) : (
                <div
                  className="flex items-center justify-center py-2 cursor-pointer group"
                  onClick={() => !isMobile && toggleSidebar()}
                  title={group.category}
                >
                  <Icon
                    icon={group.icon}
                    className="h-5 w-5 text-gray-400 group-hover:text-brand-500 transition-colors"
                  />
                </div>
              )}

              <AnimatePresence initial={false}>
                {expanded[group.category] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <ul
                      className={`${isOpen ? "pl-2" : "pl-0"} mt-1 flex flex-col gap-1`}
                    >
                      {group.items.map(({ href, icon, label }, idx) => {
                        const active = isActive(href);
                        return (
                          <motion.li
                            key={href}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              duration: 0.2,
                              delay: idx * 0.03,
                              ease: "easeOut",
                            }}
                          >
                            <motion.div
                              onClick={() => {
                                guardedPush(href);
                                if (isMobile) toggleSidebar();
                              }}
                              onMouseEnter={() => {
                                if (!isOpen && !isMobile) toggleSidebar();
                              }}
                              title={!isOpen ? label : undefined}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all duration-300 ${
                                active
                                  ? "bg-brand-500/10 text-brand-500"
                                  : mode === "dark"
                                    ? "text-gray-400 hover:bg-white/5 hover:text-white"
                                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                              } ${!isOpen ? "justify-center" : ""}`}
                            >
                              {active && (
                                <div className="absolute left-0 w-1 h-1/2 bg-brand-500 rounded-r-full" />
                              )}
                              <Icon
                                icon={icon}
                                className={`h-4 w-4 shrink-0 transition-all duration-300 ${active ? "scale-105" : "group-hover:scale-110"}`}
                              />
                              {isOpen && (
                                <span className="flex-1 truncate">{label}</span>
                              )}
                            </motion.div>
                          </motion.li>
                        );
                      })}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </nav>

        {isOpen && (
          <div
            className={`px-4 pb-2 font-mono text-[10px] ${mode === "dark" ? "text-gray-500" : "text-gray-400"}`}
          >
            press{" "}
            <kbd
              className={`rounded border px-1 py-0.5 ${mode === "dark" ? "border-white/10" : "border-gray-200"}`}
            >
              ⌘K
            </kbd>{" "}
            to search
          </div>
        )}

        {/* User menu */}
        {!(isMobile && !isOpen) && (
          <div className={`${isOpen ? "px-3" : "px-1"} py-4 mt-auto`}>
            <div
              onClick={() => setShowUserMenu((p) => !p)}
              className={`flex items-center space-x-3 cursor-pointer rounded-xl transition-all duration-300 border-t border-brand-500 ${isOpen ? "p-2.5" : "justify-center p-1"} ${
                mode === "dark"
                  ? "hover:bg-white/5 text-gray-300 hover:text-white"
                  : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"
              }`}
            >
              <div className="shrink-0 w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-gray-800 border border-white/20">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={session?.user?.name ?? ""}
                    width={32}
                    height={32}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold text-brand-500">
                    {session?.user?.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("") ?? "?"}
                  </span>
                )}
              </div>
              {isOpen && (
                <div className="flex items-center justify-between w-full min-w-0">
                  <div className="flex flex-col min-w-0">
                    <span
                      className={`text-sm font-semibold truncate ${mode === "dark" ? "text-white" : "text-gray-900"}`}
                    >
                      {session?.user?.name ?? "—"}
                    </span>
                    <span className="text-[11px] text-gray-400 truncate capitalize">
                      {session?.user?.role ?? ""}
                    </span>
                  </div>
                  <Icon
                    icon="solar:alt-arrow-right-broken"
                    className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-300 ${showUserMenu ? "rotate-90" : ""}`}
                  />
                </div>
              )}
            </div>

            <div
              className={`transition-all duration-300 overflow-hidden ${showUserMenu ? "max-h-40 opacity-100 mt-2" : "max-h-0 opacity-0"}`}
            >
              <div className="flex flex-col gap-1 p-1">
                <div className="my-1 h-px bg-white/10 dark:bg-white/5" />
                <button
                  onClick={() => {
                    if (confirmNavigation()) signOut({ callbackUrl: "/login" });
                  }}
                  className="flex items-center gap-3 w-full p-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-red-500 hover:bg-red-500/10"
                >
                  <Icon icon="solar:logout-broken" className="h-5 w-5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
