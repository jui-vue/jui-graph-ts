import { describe, it, expect } from "vitest";
import * as time from "./time";

describe("time module", () => {
    describe("constants", () => {
        it("should export correct time constants", () => {
            expect(time.MILLISECOND).toBe(1000);
            expect(time.MINUTE).toBe(60000);
            expect(time.HOUR).toBe(3600000);
            expect(time.DAY).toBe(86400000);
        });

        it("should export unit string constants", () => {
            expect(time.years).toBe("years");
            expect(time.months).toBe("months");
            expect(time.days).toBe("days");
            expect(time.hours).toBe("hours");
            expect(time.minutes).toBe("minutes");
            expect(time.seconds).toBe("seconds");
            expect(time.milliseconds).toBe("milliseconds");
            expect(time.weeks).toBe("weeks");
        });
    });

    describe("diff()", () => {
        it("should calculate time difference in seconds", () => {
            const date1 = new Date("2024-01-01T00:00:05");
            const date2 = new Date("2024-01-01T00:00:00");
            // difference: 5000ms = 5 seconds
            expect(time.diff("seconds", date1, date2)).toBe(5);
        });

        it("should calculate time difference in minutes", () => {
            const date1 = new Date("2024-01-01T00:05:00");
            const date2 = new Date("2024-01-01T00:00:00");
            // difference: 300000ms = 5 minutes
            expect(time.diff("minutes", date1, date2)).toBe(5);
        });

        it("should calculate time difference in hours", () => {
            const date1 = new Date("2024-01-01T05:00:00");
            const date2 = new Date("2024-01-01T00:00:00");
            // difference: 18000000ms = 5 hours
            expect(time.diff("hours", date1, date2)).toBe(5);
        });

        it("should calculate time difference in days", () => {
            const date1 = new Date("2024-01-06T00:00:00");
            const date2 = new Date("2024-01-01T00:00:00");
            // difference: 432000000ms = 5 days
            expect(time.diff("days", date1, date2)).toBe(5);
        });

        it("should return absolute value of difference", () => {
            const date1 = new Date("2024-01-01T00:00:00");
            const date2 = new Date("2024-01-01T00:00:10");
            // difference: -10000ms = -10 seconds, but abs(floor(-10)) = 10
            expect(time.diff("seconds", date1, date2)).toBe(10);
        });

        it("should return raw milliseconds for unknown type", () => {
            const date1 = new Date("2024-01-01T00:00:00");
            const date2 = new Date("2024-01-01T00:00:00");
            date1.setTime(date1.getTime() + 1500);
            // difference: 1500ms
            expect(time.diff("unknown", date1, date2)).toBe(1500);
        });
    });

    describe("add()", () => {
        it("should return same date if no units provided", () => {
            const date = new Date("2024-01-01T00:00:00");
            const result = time.add(date);
            expect(result.getTime()).toBe(date.getTime());
        });

        it("should add hours", () => {
            const date = new Date("2024-01-01T00:00:00");
            const result = time.add(date, time.hours, 2);
            expect(result.getHours()).toBe(2);
        });

        it("should add days", () => {
            const date = new Date("2024-01-01T00:00:00");
            const result = time.add(date, time.days, 5);
            expect(result.getDate()).toBe(6);
        });

        it("should add multiple time units", () => {
            const date = new Date("2024-01-01T00:00:00");
            const result = time.add(date, time.hours, 1, time.minutes, 30);
            expect(result.getHours()).toBe(1);
            expect(result.getMinutes()).toBe(30);
        });

        it("should add years", () => {
            const date = new Date("2024-01-01T00:00:00");
            const result = time.add(date, time.years, 1);
            expect(result.getFullYear()).toBe(2025);
        });

        it("should add months", () => {
            const date = new Date("2024-01-01T00:00:00");
            const result = time.add(date, time.months, 2);
            expect(result.getMonth()).toBe(2); // March (0-indexed)
        });

        it("should add minutes", () => {
            const date = new Date("2024-01-01T00:00:00");
            const result = time.add(date, time.minutes, 45);
            expect(result.getMinutes()).toBe(45);
        });

        it("should add seconds", () => {
            const date = new Date("2024-01-01T00:00:00");
            const result = time.add(date, time.seconds, 30);
            expect(result.getSeconds()).toBe(30);
        });

        it("should add milliseconds", () => {
            const date = new Date("2024-01-01T00:00:00");
            const result = time.add(date, time.milliseconds, 500);
            expect(result.getMilliseconds()).toBe(500);
        });

        it("should add weeks", () => {
            const date = new Date("2024-01-01T00:00:00");
            const result = time.add(date, time.weeks, 2);
            expect(result.getDate()).toBe(15); // +14 days
        });

        it("should not mutate original date", () => {
            const date = new Date("2024-01-01T00:00:00");
            const originalTime = date.getTime();
            time.add(date, time.hours, 1);
            expect(date.getTime()).toBe(originalTime);
        });
    });

    describe("format()", () => {
        const testDate = new Date("2024-03-15T14:30:45.123");

        it("should format 4-digit year", () => {
            expect(time.format(testDate, "yyyy")).toBe("2024");
        });

        it("should format 2-digit year", () => {
            expect(time.format(testDate, "yy")).toBe("24");
        });

        it("should format month", () => {
            expect(time.format(testDate, "MM")).toBe("03");
            expect(time.format(testDate, "M")).toBe("3");
        });

        it("should format day of month", () => {
            expect(time.format(testDate, "dd")).toBe("15");
            expect(time.format(testDate, "d")).toBe("15");
        });

        it("should format hour 24h", () => {
            expect(time.format(testDate, "HH")).toBe("14");
            expect(time.format(testDate, "H")).toBe("14");
        });

        it("should format hour 12h", () => {
            expect(time.format(testDate, "hh")).toBe("02");
            expect(time.format(testDate, "h")).toBe("2");
        });

        it("should format minutes", () => {
            expect(time.format(testDate, "mm")).toBe("30");
            expect(time.format(testDate, "m")).toBe("30");
        });

        it("should format seconds", () => {
            expect(time.format(testDate, "ss")).toBe("45");
            expect(time.format(testDate, "s")).toBe("45");
        });

        it("should format milliseconds", () => {
            expect(time.format(testDate, "fff")).toBe("123");
        });

        it("should format AM/PM", () => {
            const pmDate = new Date("2024-03-15T14:30:45");
            expect(time.format(pmDate, "TT")).toBe("PM");
            expect(time.format(pmDate, "T")).toBe("P");
            expect(time.format(pmDate, "tt")).toBe("pm");
            expect(time.format(pmDate, "t")).toBe("p");

            const amDate = new Date("2024-03-15T08:30:45");
            expect(time.format(amDate, "TT")).toBe("AM");
            expect(time.format(amDate, "T")).toBe("A");
        });

        it("should format complex date string", () => {
            const result = time.format(testDate, "yyyy-MM-dd HH:mm:ss");
            expect(result).toBe("2024-03-15 14:30:45");
        });

        it("should respect UTC flag", () => {
            const date = new Date("2024-03-15T14:30:45Z");
            const utc = time.format(date, "HH", true);
            // UTC should be 14
            expect(utc).toBe("14");
        });

        it("should handle month names", () => {
            expect(time.format(testDate, "MMMM")).toBe("March");
            expect(time.format(testDate, "MMM")).toBe("Mar");
        });

        it("should handle day names", () => {
            // 2024-03-15 is a Friday
            expect(time.format(testDate, "dddd")).toContain("Friday");
            expect(time.format(testDate, "ddd")).toContain("Fri");
        });
    });
});
