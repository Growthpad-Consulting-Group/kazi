import { Button } from "@/components/ui/Button";
import DateRangePicker, {
  type DateRangeValue,
} from "@/components/ui/DateRangePicker";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { MonthSelect } from "./MonthSelect";
import {
  type Cycle,
  type Nomination,
  type Staff,
  recommendedCycleSchedule,
  toDateString,
} from "./wall-of-fame-model";

type WindowProps = {
  nominationWindow: DateRangeValue;
  teamVotingWindow: DateRangeValue;
  managementVotingWindow: DateRangeValue;
};

export function WallOfFameScheduleModal({
  managementVotingWindow,
  nominationWindow,
  teamVotingWindow,
  saveSchedule,
  saving,
  scheduleOpen,
  setScheduleOpen,
  setClosesAt,
  setManagementVotingClosesAt,
  setManagementVotingOpensAt,
  setOpensAt,
  setTeamVotingClosesAt,
  setTeamVotingOpensAt,
}: WindowProps & {
  saveSchedule: () => void;
  saving: boolean;
  scheduleOpen: boolean;
  setScheduleOpen: (value: boolean) => void;
  setClosesAt: (value: string) => void;
  setManagementVotingClosesAt: (value: string) => void;
  setManagementVotingOpensAt: (value: string) => void;
  setOpensAt: (value: string) => void;
  setTeamVotingClosesAt: (value: string) => void;
  setTeamVotingOpensAt: (value: string) => void;
}) {
  return (
    <SimpleModal
      open={scheduleOpen}
      onClose={() => setScheduleOpen(false)}
      title="Edit award schedule"
      icon="solar:calendar-mark-broken"
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-[var(--text-lo)]">
          Keep each stage focused and non-overlapping. Staff can only vote while
          their relevant window is open.
        </p>
        <div className="block text-xs font-semibold text-[var(--text-hi)]">
          Nomination window
          <div className="mt-1.5">
            <DateRangePicker
              value={nominationWindow}
              onChange={(range) => {
                setOpensAt(
                  range.startDate ? toDateString(range.startDate) : "",
                );
                setClosesAt(range.endDate ? toDateString(range.endDate) : "");
              }}
              allowedRanges={["Custom Range"]}
              maxDate={null}
              fullWidth
            />
          </div>
        </div>
        <div className="block text-xs font-semibold text-[var(--text-hi)]">
          Team voting window
          <div className="mt-1.5">
            <DateRangePicker
              value={teamVotingWindow}
              onChange={(range) => {
                setTeamVotingOpensAt(
                  range.startDate ? toDateString(range.startDate) : "",
                );
                setTeamVotingClosesAt(
                  range.endDate ? toDateString(range.endDate) : "",
                );
              }}
              allowedRanges={["Custom Range"]}
              maxDate={null}
              fullWidth
            />
          </div>
        </div>
        <div className="block text-xs font-semibold text-[var(--text-hi)]">
          Finalist voting window
          <div className="mt-1.5">
            <DateRangePicker
              value={managementVotingWindow}
              onChange={(range) => {
                setManagementVotingOpensAt(
                  range.startDate ? toDateString(range.startDate) : "",
                );
                setManagementVotingClosesAt(
                  range.endDate ? toDateString(range.endDate) : "",
                );
              }}
              allowedRanges={["Custom Range"]}
              maxDate={null}
              fullWidth
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" onClick={() => setScheduleOpen(false)}>
            Cancel
          </Button>
          <Button loading={saving} onClick={saveSchedule}>
            Save schedule
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}

export function WallOfFameNewCycleModal({
  closesAt,
  createCycle,
  managementVotingClosesAt,
  managementVotingOpensAt,
  managementVotingWindow,
  month,
  newCycleOpen,
  nominationWindow,
  opensAt,
  saving,
  setClosesAt,
  setManagementVotingClosesAt,
  setManagementVotingOpensAt,
  setMonth,
  setNewCycleOpen,
  setOpensAt,
  setTeamVotingClosesAt,
  setTeamVotingOpensAt,
  teamVotingClosesAt,
  teamVotingOpensAt,
  teamVotingWindow,
}: WindowProps & {
  closesAt: string;
  cycle: Cycle;
  createCycle: () => void;
  managementVotingClosesAt: string;
  managementVotingOpensAt: string;
  month: string;
  newCycleOpen: boolean;
  nominations: Nomination[];
  opensAt: string;
  saving: boolean;
  setClosesAt: (value: string) => void;
  setManagementVotingClosesAt: (value: string) => void;
  setManagementVotingOpensAt: (value: string) => void;
  setMonth: (value: string) => void;
  setNewCycleOpen: (value: boolean) => void;
  setOpensAt: (value: string) => void;
  setTeamVotingClosesAt: (value: string) => void;
  setTeamVotingOpensAt: (value: string) => void;
  staff: Staff[];
  teamVotingClosesAt: string;
  teamVotingOpensAt: string;
}) {
  return (
    <SimpleModal
      open={newCycleOpen}
      onClose={() => setNewCycleOpen(false)}
      title="Open Wall of Fame nominations"
      icon="solar:cup-star-broken"
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-[var(--text-lo)]">
          Open a monthly cycle for staff nominations.
        </p>
        <label className="block text-xs font-semibold text-[var(--text-hi)]">
          Award month
          <div className="mt-1.5">
            <MonthSelect
              value={month}
              onChange={(nextMonth) => {
                setMonth(nextMonth);
                const schedule = recommendedCycleSchedule(nextMonth);
                setOpensAt(schedule.opensAt);
                setClosesAt(schedule.closesAt);
                setTeamVotingOpensAt(schedule.teamVotingOpensAt);
                setTeamVotingClosesAt(schedule.teamVotingClosesAt);
                setManagementVotingOpensAt(schedule.managementVotingOpensAt);
                setManagementVotingClosesAt(schedule.managementVotingClosesAt);
              }}
            />
          </div>
        </label>
        <div className="block text-xs font-semibold text-[var(--text-hi)]">
          Nomination window
          <div className="mt-1.5">
            <DateRangePicker
              value={nominationWindow}
              onChange={(range) => {
                setOpensAt(
                  range.startDate ? toDateString(range.startDate) : "",
                );
                setClosesAt(range.endDate ? toDateString(range.endDate) : "");
              }}
              allowedRanges={["Custom Range"]}
              maxDate={null}
              fullWidth
            />
          </div>
          <p className="mt-2 font-normal leading-relaxed text-[var(--text-lo)]">
            Recommended cadence: nominations 1–7, team voting 8–12, and finalist
            voting 13–15. You can adjust the dates for an exception.
          </p>
        </div>
        <div className="block text-xs font-semibold text-[var(--text-hi)]">
          Team voting window
          <div className="mt-1.5">
            <DateRangePicker
              value={teamVotingWindow}
              onChange={(range) => {
                setTeamVotingOpensAt(
                  range.startDate ? toDateString(range.startDate) : "",
                );
                setTeamVotingClosesAt(
                  range.endDate ? toDateString(range.endDate) : "",
                );
              }}
              allowedRanges={["Custom Range"]}
              maxDate={null}
              fullWidth
            />
          </div>
        </div>
        <div className="block text-xs font-semibold text-[var(--text-hi)]">
          Finalist voting window
          <div className="mt-1.5">
            <DateRangePicker
              value={managementVotingWindow}
              onChange={(range) => {
                setManagementVotingOpensAt(
                  range.startDate ? toDateString(range.startDate) : "",
                );
                setManagementVotingClosesAt(
                  range.endDate ? toDateString(range.endDate) : "",
                );
              }}
              allowedRanges={["Custom Range"]}
              maxDate={null}
              fullWidth
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" onClick={() => setNewCycleOpen(false)}>
            Cancel
          </Button>
          <Button
            loading={saving}
            disabled={
              !!(
                (opensAt && closesAt && closesAt < opensAt) ||
                (teamVotingOpensAt &&
                  teamVotingClosesAt &&
                  teamVotingClosesAt < teamVotingOpensAt) ||
                (managementVotingOpensAt &&
                  managementVotingClosesAt &&
                  managementVotingClosesAt < managementVotingOpensAt)
              )
            }
            onClick={createCycle}
          >
            Open nominations
          </Button>
        </div>
      </div>
    </SimpleModal>
  );
}
