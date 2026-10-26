'use client';

import { useCallback, useImperativeHandle, useRef, useState, useEffect, Ref } from 'react';
import {
  format,
  subMonths,
} from 'date-fns';
import { createPortal } from 'react-dom';
import { DateRange } from 'react-date-range';
import { Icon } from '@iconify/react';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

import { PRESETS, computePresetRange } from './dateRangePresets';

// Re-exported for backward compatibility — the implementation lives in the
// server-safe `./dateRangePresets` module.
export { PRESETS, computePresetRange };

export interface DateRangeValue {
  startDate: Date | null;
  endDate: Date | null;
  label?: string;
}

export interface DateRangePickerProps {
  value?: DateRangeValue;
  onChange?: (value: DateRangeValue) => void;
  className?: string;
  fullWidth?: boolean;
  allowedRanges?: string[];
  /** Defaults to today to preserve reporting/date-filter behavior. Pass null to allow future dates. */
  maxDate?: Date | null;
  minDate?: Date;
  ref?: Ref<DateRangePickerRef>;
}

export interface DateRangePickerRef {
  focus: () => void;
  openDropdown: () => void;
}

interface DraftRange { startDate: Date | null; endDate: Date | null; key: string; }

function formatDisplayLabel(value: DateRangeValue | undefined): string {
  if (!value) return 'Select date range';
  if (value.label && value.label !== 'Custom Range') return value.label;
  if (value.startDate && value.endDate) {
    return `${format(value.startDate, 'MMM d, yyyy')} – ${format(value.endDate, 'MMM d, yyyy')}`;
  }
  return 'Select date range';
}

