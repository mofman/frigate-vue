/** Sends an admin on a fresh install from the dashboard to the setup wizard. */
import { shallowRef, watchEffect } from "vue";
import { useRouter } from "vue-router";
import { useConfig, useProfile } from "@/composables/useFrigate";
import { isSetupDismissed } from "@/utils/setupWizard";

// decided once per load: adding the first camera part way through the wizard
// must not send the user back into it
let decided = false;

export function useFirstRunSetup() {
  const router = useRouter();
  const { data: config, error: configError } = useConfig();
  const { data: profile, error: profileError } = useProfile();
  const pending = shallowRef(!decided);

  watchEffect(() => {
    if (decided) return;
    if (configError.value) {
      decided = true;
      pending.value = false;
      return;
    }
    if (!config.value || (!profile.value && !profileError.value)) return;

    decided = true;
    const firstRun =
      profile.value?.role === "admin" &&
      Object.keys(config.value.cameras ?? {}).length === 0 &&
      !isSetupDismissed();
    if (firstRun) void router.replace({ name: "setup" });
    else pending.value = false;
  });

  return { pending };
}
