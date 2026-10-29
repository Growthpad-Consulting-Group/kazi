"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { hasViewGrant } from "@/lib/rbac";
import { isAdminScreenPath } from "@/lib/page-access";

/**
 * True when write controls should be hidden: the person is an employee with the read-only grant,
 * and the screen is an admin screen. Employees keep their own controls everywhere else, and the
 * server still refuses any write.
 */
export function useIsViewOnly(): boolean {
  const { data } = useSession();
  const pathname = usePathname();
  const user = data?.user;
  return Boolean(
    user &&
    user.role === "employee" &&
    hasViewGrant(user) &&
    isAdminScreenPath(pathname),
  );
}
