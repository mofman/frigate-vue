<script setup lang="ts">
/** Username and password login. The server sets the session cookie. */
import { shallowRef } from "vue";
import logo from "@/assets/logo.svg";
import { http, HttpError, postLoginUrl } from "@/api/http";
import { useT } from "@/composables/useT";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";

const { t } = useT(["views/app"]);
const user = shallowRef("");
const password = shallowRef("");
const pending = shallowRef(false);
const error = shallowRef<string>();

async function submit() {
  if (pending.value) return;
  pending.value = true;
  error.value = undefined;
  try {
    await http.post(
      "login",
      { user: user.value, password: password.value },
      { allowUnauthorized: true },
    );
  } catch (err) {
    pending.value = false;
    error.value =
      err instanceof HttpError && err.status === 401
        ? t("login.invalid")
        : err instanceof HttpError && err.status === 429
          ? t("login.rateLimited")
          : t("login.failed");
    return;
  }
  window.location.href = postLoginUrl();
}
</script>

<template>
  <div class="login">
    <form class="login__card" @submit.prevent="submit">
      <img class="login__logo" :src="logo" alt="" />
      <h1 class="login__title">{{ t("login.title") }}</h1>
      <label class="login__field">
        <span>{{ t("login.user") }}</span>
        <input v-model="user" autocomplete="username" autofocus required />
      </label>
      <label class="login__field">
        <span>{{ t("login.password") }}</span>
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        />
      </label>
      <p v-if="error" class="login__error" role="alert">{{ error }}</p>
      <button type="submit" class="login__submit" :disabled="pending">
        <LoadingSpinner v-if="pending" :size="14" :delay="0" />
        {{ t("login.submit") }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login {
  display: grid;
  place-items: center;
  min-block-size: 100dvh;
  padding: 16px;
}

.login__card {
  display: grid;
  gap: 16px;
  inline-size: min(100%, 360px);
  padding: 32px 28px;
  border-radius: var(--radius);
  border: 1px solid var(--glass-border);
  background: var(--bg-panel);
  box-shadow: var(--shadow-popover);
  backdrop-filter: blur(12px);
}

.login__logo {
  inline-size: 48px;
  margin-inline: auto;
}

.login__title {
  text-align: center;
  font-size: var(--text-lg);
  font-weight: 600;
}

.login__field {
  display: grid;
  gap: 6px;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);

  input {
    block-size: 40px;
    padding-inline: 12px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--glass-border);
    background: var(--bg-deep);
    font-size: var(--text-base);
    color: var(--text-primary);
    transition: border-color var(--dur);

    &:focus {
      outline: none;
      border-color: var(--accent);
    }
  }
}

.login__error {
  font-size: var(--text-sm);
  color: var(--danger);
}

.login__submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  block-size: 40px;
  border-radius: var(--radius-xs);
  background: var(--accent-strong);
  color: var(--text-on-media);
  font-weight: 600;
  transition: filter var(--dur);

  &:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  &:disabled {
    opacity: 0.7;
  }
}
</style>
