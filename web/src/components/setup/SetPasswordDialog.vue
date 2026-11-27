<script setup lang="ts">
/** Sets a new password. The wizard runs as admin, who needs no current one. */
import { computed, shallowRef, useId, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import TextField from "@/components/ui/TextField.vue";
import { useT } from "@/composables/useT";
import { confirmPasswordError, passwordError } from "@/utils/setupConfig";

defineProps<{ saving?: boolean; error?: string }>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ save: [password: string] }>();

const { t } = useT(["views/settings", "common"]);
const formId = useId();
const password = shallowRef("");
const confirm = shallowRef("");
const submitted = shallowRef(false);

watch(open, (value) => {
  if (!value) return;
  password.value = "";
  confirm.value = "";
  submitted.value = false;
});

const passwordKey = computed(() => passwordError(password.value));
const confirmKey = computed(() =>
  confirmPasswordError(password.value, confirm.value),
);

function submit() {
  submitted.value = true;
  if (!passwordKey.value && !confirmKey.value) emit("save", password.value);
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    :title="t('users.dialog.passwordSetting.setPassword')"
  >
    <form :id="formId" class="account-form" novalidate @submit.prevent="submit">
      <p>{{ t("users.dialog.passwordSetting.desc") }}</p>
      <TextField
        v-model="password"
        type="password"
        autocomplete="new-password"
        :label="t('users.dialog.form.newPassword.title')"
        :placeholder="t('users.dialog.form.newPassword.placeholder')"
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
        :placeholder="t('users.dialog.form.newPassword.confirm.placeholder')"
        :show-label="t('users.dialog.form.password.show')"
        :hide-label="t('users.dialog.form.password.hide')"
        :error="submitted && confirmKey ? t(confirmKey) : undefined"
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
