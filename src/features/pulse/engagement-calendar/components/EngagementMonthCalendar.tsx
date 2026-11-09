"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/Button";
import DateRangePicker, {
  type DateRangeValue,
} from "@/components/ui/DateRangePicker";
import StatCard from "@/components/ui/StatCard";

export type EngagementCalendarItem = {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  type: "Campaign" | "Survey" | "Side Quest";
  href: string;
  status: string;
};

const TYPE_STYLES: Record<EngagementCalendarItem["type"], string> = {
  Campaign: "bg-brand-500/10 text-brand-600 dark:text-brand-400",
  Survey: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "Side Quest": "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

const TYPE_DOT_STYLES: Record<EngagementCalendarItem["type"], string> = {
  Campaign: "bg-brand-500",
  Survey: "bg-blue-500",
  "Side Quest": "bg-amber-500",
};

const TYPE_ICONS: Record<EngagementCalendarItem["type"], string> = {
  Campaign: "solar:flag-2-broken",
  Survey: "solar:chat-round-dots-broken",
  "Side Quest": "solar:cup-star-broken",
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const toDate = (value: string) => {
  const normalized = value.includes("T") ? value : `${value}T12:00:00`;
  return new Date(normalized);
};
const isValidDate = (value: Date | null | undefined): value is Date =>
  !!value && !Number.isNaN(value.getTime());
const dateKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const sameDate = (left: Date, right: Date) => dateKey(left) === dateKey(right);
const endOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);

function eventIsOnDate(item: EngagementCalendarItem, date: Date) {
  if (!item.start) return false;
  const start = toDate(item.start);
  const end = item.end ? toDate(item.end) : start;
  return date >= start && date <= end;
}

function formatDate(date: Date, options: Intl.DateTimeFormatOptions) {
  if (!isValidDate(date)) return "—";
  return new Intl.DateTimeFormat("en-KE", options).format(date);
}

export function EngagementMonthCalendar({
  items,
}: {
  items: EngagementCalendarItem[];
}) {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(today);
  const [range, setRange] = useState<DateRangeValue>(() => ({
    startDate: new Date(today.getFullYear(), today.getMonth(), 1),
    endDate: endOfMonth(today),
    label: "This Month",
  }));
  const [filter, setFilter] = useState<
    "all" | "live" | "upcoming" | "campaign"
  >("all");

  const liveItems = useMemo(
    () =>
      items.filter(
        (item) => item.status === "live" || item.status === "active",
      ),
    [items],
  );
  const upcomingItems = useMemo(
    () => items.filter((item) => item.start && toDate(item.start) > today),
    [items, today],
  );
  const visibleItems = useMemo(() => {
    const start = range.startDate;
    const end = range.endDate;
    return items.filter((item) => {
      const itemStart = item.start ? toDate(item.start) : null;
      const itemEnd = item.end ? toDate(item.end) : itemStart;
      const inRange =
        !start ||
        !end ||
        !itemStart ||
        !itemEnd ||
        (itemStart <= end && itemEnd >= start);
      if (!inRange) return false;
      if (filter === "live")
        return liveItems.some(
          (live) => live.id === item.id && live.type === item.type,
        );
      if (filter === "upcoming")
        return upcomingItems.some(
          (upcoming) => upcoming.id === item.id && upcoming.type === item.type,
        );
      if (filter === "campaign") return item.type === "Campaign";
      return true;
    });
  }, [filter, items, liveItems, range.endDate, range.startDate, upcomingItems]);

  const selectFilter = (next: typeof filter) => {
    setFilter(next);
    if (next === "all") {
      goToToday();
      return;
    }
    const nextItem =
      next === "live"
        ? liveItems[0]
        : next === "campaign"
          ? items.find((item) => item.type === "Campaign")
          : upcomingItems[0];
    if (!nextItem?.start) return;
    const start = toDate(nextItem.start);
    const end = nextItem.end ? toDate(nextItem.end) : start;
    const date = today >= start && today <= end ? today : start;
    const nextMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    setMonth(nextMonth);
    setSelectedDate(date);
    setRange({
      startDate: nextMonth,
      endDate: endOfMonth(nextMonth),
      label: "Custom Range",
    });
  };

  const handleRangeChange = (next: DateRangeValue) => {
    if (!isValidDate(next.startDate) || !isValidDate(next.endDate)) return;
    setRange(next);
    const nextMonth = new Date(
      next.startDate.getFullYear(),
      next.startDate.getMonth(),
      1,
    );
    setMonth(nextMonth);
    setSelectedDate(next.startDate);
  };

  const filterLabel =
    filter === "live"
      ? "Live now"
      : filter === "upcoming"
        ? "Upcoming"
        : filter === "campaign"
          ? "Campaigns"
          : "All activity";

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [month]);

  const selectedItems = useMemo(
    () => items.filter((item) => eventIsOnDate(item, selectedDate)),
    [items, selectedDate],
  );

  const moveMonth = (direction: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + direction, 1);
    setMonth(next);
    setSelectedDate(next);
    setRange({
      startDate: next,
      endDate: endOfMonth(next),
      label: "Custom Range",
    });
  };

  const goToToday = () => {
    const next = new Date(today.getFullYear(), today.getMonth(), 1);
    setMonth(next);
    setSelectedDate(today);
    setRange({
      startDate: next,
      endDate: endOfMonth(next),
      label: "This Month",
    });
  };

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          compact
          title="Live now"
          value={liveItems.length}
          icon="solar:bolt-broken"
          color={liveItems.length ? "orange" : "slate"}
          subtitle="Show activity in progress"
          onClick={() => selectFilter("live")}
          className={
            filter === "live"
              ? "border-brand-500 ring-1 ring-brand-500/20"
              : undefined
          }
        />
        <StatCard
          compact
          title="Upcoming"
          value={upcomingItems.length}
          icon="solar:calendar-add-broken"
          color="blue"
          subtitle="Jump to the next activity"
          onClick={() => selectFilter("upcoming")}
          className={
            filter === "upcoming"
              ? "border-brand-500 ring-1 ring-brand-500/20"
              : undefined
          }
        />
        <StatCard
          compact
          title="Campaigns"
          value={items.filter((item) => item.type === "Campaign").length}
          icon="solar:flag-2-broken"
          color="amber"
          subtitle="Filter recognition moments"
          onClick={() => selectFilter("campaign")}
          className={
            filter === "campaign"
              ? "border-brand-500 ring-1 ring-brand-500/20"
              : undefined
          }
        />
        <StatCard
          compact
          title="All activity"
          value={items.length}
          icon="solar:calendar-mark-broken"
          color="green"
          subtitle="Clear calendar filters"
          onClick={() => selectFilter("all")}
          className={
            filter === "all"
              ? "border-brand-500 ring-1 ring-brand-500/20"
              : undefined
          }
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <div>
            <p className="text-xs font-semibold text-brand-500">
              Plan at a glance
            </p>
            <h2 className="mt-1 text-base font-semibold text-[var(--text-hi)]">
              {formatDate(month, { month: "long", year: "numeric" })}
            </h2>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <DateRangePicker
              value={range}
              onChange={handleRangeChange}
              allowedRanges={[
                "Today",
                "This Week",
                "This Month",
                "Custom Range",
              ]}
              maxDate={null}
            />
            <Button variant="secondary" size="sm" onClick={goToToday}>
              Today
            </Button>
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => moveMonth(-1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-lo)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)]"
            >
              <Icon icon="solar:alt-arrow-left-broken" className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => moveMonth(1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-lo)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-hi)]"
            >
              <Icon icon="solar:alt-arrow-right-broken" className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-2 text-xs sm:px-5">
          <span className="text-[var(--text-lo)]">
            Showing{" "}
            <span className="font-semibold text-[var(--text-hi)]">
              {filterLabel.toLowerCase()}
            </span>
            {visibleItems.length
              ? ` · ${visibleItems.length} item${visibleItems.length === 1 ? "" : "s"}`
              : " · no matching activity"}
          </span>
          {filter !== "all" && (
            <button
              type="button"
              onClick={() => selectFilter("all")}
              className="font-semibold text-brand-500 hover:text-brand-600"
            >
              Clear filter
            </button>
          )}
        </div>

        <div className="grid xl:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="min-w-0 p-3">
            <div className="mb-2 flex flex-wrap gap-2 text-[11px] font-medium text-[var(--text-lo)]">
              {Object.entries(TYPE_STYLES).map(([type, tone]) => (
                <span
                  key={type}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 ${tone}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {type}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-[var(--border)]">
              {DAY_NAMES.map((day) => (
                <div
                  key={day}
                  className="border-b border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--text-lo)]"
                >
                  {day}
                </div>
              ))}
              {days.map((day) => {
                const inMonth = day.getMonth() === month.getMonth();
                const dayItems = visibleItems.filter((item) =>
                  eventIsOnDate(item, day),
                );
                const isToday = sameDate(day, today);
                const isSelected = sameDate(day, selectedDate);
                return (
                  <button
                    key={dateKey(day)}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    aria-label={`${formatDate(day, { weekday: "long", day: "numeric", month: "long" })}${dayItems.length ? `, ${dayItems.length} scheduled item${dayItems.length === 1 ? "" : "s"}` : ""}`}
                    className={`group min-h-14 border-b border-r border-[var(--border)] p-1.5 text-left transition-colors sm:min-h-16 ${inMonth ? "bg-[var(--surface)]" : "bg-[var(--surface-2)]/50 text-[var(--text-lo)]"} ${isSelected ? "bg-brand-500/[0.04]" : "hover:bg-brand-500/[0.035]"}`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${isToday ? "bg-brand-500 text-white" : isSelected ? "bg-brand-500/10 text-brand-500" : "text-[var(--text-lo)]"}`}
                    >
                      {day.getDate()}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {dayItems.slice(0, 4).map((item) => (
                        <span
                          key={`${item.type}-${item.id}`}
                          title={`${item.type}: ${item.title}`}
                          className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT_STYLES[item.type]}`}
                        />
                      ))}
                      {dayItems.length > 4 && (
                        <span className="text-[9px] font-semibold leading-none text-[var(--text-lo)]">
                          +{dayItems.length - 4}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="border-t border-[var(--border)] bg-[var(--surface-2)]/50 p-3.5 xl:max-h-[420px] xl:min-h-[420px] xl:overflow-y-auto xl:border-l xl:border-t-0">
            <p className="text-xs font-semibold text-brand-500">On this date</p>
            <h3 className="mt-1 text-sm font-semibold text-[var(--text-hi)]">
              {formatDate(selectedDate, {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
            </h3>
            <div className="mt-4 space-y-2.5">
              {selectedItems.filter((item) => visibleItems.includes(item))
                .length ? (
                selectedItems
                  .filter((item) => visibleItems.includes(item))
                  .map((item) => (
                    <Link
                      key={`${item.type}-${item.id}`}
                      href={item.href}
                      className="group block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 transition-all hover:border-brand-500/25 hover:shadow-md"
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TYPE_STYLES[item.type]}`}
                        >
                          <Icon
                            icon={TYPE_ICONS[item.type]}
                            className="h-3.5 w-3.5"
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-[var(--text-hi)]">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[var(--text-lo)]">
                            {item.type} · {item.status}
                          </p>
                        </div>
                        <Icon
                          icon="solar:alt-arrow-right-broken"
                          className="mt-0.5 h-3.5 w-3.5 text-[var(--text-lo)] group-hover:text-brand-500"
                        />
                      </div>
                    </Link>
                  ))
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 text-center">
                  <Icon
                    icon="solar:calendar-minimalistic-broken"
                    className="mx-auto h-5 w-5 text-[var(--text-lo)]"
                  />
                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-lo)]">
                    Nothing is scheduled for this date.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
