"use client";

import { useRouter } from "next/navigation";
import {
  usePageHeader,
  type PageHeaderConfig,
} from "@/shared/contexts/PageHeaderContext";
import { useIsViewOnly } from "@/lib/use-view-only";

interface ActionDef {
  label: string;
  icon?: string;
  variant?: "primary" | "secondary";
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Creates or changes data. Hidden from read-only reviewers, even when it is a link. */
  write?: boolean;
  /** Smooth-scroll to an element in the current page. Takes precedence over href. */
  scrollToId?: string;
}

interface Props {
  title: string;
  description?: string;
  icon?: string;
  actions?: ActionDef[];
  /** Custom node rendered on the right, after any actions. */
  trailing?: React.ReactNode;
  /** Set when the trailing node only filters the view, so read-only reviewers keep it. */
  trailingIsFilter?: boolean;
}

export default function SetPageHeader({
  title,
  description,
  icon,
  actions,
  trailing,
  trailingIsFilter = false,
}: Props) {
  const router = useRouter();
  const viewOnly = useIsViewOnly();
  // Read-only reviewers keep navigation buttons, and lose anything that changes data.
  const visibleActions = viewOnly
    ? actions?.filter((a) => (a.href || a.scrollToId) && !a.write)
    : actions;

  const config: PageHeaderConfig = {
    title,
    description,
    icon,
    actions: visibleActions?.map((a) => ({
      label: a.label,
      icon: a.icon,
      variant: a.variant,
      disabled: a.disabled,
      onClick:
        a.onClick ??
        (a.scrollToId
          ? () =>
              document
                .getElementById(a.scrollToId!)
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
          : a.href
            ? () => router.push(a.href!)
            : () => {}),
    })),
    content: viewOnly && !trailingIsFilter ? undefined : trailing,
  };

  usePageHeader(config);
  return null;
}
