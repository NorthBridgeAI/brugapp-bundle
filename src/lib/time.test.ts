import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inWindow, minutesOfDay, parseHhmm, zonedDate } from "./time";

describe("time windows", () => {
  it("parses HH:mm into minutes", () => {
    assert.equal(parseHhmm("07:40"), 7 * 60 + 40);
    assert.equal(parseHhmm("16:40"), 16 * 60 + 40);
  });

  it("detects rush-hour holds", () => {
    assert.equal(inWindow(7 * 60 + 50, "07:40", "08:00"), true);
    assert.equal(inWindow(8 * 60, "07:40", "08:00"), false);
    assert.equal(inWindow(7 * 60 + 39, "07:40", "08:00"), false);
  });

  it("builds Amsterdam-zoned dates", () => {
    const date = zonedDate(2026, 9, 4, 7, 40);
    assert.equal(minutesOfDay(date), 7 * 60 + 40);
  });
});
