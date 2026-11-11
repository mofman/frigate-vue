/**
 * Restarting Frigate: the request goes over the websocket, then the app waits
 * for the API to come back and reloads. One app wide state so the account
 * menu and the config editor share the same overlay.
 */
import { readonly, shallowRef } from "vue";
import { baseUrl } from "@/api/baseUrl";
import { http } from "@/api/http";
import { sendWs } from "@/api/ws";

/** the page reloads after this long even if the API never answers */
export const RESTART_TIMEOUT_S = 60;
/** give the server a moment to actually go down before polling */
const POLL_DELAY_MS = 5000;
const POLL_INTERVAL_MS = 2000;

const restarting = shallowRef(false);
const countdown = shallowRef(RESTART_TIMEOUT_S);
const confirming = shallowRef(false);

let tick: ReturnType<typeof setInterval> | undefined;
let poll: ReturnType<typeof setTimeout> | undefined;

function reload() {
  clearInterval(tick);
  clearTimeout(poll);
  window.location.href = baseUrl;
}

async function waitForServer(sawDown: boolean) {
  let down = sawDown;
  try {
    await http.get("version", { allowUnauthorized: true });
    if (down) {
      reload();
      return;
    }
  } catch {
    down = true;
  }
  poll = setTimeout(() => void waitForServer(down), POLL_INTERVAL_MS);
}

/** Send the restart request and show the waiting overlay. */
function restart() {
  if (restarting.value) return;
  confirming.value = false;
  sendWs("restart", "restart");
  restartStarted();
}

/** Show the overlay for a restart the server started itself, eg config save. */
function restartStarted() {
  if (restarting.value) return;
  restarting.value = true;
  countdown.value = RESTART_TIMEOUT_S;
  tick = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) reload();
  }, 1000);
  poll = setTimeout(() => void waitForServer(false), POLL_DELAY_MS);
}

export function useRestart() {
  return {
    restarting: readonly(restarting),
    countdown: readonly(countdown),
    /** whether the confirm dialog is open */
    confirming,
    /** open the confirm dialog */
    requestRestart: () => {
      confirming.value = true;
    },
    restart,
    restartStarted,
    reload,
  };
}
