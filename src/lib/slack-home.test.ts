import { describe, expect, it } from "vitest";
import { buildHomeView, type HomeData } from "./slack-home-view";

const base: HomeData = {
  firstName: "Amina",
  meetingsNext24h: 1,
  logged: false,
  checkinSubmitted: false,
  goalsOpen: 3,
  goalsDueSoon: 1,
  timerRunning: false,
  checkinsAwaitingReview: null,
};

describe("buildHomeView", () => {
  it("shows the person's own counts and Kazi links without a team section", () => {
    const view = buildHomeView(base);
    const serialised = JSON.stringify(view);
    expect(view.type).toBe("home");
    expect(serialised).toContain("Hi Amina");
    expect(serialised).toContain("Open today in Kazi");
    expect(serialised).not.toContain("Your team");
  });

  it("shows a team count only for managers, and never names", () => {
    const view = buildHomeView({ ...base, checkinsAwaitingReview: 2 });
    const serialised = JSON.stringify(view);
    expect(serialised).toContain("2 check-ins are waiting for review");
    expect(serialised).toContain("Review queue");
  });

  it("omits the review button when nothing is waiting", () => {
    const serialised = JSON.stringify(
      buildHomeView({ ...base, checkinsAwaitingReview: 0 }),
    );
    expect(serialised).toContain("No check-ins are waiting for review");
    expect(serialised).not.toContain("Review queue");
  });
});
