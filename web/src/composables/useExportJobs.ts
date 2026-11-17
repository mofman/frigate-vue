/**
 * Queued and running export jobs, shared app wide. Progress arrives on the
 * `job_state` websocket topic; a slow poll backs it up because the server
 * stops broadcasting to a client once none of its jobs are left.
 */
import { computed, shallowRef } from "vue";
import { http } from "@/api/http";
import { invalidate } from "@/api/query";
import { onWsMessage } from "@/api/ws";
import { showToast } from "@/composables/useToast";
import { useT } from "@/composables/useT";
import type { ExportJob, JobState } from "@/types/export";

const POLL_MS = 4000;

const jobs = shallowRef<ExportJob[]>([]);
let poll: (() => Promise<void>) | undefined;

/** Start following export jobs. Called once from the app shell. */
export function startExportJobs() {
  const { t } = useT(["views/app"]);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function report(ids: string[]) {
    const results = await Promise.all(
      ids.map((id) =>
        http.get<ExportJob>(`jobs/export/${id}`).catch(() => undefined),
      ),
    );
    const link = { label: t("export.view"), to: "/export" };
    const failed = results.filter((job) => job?.status === "failed").length;
    const done = ids.length - failed;
    if (done)
      showToast(t("export.ready", { count: done }), "success", 6000, link);
    if (failed)
      showToast(t("export.jobFailed", { count: failed }), "error", 8000, link);
  }

  function update(next: ExportJob[]) {
    const current = new Set(next.map((job) => job.id));
    const known = new Set(jobs.value.map((job) => job.id));
    const finished = [...known].filter((id) => !current.has(id));
    const added = next.some((job) => !known.has(job.id));
    jobs.value = next;
    // new and finished jobs both change what the exports list shows
    if (added || finished.length) {
      invalidate("exports");
      invalidate("cases");
    }
    if (finished.length) void report(finished);
    schedule();
  }

  function schedule() {
    if (timer || !jobs.value.length) return;
    timer = setTimeout(() => void poll?.(), POLL_MS);
  }

  poll = async () => {
    clearTimeout(timer);
    timer = undefined;
    try {
      update(await http.get<ExportJob[]>("jobs/export"));
    } catch {
      // keep what we have, the next poll or broadcast corrects it
      schedule();
    }
  };

  onWsMessage<JobState>("job_state", (state) => {
    const entry = state?.export;
    if (entry) update(entry.results?.jobs ?? []);
  });

  void poll();
}

export function useExportJobs() {
  return {
    jobs: computed(() => jobs.value),
    count: computed(() => jobs.value.length),
  };
}

/** Ask for a fresh job list now, eg right after queueing an export. */
export function refreshExportJobs() {
  void poll?.();
}
