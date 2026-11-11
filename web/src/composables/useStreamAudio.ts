/**
 * What a go2rtc stream can do with audio: play it (camera has a speaker
 * track we can receive) and two way talk (camera accepts our microphone).
 */
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@/api/query";
import type { Go2rtcStream } from "@/types/frigate";

export function useStreamAudio(stream: MaybeRefOrGetter<string | undefined>) {
  const { data } = useQuery<Go2rtcStream>(
    () => {
      const name = toValue(stream);
      return name ? `go2rtc/streams/${encodeURIComponent(name)}` : null;
    },
    { staleTime: 5 * 60_000, revalidateOnFocus: false },
  );

  const medias = computed(() =>
    (data.value?.producers ?? []).flatMap((producer) => producer.medias ?? []),
  );

  return {
    audioOutput: computed(() =>
      medias.value.some((media) => media.includes("audio, recvonly")),
    ),
    // microphone access only exists in a secure context
    twoWayTalk: computed(
      () =>
        window.isSecureContext &&
        "mediaDevices" in navigator &&
        medias.value.some((media) => media.includes("audio, sendonly")),
    ),
  };
}
