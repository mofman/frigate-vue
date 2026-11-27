<script setup lang="ts">
/** Secures the admin account and optionally adds more users. */
import { computed, shallowRef } from "vue";
import { CircleCheck } from "@lucide/vue";
import { errorMessage, http } from "@/api/http";
import { invalidate, useQuery } from "@/api/query";
import AppButton from "@/components/ui/AppButton.vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
import { useProfile } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import CreateUserDialog, { type NewUser } from "./CreateUserDialog.vue";
import SetPasswordDialog from "./SetPasswordDialog.vue";
import SetupNote from "./SetupNote.vue";
import SetupRow from "./SetupRow.vue";
import SetupStep from "./SetupStep.vue";

type User = { username: string; role: string };

defineEmits<{ back: []; skip: []; next: [] }>();

const { t } = useT(["views/setup"]);
const { data: profile } = useProfile();
const {
  data: users,
  error: usersError,
  isLoading,
} = useQuery<User[]>("users", { revalidateOnFocus: false });

// the internal port has no signed in user, so the built-in admin is the
// account being secured
const signedIn = computed(
  () => !!profile.value?.username && profile.value.username !== "anonymous",
);
const adminUsername = computed(() =>
  signedIn.value ? profile.value!.username : "admin",
);
const otherUsers = computed(() =>
  (users.value ?? []).filter((user) => user.username !== adminUsername.value),
);

const passwordOpen = shallowRef(false);
const passwordSaving = shallowRef(false);
const passwordFailure = shallowRef<string>();
const passwordSet = shallowRef(false);
const createOpen = shallowRef(false);
const createSaving = shallowRef(false);
const createFailure = shallowRef<string>();

function openPassword() {
  passwordFailure.value = undefined;
  passwordOpen.value = true;
}

function openCreate() {
  createFailure.value = undefined;
  createOpen.value = true;
}

async function savePassword(password: string) {
  passwordSaving.value = true;
  passwordFailure.value = undefined;
  try {
    await http.put(
      `users/${encodeURIComponent(adminUsername.value)}/password`,
      { password },
    );
    passwordSet.value = true;
    passwordOpen.value = false;
  } catch (error) {
    passwordFailure.value = errorMessage(error);
  } finally {
    passwordSaving.value = false;
  }
}

async function createUser(user: NewUser) {
  createSaving.value = true;
  createFailure.value = undefined;
  try {
    await http.post("users", user);
    createOpen.value = false;
    invalidate("users");
  } catch (error) {
    createFailure.value =
      errorMessage(error) || t("setupWizard.account.userFailed");
  } finally {
    createSaving.value = false;
  }
}
</script>

<template>
  <SetupStep
    :title="t('setupWizard.account.title')"
    :description="
      signedIn
        ? t('setupWizard.account.descriptionSignedIn', {
            username: adminUsername,
          })
        : t('setupWizard.account.descriptionAnonymous')
    "
    can-skip
    @back="$emit('back')"
    @skip="$emit('skip')"
    @next="$emit('next')"
  >
    <div class="setup-account__users">
      <SetupRow
        :label="adminUsername"
        :detail="passwordSet ? t('setupWizard.account.passwordSet') : undefined"
      >
        <CircleCheck v-if="passwordSet" class="is-ok" :size="16" />
        <AppButton size="sm" @click="openPassword">
          {{ t("setupWizard.account.changePassword") }}
        </AppButton>
      </SetupRow>
      <SetupRow
        v-for="user in otherUsers"
        :key="user.username"
        :label="user.username"
      >
        {{ user.role }}
      </SetupRow>
      <LoadingSpinner v-if="isLoading" class="setup-account__spinner" />
    </div>
    <SetupNote v-if="usersError">
      {{ t("setupWizard.account.usersFailed") }}
    </SetupNote>
    <AppButton @click="openCreate">
      {{ t("setupWizard.account.addUser") }}
    </AppButton>

    <SetPasswordDialog
      v-model:open="passwordOpen"
      :saving="passwordSaving"
      :error="passwordFailure"
      @save="savePassword"
    />
    <CreateUserDialog
      v-model:open="createOpen"
      :saving="createSaving"
      :error="createFailure"
      @create="createUser"
    />
  </SetupStep>
</template>

<style scoped>
.setup-account__users {
  display: grid;
  gap: 8px;
}

.setup-account__spinner {
  justify-self: center;
}
</style>
