import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@/styles/base.css";
import "@/styles/tokens.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router";
import { setupI18n } from "./i18n";
import { http } from "./api/http";
import { startWs } from "./api/ws";

async function bootstrap() {
  const i18n = setupI18n();

  // a 401 here redirects to login (unless we are already there)
  const onLogin = window.location.pathname.endsWith("/login");
  if (!onLogin) {
    void http.get("profile").then(startWs, () => undefined);
  }

  await i18n.catch(() => undefined);
  createApp(App).use(createPinia()).use(router).mount("#app");
}

void bootstrap();
