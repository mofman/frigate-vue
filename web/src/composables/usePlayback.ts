/**
 * Playback state for the camera view, shared by the stage, timeline and
 * controls. The stage owns the media and reports time back; everything else
 * only issues intents (go live, seek, scrub).
 */
import { computed, readonly, shallowRef } from "vue";
import {
  clampScrub,
  modeForTarget,
  type PlaybackMode,
} from "@/players/playback";

export type SeekRequest = { id: number; time: number; play: boolean };

export type SeekOptions = {
  /**
   * The user moved the playhead, so views showing it should bring it into
   * view. Off for seeks the player makes on its own, eg looping a preview.
   */
  reveal?: boolean;
};

export function usePlayback(
  options: { initialMode?: PlaybackMode; initialTime?: number } = {},
) {
  const now = () => Date.now() / 1000;

  const mode = shallowRef<PlaybackMode>(options.initialMode ?? "live");
  /** wall clock time of what is on screen (live: now) */
  const time = shallowRef(options.initialTime ?? now());
  const playing = shallowRef(true);
  /** recorded playback speed, back to 1x whenever we return to live */
  const rate = shallowRef(1);
  const scrubbing = shallowRef(false);
  const scrubTime = shallowRef(time.value);
  /** newest recorded instant reported by the recording player */
  const recordedUntil = shallowRef<number>();
  const seekRequest = shallowRef<SeekRequest>({
    id: 0,
    time: time.value,
    play: true,
  });
  /** earliest time the timeline allows */
  const earliest = shallowRef(now() - 24 * 3600);
  /** bumped whenever the user moves the playhead (seek, scrub, go live) */
  const revealRequest = shallowRef(0);

  let wasPlaying = true;

  function request(target: number, play: boolean) {
    seekRequest.value = { id: seekRequest.value.id + 1, time: target, play };
  }

  function enterLive() {
    scrubbing.value = false;
    mode.value = "live";
    playing.value = true;
    rate.value = 1;
    time.value = now();
  }

  function goLive() {
    enterLive();
    revealRequest.value++;
  }

  /** Jump to a time. Lands in live when the target is close enough to now. */
  function seek(
    target: number,
    play = true,
    { reveal = true }: SeekOptions = {},
  ) {
    if (reveal) revealRequest.value++;
    const next = modeForTarget(mode.value, target, now(), recordedUntil.value);
    if (next === "live") {
      enterLive();
      return;
    }
    mode.value = "recording";
    playing.value = play;
    time.value = target;
    request(target, play);
  }

  function beginScrub() {
    if (scrubbing.value) return;
    wasPlaying = playing.value;
    scrubbing.value = true;
    scrubTime.value = time.value;
  }

  function scrubTo(target: number) {
    scrubTime.value = clampScrub(target, now(), earliest.value);
  }

  /** Release the scrub, committing the mode once rather than on every move. */
  function endScrub() {
    if (!scrubbing.value) return;
    scrubbing.value = false;
    seek(scrubTime.value, wasPlaying || mode.value === "live");
  }

  /** Stage reports the current frame time. */
  function reportTime(value: number) {
    if (mode.value === "recording" && !scrubbing.value) time.value = value;
  }

  function setPlaying(value: boolean) {
    playing.value = value;
  }

  function setRate(value: number) {
    rate.value = value;
  }

  /** Recorded media ran out at the window end. */
  function reportEnded() {
    // caught up with the edge of recordings, the natural next frame is live
    if (now() - time.value < 60) enterLive();
    else seek(time.value + 1, true, { reveal: false });
  }

  return {
    mode: readonly(mode),
    time: readonly(time),
    playing: readonly(playing),
    rate: readonly(rate),
    scrubbing: readonly(scrubbing),
    scrubTime: readonly(scrubTime),
    seekRequest: readonly(seekRequest),
    revealRequest: readonly(revealRequest),
    recordedUntil,
    earliest,
    /** the time the UI should display: scrub target while dragging */
    displayTime: computed(() =>
      scrubbing.value ? scrubTime.value : time.value,
    ),
    isLive: computed(() => mode.value === "live" && !scrubbing.value),
    goLive,
    seek,
    beginScrub,
    scrubTo,
    endScrub,
    reportTime,
    reportEnded,
    setPlaying,
    setRate,
  };
}

export type Playback = ReturnType<typeof usePlayback>;
