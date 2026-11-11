import { describe, expect, it } from "vitest";
import { parseLogLine } from "./logs";

/** the backend joins multi line messages with zero width spaces */
const ZWSP = "\u200b";

describe("parseLogLine: frigate", () => {
  it("splits date, level, section and message", () => {
    expect(
      parseLogLine(
        "frigate",
        "2026-04-06 10:00:00.123456789  [2026-04-06 10:00:00] frigate.app  INFO    : Starting Frigate",
      ),
    ).toEqual({
      dateStamp: "2026-04-06 10:00:00",
      severity: "info",
      section: "frigate.app",
      content: "Starting Frigate",
    });
  });

  it("restores multi line messages", () => {
    const line = parseLogLine(
      "frigate",
      "2026-04-06 10:00:00.1  [2026-04-06 10:00:00] frigate.video  ERROR   : first" +
        ZWSP +
        "second",
    );
    expect(line?.severity).toBe("error");
    expect(line?.content).toBe("first\nsecond");
  });

  it("recognizes startup lines without a bracketed date", () => {
    expect(
      parseLogLine(
        "frigate",
        "2026-04-06 10:00:00.1  [INFO] Preparing Frigate",
      ),
    ).toMatchObject({
      severity: "info",
      section: "startup",
      content: "Preparing Frigate",
    });
  });
});

describe("parseLogLine: go2rtc", () => {
  it("maps go2rtc levels", () => {
    expect(
      parseLogLine(
        "go2rtc",
        "2026-04-06 10:00:00.123 WRN [rtsp] error=EOF url=rtsp://cam",
      ),
    ).toEqual({
      dateStamp: "2026-04-06 10:00:00",
      severity: "warning",
      section: "rtsp",
      content: "error=EOF url=rtsp://cam",
    });
  });

  it("skips empty lines", () => {
    expect(parseLogLine("go2rtc", "")).toBeNull();
  });
});

describe("parseLogLine: nginx", () => {
  it("treats requests as info with the method as section", () => {
    expect(
      parseLogLine(
        "nginx",
        '2026-04-06 10:00:00.123456789  127.0.0.1 - - "GET /api/stats HTTP/1.1" 200',
      ),
    ).toEqual({
      dateStamp: "2026-04-06 10:00:00",
      severity: "info",
      section: "GET",
      content: '"GET /api/stats HTTP/1.1" 200',
    });
  });

  it("marks error lines", () => {
    expect(
      parseLogLine(
        "nginx",
        '2026-04-06 10:00:00.1 [error] 12#12: upstream timed out, client: 1.2.3.4, request: "GET /api HTTP/1.1"',
      ),
    ).toMatchObject({ severity: "error", section: "error" });
  });
});