const DateRangePicker = function DateRangePicker(
  { value, onChange, className = '', fullWidth = false, allowedRanges, maxDate = new Date(), minDate, ref }: DateRangePickerProps
) {
  const [draftRange, setDraftRange] = useState<DraftRange>({
    startDate: value?.startDate ?? null,
    endDate: value?.endDate ?? null,
    key: 'selection',
  });
  const [activeLabel, setActiveLabel] = useState<string>(value?.label || 'Today');
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const [calendarRenderKey, setCalendarRenderKey] = useState(0);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const canApply =
    draftRange.startDate !== null &&
    draftRange.endDate !== null &&
    draftRange.startDate <= draftRange.endDate;

  const visibleRanges = (
    allowedRanges
      ? PRESETS.filter((p) => allowedRanges.includes(p))
      : [...PRESETS]
  ).map((label) => ({ label }));

  const displayLabel = formatDisplayLabel(value);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (value) {
      const frame = window.requestAnimationFrame(() => {
        setActiveLabel(value.label || 'Custom Range');
        setDraftRange({ startDate: value.startDate, endDate: value.endDate, key: 'selection' });
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [value]);

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = isMobile ? Math.min(vw - 32, 360) : 680;
    const popoverHeight = popoverRef.current?.getBoundingClientRect().height ?? (isMobile ? 560 : 520);
    const margin = 12;
    let left = rect.left;
    if (left + pw > vw - margin) left = vw - pw - margin;
    if (left < margin) left = margin;

    // Portalling avoids clipping from parent containers, but a modal can still
    // position the trigger too low for the calendar. Keep the whole picker in
    // the viewport rather than letting the lower months disappear off-screen.
    const top = Math.max(margin, Math.min(rect.bottom + 6, vh - popoverHeight - margin));
    setPopoverStyle({ position: 'fixed', top, left, width: pw, zIndex: 9999 });
  }, [isMobile]);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(computePosition);
    const handler = () => computePosition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [isOpen, computePosition]);

  const openPopover = () => {
    setDraftRange({ startDate: value?.startDate ?? null, endDate: value?.endDate ?? null, key: 'selection' });
    setActiveLabel(value?.label || 'Custom Range');
    computePosition();
    setIsOpen(true);
  };

  const closePopover = useCallback((revert = true) => {
    if (revert) {
      setDraftRange({ startDate: value?.startDate ?? null, endDate: value?.endDate ?? null, key: 'selection' });
      setActiveLabel(value?.label || 'Custom Range');
    }
    setIsOpen(false);
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      closePopover(true);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, closePopover]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closePopover(true); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, closePopover]);

  useImperativeHandle(ref, () => ({ focus: () => openPopover(), openDropdown: () => openPopover() }));

  const handlePresetClick = (label: string) => {
    const range = computePresetRange(label);
    setActiveLabel(label);
    setDraftRange({ ...range, key: 'selection' });
    if (label === 'Custom Range') setCalendarRenderKey((k) => k + 1);
  };

  const handleCalendarChange = (ranges: unknown) => {
    let sel: { startDate?: Date; endDate?: Date } | null = null;
    if (Array.isArray(ranges)) sel = ranges[0];
    else if (ranges && typeof ranges === 'object') {
      const r = ranges as Record<string, unknown>;
      sel = (r.selection as typeof sel) ?? (Object.values(r)[0] as typeof sel);
    }
    if (!sel) return;
    setDraftRange({ startDate: sel.startDate ?? null, endDate: sel.endDate ?? null, key: 'selection' });
    setActiveLabel('Custom Range');
  };

  const handleApply = () => {
    if (!canApply) return;
    onChange?.({ startDate: draftRange.startDate, endDate: draftRange.endDate, label: activeLabel });
    closePopover(false);
    setTimeout(() => triggerRef.current?.focus(), 0);
  };

  const handleCancel = () => { closePopover(true); setTimeout(() => triggerRef.current?.focus(), 0); };

  const fmt = (d: Date | null) => (d ? format(d, 'MMM d, yyyy') : '');

  const shownDate = draftRange.startDate ?? subMonths(new Date(), 1);

  return (
    <div className={`relative ${fullWidth ? 'block w-full' : 'inline-block'} ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? handleCancel() : openPopover())}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-[var(--surface)] border-[var(--border)] text-[var(--text-hi)] hover:border-brand-500/40 hover:bg-[var(--surface-2)] ${fullWidth ? 'w-full justify-between' : ''} ${isOpen ? 'border-brand-500/60 ring-2 ring-brand-500/20' : ''}`}
      >
        <Icon icon="solar:calendar-date-broken" className="w-4 h-4 shrink-0 text-[var(--text-lo)]" />
        <span className={fullWidth ? "min-w-0 flex-1 truncate text-left" : "max-w-[160px] truncate"}>
          {displayLabel}
        </span>
        <Icon
          icon={isOpen ? 'solar:alt-arrow-up-broken' : 'solar:alt-arrow-down-broken'}
          className="w-3.5 h-3.5 shrink-0 text-[var(--text-lo)]"
        />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          style={popoverStyle}
          role="dialog"
          aria-label="Date range picker"
          className="max-h-[calc(100vh-24px)] overflow-x-hidden overflow-y-auto rounded-2xl border bg-[var(--surface)] shadow-2xl border-[var(--border)]"
        >
          <div className={isMobile ? 'flex flex-col max-h-[85vh] overflow-y-auto' : 'flex'}>
            {/* Preset panel */}
            <div
              className={`flex flex-col py-2 border-[var(--border)] bg-[var(--surface-2)]/40 ${isMobile ? 'border-b' : 'border-r overflow-y-auto'}`}
              style={isMobile ? undefined : { width: 160, minWidth: 160, maxHeight: 450 }}
            >
              {visibleRanges.map(({ label }) => {
                const isActive = activeLabel === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handlePresetClick(label)}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none ${
                      isActive
                        ? 'bg-brand-500/10 text-brand-500'
                        : 'text-[var(--text-hi)] hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Calendar panel */}
            <div className="flex flex-col flex-1 min-w-0">
              {/* Date inputs row */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border)]">
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-brand-500">Start date</p>
                  <div className="px-3 py-1.5 rounded-lg border text-sm font-medium min-h-[34px] bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-hi)]">
                    {fmt(draftRange.startDate) || <span className="opacity-40">—</span>}
                  </div>
                </div>
                <span className="text-sm mt-5 shrink-0 text-[var(--text-lo)]">–</span>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-[var(--text-lo)]">End date</p>
                  <div className="px-3 py-1.5 rounded-lg border text-sm font-medium min-h-[34px] bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-hi)]">
                    {fmt(draftRange.endDate) || <span className="opacity-40">—</span>}
                  </div>
                </div>
              </div>

              {/* Calendar */}
              <div className="kazi-calendar overflow-auto px-2 pb-1" style={{ maxHeight: 500 }}>
                <DateRange
                  key={calendarRenderKey}
                  ranges={[{
                    startDate: draftRange.startDate ?? new Date(),
                    endDate: draftRange.endDate ?? new Date(),
                    key: 'selection',
                  }]}
                  onChange={handleCalendarChange}
                  moveRangeOnFirstSelection={false}
                  showDateDisplay={false}
                  rangeColors={['#f05d23']}
                  showMonthAndYearPickers={true}
                  showPreview={true}
                  editableDateInputs={false}
                  minDate={minDate}
                  maxDate={maxDate ?? undefined}
                  direction={isMobile ? 'vertical' : 'horizontal'}
                  months={isMobile ? 1 : 2}
                  shownDate={shownDate}
                  className="w-full"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors text-[var(--text-lo)] hover:bg-[var(--surface-2)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!canApply}
                  className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                    canApply
                      ? 'bg-brand-500 text-white hover:bg-[#d94f1a] shadow-sm'
                      : 'bg-[var(--surface-2)] text-[var(--text-lo)] cursor-not-allowed'
                  }`}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DateRangePicker;
