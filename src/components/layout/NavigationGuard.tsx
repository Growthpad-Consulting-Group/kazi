"use client";

import { useEffect, useRef } from "react";
import { useUnsavedChanges } from "@/shared/contexts/UnsavedChangesContext";

/** Ported navigation safety net: protects refresh/close and browser back/forward. */
export default function NavigationGuard() {
  const state = useUnsavedChanges();
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!stateRef.current.isUnsaved) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  useEffect(() => {
    // A sentinel keeps one browser-back press on the current route so it can
    // be confirmed before Next navigates away.
    window.history.pushState(null, "", window.location.href);
    const popState = () => {
      if (!stateRef.current.isUnsaved) return;
      const leave = window.confirm(
        `${stateRef.current.message}. Leave without saving?`,
      );
      if (leave) {
        stateRef.current.reset();
        window.history.back();
      } else window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", popState);
    return () => window.removeEventListener("popstate", popState);
  }, []);

  return null;
}
