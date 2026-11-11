/** Parses Frigate, go2rtc and nginx log lines into date, level, section and text. */
import type { LogLine, LogService, LogSeverity } from "@/types/log";

const pythonSeverity = /(DEBUG)|(INFO)|(WARNING)|(ERROR)/;
const frigateDateStamp = /\[[\d\s:-]*]/;
const frigateSection = /[\w.]*/;
const goSeverity = /(DBG )|(TRC )|(INF )|(WRN )|(ERR )/;
const goSection = /\[\w*]/;
const httpMethods = /(GET)|(POST)|(PUT)|(PATCH)|(DELETE)/;
const nginxTimestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+/;

/** Multi line messages are joined with zero width spaces by the backend. */
const unfold = (text: string) => text.trim().replace(/​/g, "\n");

function parseFrigate(line: string): LogLine | null {
  const match = frigateDateStamp.exec(line);

  if (!match) {
    const loggingIndex = line.indexOf("[LOGGING]");
    if (loggingIndex !== -1) {
      return {
        dateStamp: line.substring(0, 19),
        severity: "info",
        section: "logging",
        content: unfold(line.substring(loggingIndex + 9)),
      };
    }
    const infoIndex = line.indexOf("[INFO]");
    if (infoIndex !== -1) {
      return {
        dateStamp: line.substring(0, 19),
        severity: "info",
        section: "startup",
        content: unfold(line.substring(infoIndex + 6)),
      };
    }
    return {
      dateStamp: line.substring(0, 19),
      severity: "unknown",
      section: "unknown",
      content: unfold(line.substring(30)),
    };
  }

  const rest = line.substring(match.index + match[0].length).trim();
  const section = frigateSection.exec(rest)?.[0] ?? "";
  const severity = pythonSeverity.exec(line)?.[0]?.toLowerCase();

  return {
    dateStamp: match[0].slice(1, -1),
    severity: (severity as LogSeverity | undefined) ?? "unknown",
    section,
    content: unfold(
      line.substring(line.indexOf(":", match.index + match[0].length) + 2),
    ),
  };
}

function parseGo2rtc(line: string): LogLine | null {
  if (line.length === 0) return null;

  if (line.includes("[LOGGING]")) {
    return {
      dateStamp: line.substring(0, 19),
      severity: "info",
      section: "logging",
      content: line.substring(line.indexOf("[LOGGING]") + 9).trim(),
    };
  }

  const severity = goSeverity.exec(line);
  let section = goSection.exec(line)?.[0]?.slice(1, -1) ?? "startup";
  if (pythonSeverity.test(section)) section = "startup";

  let contentStart: number;
  if (section === "startup") {
    contentStart = severity
      ? severity.index + severity[0].length
      : line.lastIndexOf("]") + 1;
  } else {
    contentStart = line.indexOf(section) + section.length + 2;
  }

  const levels: Record<string, LogSeverity> = {
    INF: "info",
    WRN: "warning",
    ERR: "error",
    DBG: "debug",
    TRC: "debug",
  };

  return {
    dateStamp: line.substring(0, 19),
    severity: levels[severity?.[0]?.trim() ?? ""] ?? "info",
    section,
    content: line.substring(contentStart).trim(),
  };
}

function parseNginx(line: string): LogLine | null {
  if (line.trim().length === 0) return null;

  const fullTimestamp = nginxTimestamp.exec(line)?.[0] ?? "";
  // drop the nanoseconds
  const dateStamp = fullTimestamp.split(".")[0];

  if (line.includes("[LOGGING]")) {
    return {
      dateStamp,
      severity: "info",
      section: "logging",
      content: line.slice(line.indexOf("[LOGGING]") + 9).trim(),
    };
  }
  if (line.includes("[INFO]")) {
    return {
      dateStamp,
      severity: "info",
      section: "startup",
      content: line.slice(fullTimestamp.length).trim(),
    };
  }
  if (line.includes("[error]")) {
    const errorMatch = line.match(/(\[error\].*?,.*request: "[^"]*")/);
    return {
      dateStamp,
      severity: "error",
      section: "error",
      content: errorMatch ? errorMatch[1] : line,
    };
  }
  if (line.includes("GET") || line.includes("POST") || line.includes("HTTP")) {
    const contentStart = line.indexOf('"', fullTimestamp.length);
    return {
      dateStamp,
      severity: "info",
      section: httpMethods.exec(line)?.[0] ?? "META",
      content: contentStart !== -1 ? line.slice(contentStart).trim() : line,
    };
  }
  return {
    dateStamp,
    severity: "unknown",
    section: "unknown",
    content: line.slice(fullTimestamp.length).trim(),
  };
}

const parsers: Record<LogService, (line: string) => LogLine | null> = {
  frigate: parseFrigate,
  go2rtc: parseGo2rtc,
  nginx: parseNginx,
};

/** One raw line, or null when it holds nothing worth showing. */
export function parseLogLine(
  service: LogService,
  line: string,
): LogLine | null {
  return parsers[service](line);
}
