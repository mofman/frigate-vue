/* eslint-disable no-console */
// Generates small H.264 fixtures for the playback e2e tests: an fMP4 HLS
// recording (10s segments) and a fragmented MP4 used to fake a go2rtc MSE
// live stream. Skipped when ffmpeg is not installed.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", ".media");

export function generateMedia() {
  if (
    existsSync(join(out, "live.mp4")) &&
    existsSync(join(out, "vod", "index.m3u8"))
  )
    return true;
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    console.warn("ffmpeg not found, playback e2e tests will be skipped");
    return false;
  }
  mkdirSync(join(out, "vod"), { recursive: true });
  const common = [
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-level",
    "3.0",
    "-pix_fmt",
    "yuv420p",
    "-g",
    "15",
    "-keyint_min",
    "15",
    "-sc_threshold",
    "0",
    "-b:v",
    "300k",
  ];
  // recordings: colourful moving pattern, 60 seconds in 10 second segments
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=640x360:rate=15",
    "-t",
    "60",
    ...common,
    "-f",
    "hls",
    "-hls_time",
    "10",
    "-hls_segment_type",
    "fmp4",
    "-hls_playlist_type",
    "vod",
    "-hls_fmp4_init_filename",
    "init.mp4",
    "-hls_segment_filename",
    join(out, "vod", "seg_%03d.m4s"),
    join(out, "vod", "index.m3u8"),
  ]);
  // live: a different pattern, fragmented at every keyframe (1 second)
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "smptehdbars=size=640x360:rate=15",
    "-f",
    "lavfi",
    "-i",
    "testsrc=size=160x90:rate=15",
    "-filter_complex",
    "[0][1]overlay=40:40",
    "-t",
    "40",
    ...common,
    "-movflags",
    "frag_keyframe+empty_moov+default_base_moof",
    join(out, "live.mp4"),
  ]);
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) generateMedia();
