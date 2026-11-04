import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * The signed-in session for the current request. Layouts, pages and components
 * all call this, and React's cache() runs the NextAuth lookup once per request
 * instead of once per caller.
 */
export const getRequestSession = cache(() => getServerSession(authOptions));
