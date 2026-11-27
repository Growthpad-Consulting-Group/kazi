import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  listCompletedCalendarEvents: vi.fn(),
  schedule: { timezone: "Africa/Accra" as string | null },
}));

vi.mock("next-auth", () => ({ getServerSession: store.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/google-calendar", () => ({
  listCompletedCalendarEvents: store.listCompletedCalendarEvents,
}));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: store.schedule }),
        }),
      }),
    }),
  },
}));

import { GET } from "./route";

const today = new Date().toISOString().slice(0, 10);

beforeEach(() => {
  store.getServerSession.mockResolvedValue({ user: { id: "user-1" } });
  store.listCompletedCalendarEvents.mockResolvedValue([]);
  store.schedule.timezone = "Africa/Accra";
});

describe("daily-log calendar events API", () => {
  it("returns completed events in the staff member's timezone", async () => {
    store.listCompletedCalendarEvents.mockResolvedValue([
      {
        id: "event-1",
        title: "Client call",
        startTime: "09:00",
        endTime: "09:30",
        minutes: 30,
      },
    ]);

    const response = await GET(
      new Request(`https://kazi.test/api/pulse/daily-log/calendar-events?date=${today}`),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ connected: true, events: [{ id: "event-1" }] });
    expect(store.listCompletedCalendarEvents).toHaveBeenCalledWith(
      "user-1",
      today,
      "Africa/Accra",
    );
  });

  it("does not expose events when Google Calendar is not connected", async () => {
    store.listCompletedCalendarEvents.mockRejectedValue(
      new Error("No Google Calendar connection found for this user."),
    );

    const response = await GET(
      new Request(`https://kazi.test/api/pulse/daily-log/calendar-events?date=${today}`),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ connected: false, events: [] });
  });
});
