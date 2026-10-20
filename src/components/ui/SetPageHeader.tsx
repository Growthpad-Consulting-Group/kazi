"use client";

import { useRouter } from "next/navigation";
import { usePageHeader, type PageHeaderConfig } from "@/shared/contexts/PageHeaderContext";

interface ActionDef {
  label: string;
  icon?: string;
  variant?: "primary" | "secondary";
  href?: string;
  disabled?: boolean;
}

interface Props {
  title: string;
  description?: string;
  icon?: string;
  actions?: ActionDef[];
  /** Custom node rendered on the right, after any actions. */
  trailing?: React.ReactNode;
}

export default function SetPageHeader({ title, description, icon, actions, trailing }: Props) {
  const router = useRouter();

  const config: PageHeaderConfig = {
    title,
    description,
    icon,
    actions: actions?.map((a) => ({
      label: a.label,
      icon: a.icon,
      variant: a.variant,
      disabled: a.disabled,
      onClick: a.href ? () => router.push(a.href!) : () => {},
    })),
    content: trailing,
  };

  usePageHeader(config);
  return null;
}
