import Link from "next/link";
import { Icon } from "@iconify/react";
import type { HomeModuleCard } from "../home-module-data";

export default function HomeModuleCards({
  cards,
}: {
  cards: HomeModuleCard[];
}) {
  return (
    <section
      aria-label="Your chosen cards"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      {cards.map((card) => (
        <Link
          key={card.id}
          href={card.href}
          className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-[border-color,background-color] hover:border-brand-500/40 hover:bg-[var(--surface-2)]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--text-lo)]">
              {card.label}
            </span>
            <Icon
              icon="solar:arrow-right-broken"
              className="h-3.5 w-3.5 text-[var(--text-lo)] transition-transform group-hover:translate-x-0.5"
            />
          </div>
          <p className="mt-2 font-mono text-lg font-bold text-[var(--text-hi)]">
            {card.value}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--text-lo)]">
            {card.hint}
          </p>
        </Link>
      ))}
    </section>
  );
}
