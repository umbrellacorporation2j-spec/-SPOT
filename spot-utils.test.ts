import { describe, expect, it } from "vitest";
import {
  computeExpiresAt,
  formatTimeRemaining,
  isStreamActive,
  parseBulkStreams,
  parseOptionalScore,
  ytId,
} from "@/lib/spot-utils";

describe("SPOT stream expiry and match rules", () => {
  it("treats streams without expiry or with future expiry as active, and past expiry as inactive", () => {
    const now = Date.parse("2026-11-25T15:00:00Z");
    expect(isStreamActive(null, now)).toBe(true);
    expect(isStreamActive("2026-11-25T16:30:00Z", now)).toBe(true);
    expect(isStreamActive("2026-11-25T14:59:59Z", now)).toBe(false);
  });

  it("computes preset expiration timestamps accurately and rejects past custom times", () => {
    const now = Date.parse("2026-11-25T15:00:00Z");
    expect(computeExpiresAt("none", "", now)).toBeNull();
    expect(computeExpiresAt("2h", "", now)).toBe("2026-11-25T17:00:00.000Z");
    expect(computeExpiresAt("custom", "2026-11-25T14:00:00Z", now)).toBeNull();
  });

  it("formats remaining time in Arabic and marks elapsed timers as expired", () => {
    const now = Date.parse("2026-11-25T15:00:00Z");
    expect(formatTimeRemaining("2026-11-25T15:45:00Z", now)).toBe("يُحذف خلال 45 د");
    expect(formatTimeRemaining("2026-11-25T14:00:00Z", now)).toBe("منتهي الصلاحية");
  });

  it("validates match scores: accepts empty or 0-99 integers, rejects negative or non-numeric", () => {
    expect(parseOptionalScore("")).toEqual({ value: null });
    expect(parseOptionalScore("3")).toEqual({ value: 3 });
    expect(parseOptionalScore("-1").error).toBeTruthy();
    expect(parseOptionalScore("abc").error).toBeTruthy();
    expect(parseOptionalScore("105").error).toBeTruthy();
  });

  it("parses pipe-delimited bulk streams and YouTube IDs", () => {
    const parsed = parseBulkStreams("مباراة القمة | https://youtu.be/dQw4w9WgXcQ | دوري روشن");
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.title).toBe("مباراة القمة");
    expect(parsed[0]?.league).toBe("دوري روشن");
    expect(ytId(parsed[0]?.url ?? "")).toBe("dQw4w9WgXcQ");
  });
});