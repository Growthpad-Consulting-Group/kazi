"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export interface PageHeaderAction {
  label: string;
  icon?: string;
  variant?: "primary" | "secondary";
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

export interface PageHeaderConfig {
  title: string;
  description?: string;
  icon?: string;
  actions?: PageHeaderAction[];
  content?: ReactNode;
}

const ReadCtx = createContext<PageHeaderConfig | null>(null);
const WriteCtx = createContext<(c: PageHeaderConfig | null) => void>(() => {});

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [cfg, setCfg] = useState<PageHeaderConfig | null>(null);
  return (
    <WriteCtx.Provider value={setCfg}>
      <ReadCtx.Provider value={cfg}>{children}</ReadCtx.Provider>
    </WriteCtx.Provider>
  );
}

export function usePageHeaderValue() {
  return useContext(ReadCtx);
}

export function usePageHeader(config: PageHeaderConfig | null) {
  const set = useContext(WriteCtx);
  useEffect(() => {
    set(config);
  });
  useEffect(() => () => set(null), []); // eslint-disable-line react-hooks/exhaustive-deps
}
