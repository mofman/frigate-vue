<script setup lang="ts">
/** Adds a Frigate user with a role. */
import { computed, shallowRef, useId, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import SelectField from "@/components/ui/SelectField.vue";
import TextField from "@/components/ui/TextField.vue";
import { useConfig } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import {
  confirmPasswordError,
  passwordError,
  usernameError,
} from "@/utils/setupConfig";

export type NewUser = { username: string; password: string; role: string };

defineProps<{ saving?: boolean; error?: string }>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ create: [user: NewUser] }>();

const { t } = useT(["views/settings", "common"]);
const { data: config } = useConfig();
const formId = useId();
const username = shallowRef("");
const password = shallowRef("");
const confirm = shallowRef("");
const role = shallowRef("viewer");
const submitted = shallowRef(false);

watch(open, (value) => {
  if (!value) return;
  username.value = "";
  password.value = "";
  confirm.value = "";
  role.value = "viewer";
  submitted.value = false;
});

const roles = computed(() =>
  [
    ...new Set([
      "admin",
      "viewer",
      ...Object.keys(config.value?.auth?.roles ?? {}),
    ]),
  ].map((value) => ({
    value,
    label:
      value === "admin"
        ? t("common:role.admin")
        : value === "viewer"
          ? t("common:role.viewer")
          : value,
  })),
);

const usernameKey = computed(() => usernameError(username.value));
const passwordKey = computed(() => passwordError(password.value));
const confirmKey = computed(() =>
  confirmPasswordError(password.value, confirm.value),
);

function submit() {
  submitted.value = true;
  if (usernameKey.value || passwordKey.value || confirmKey.value) return;
  emit("create", {
    username: username.value,
    password: password.value,
    role: role.value,
  });
}
</script>

<template>
  <AppDialog v-model:open="open" :title="t('users.dialog.createUser.title')">
    <form :id="formId" class="account-form" novalidate @submit.prevent="submit">
      <p>{{ t("users.dialog.createUser.desc") }}</p>
      <TextField
        v-model="username"
        autocomplete="off"
        :label="t('users.dialog.form.user.title')"
        :placeholder="t('users.dialog.form.user.placeholder')"
        :hint="t('users.dialog.form.user.desc')"
        :error="submitted && usernameKey ? t(usernameKey) : undefined"
      />
      <TextField
        v-model="password"
        type="password"
        autocomplete="new-password"
        :label="t('users.dialog.form.password.title')"
        :placeholder="t('users.dialog.form.password.placeholder')"
        :hint="t('users.dialog.form.password.requirements.length')"
        :show-label="t('users.dialog.form.password.show')"
        :hide-label="t('users.dialog.form.password.hide')"
        :error="submitted && passwordKey ? t(passwordKey) : undefined"
      />
      <TextField
        v-model="confirm"
        type="password"
        autocomplete="new-password"
        :label="t('users.dialog.form.password.confirm.title')"
        :placeholder="t('users.dialog.form.password.confirm.placeholder')"
        :show-label="t('users.dialog.form.password.show')"
        :hide-label="t('users.dialog.form.password.hide')"
        :error="submitted && confirmKey ? t(confirmKey) : undefined"
      />
      <SelectField
        v-model="role"
        :label="t('common:role.title')"
        :options="roles"
        :hint="t('common:role.desc')"
      />
      <p v-if="error" class="account-form__error" role="alert">{{ error }}</p>
    </form>
    <template #actions>
      <AppButton @click="open = false">
        {{ t("common:button.cancel") }}
      </AppButton>
      <AppButton
        type="submit"
        variant="primary"
        :form="formId"
        :disabled="saving"
      >
        {{ saving ? t("common:button.saving") : t("common:button.save") }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.account-form {
  display: grid;
  gap: 12px;

  > p {
    font-size: var(--text-md);
    color: var(--text-secondary);
  }
}

.account-form > .account-form__error {
  color: var(--danger);
}
</style>
