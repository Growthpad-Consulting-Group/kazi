import React from "react";

interface PageWithSidebarProps {
  main: React.ReactNode;
  sidebar: React.ReactNode;
  /** Main column width out of 12 on lg+ screens. Sidebar takes the rest. */
  mainSpan?: 7 | 8 | 9;
  /**
   * Offset from the top of the scrollport the sidebar sticks to. The app shell
   * scrolls inside <main> (the header lives outside it), so this is relative
   * to <main>'s top edge — keep it small; it is NOT a viewport offset.
   */
  stickyTop?: string;
}

const SPAN_CLASS: Record<number, string> = {
  7: "lg:col-span-7",
  8: "lg:col-span-8",
  9: "lg:col-span-9",
};

const SIDEBAR_SPAN_CLASS: Record<number, string> = {
  7: "lg:col-span-5",
  8: "lg:col-span-4",
  9: "lg:col-span-3",
};

/**
 * Main content + sticky metadata sidebar — the standard "detail/edit page"
 * layout (Shopify Admin, Square Dashboard). The sidebar sticks to the
 * viewport as the main column scrolls, instead of stretching to match the
 * main column's height like a CSS grid row normally would.
 * Ported from bflowpos, restyled for Kazi.
 */
export default function PageWithSidebar({
  main,
  sidebar,
  mainSpan = 8,
  stickyTop = "0px",
}: PageWithSidebarProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
      <div className={`min-w-0 ${SPAN_CLASS[mainSpan]}`}>{main}</div>
      <div
        className={`min-w-0 space-y-5 lg:sticky ${SIDEBAR_SPAN_CLASS[mainSpan]}`}
        style={{ top: stickyTop }}
      >
        {sidebar}
      </div>
    </div>
  );
}
