import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));
  const updateEq = vi.fn();
  const update = vi.fn(() => ({ eq: updateEq }));
  const deleteEq = vi.fn();
  const remove = vi.fn(() => ({ eq: deleteEq }));
  const from = vi.fn(() => ({ select, update, delete: remove }));
  return { getServerSession: vi.fn(), maybeSingle, updateEq, update, deleteEq, remove, from };
});

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("@/lib/cache/invalidate", () => ({ invalidateOneOnOneParticipants: vi.fn() }));
vi.mock("@/lib/google-calendar", () => ({ createCalendarEvent: vi.fn(), updateCalendarEvent: vi.fn(), deleteCalendarEvent: vi.fn() }));
vi.mock("@/lib/slack", () => ({ sendOneOnOneSlackDMs: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ notifyOneOnOneScheduled: vi.fn() }));

import { DELETE, PATCH } from "./route";

const participantMeeting = { manager_id: "manager-1", report_id: "employee-1", google_event_id: null };
const foreignEmployeeSession = { user: { id: "employee-2", role: "employee" } };
const participantSession = { user: { id: "employee-1", role: "employee" } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.maybeSingle.mockResolvedValue({ data: participantMeeting, error: null });
  mocks.updateEq.mockResolvedValue({ error: null });
  mocks.deleteEq.mockResolvedValue({ error: null });
});

describe("one-on-one mutation authorization", () => {
  it("rejects unauthenticated updates before reading the meeting", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await PATCH(new Request("http://localhost/api/pulse/one-on-ones/meeting-1", { method: "PATCH", body: "{}" }), { params: Promise.resolve({ id: "meeting-1" }) });

    expect(response.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("blocks an employee who is not a meeting participant", async () => {
    mocks.getServerSession.mockResolvedValue(foreignEmployeeSession);

    const response = await PATCH(new Request("http://localhost/api/pulse/one-on-ones/meeting-1", { method: "PATCH", body: JSON.stringify({ notes: "Private note" }) }), { params: Promise.resolve({ id: "meeting-1" }) });

    expect(response.status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("allows a participant to update their own conversation", async () => {
    mocks.getServerSession.mockResolvedValue(participantSession);

    const response = await PATCH(new Request("http://localhost/api/pulse/one-on-ones/meeting-1", { method: "PATCH", body: JSON.stringify({ agenda: "Discuss progress" }) }), { params: Promise.resolve({ id: "meeting-1" }) });

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ agenda: "Discuss progress" });
  });

  it("blocks deletion by an employee who is not a meeting participant", async () => {
    mocks.getServerSession.mockResolvedValue(foreignEmployeeSession);

    const response = await DELETE(new Request("http://localhost/api/pulse/one-on-ones/meeting-1", { method: "DELETE" }), { params: Promise.resolve({ id: "meeting-1" }) });

    expect(response.status).toBe(403);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
