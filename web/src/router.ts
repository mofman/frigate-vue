import { createRouter, createWebHistory } from "vue-router";
import LiveDashboard from "@/views/LiveDashboard.vue";
import { http } from "@/api/http";
import type { UserProfile } from "@/types/frigate";

declare module "vue-router" {
  interface RouteMeta {
    /** render without the app shell */
    bare?: boolean;
    /** only the admin role may open this page */
    admin?: boolean;
  }
}

export const router = createRouter({
  // window.baseUrl carries an ingress prefix when served behind Home Assistant
  history: createWebHistory(window.baseUrl || "/"),
  routes: [
    { path: "/", name: "dashboard", component: LiveDashboard },
    {
      path: "/camera/:name",
      name: "camera",
      component: () => import("@/views/CameraView.vue"),
      props: true,
    },
    {
      path: "/review",
      name: "review",
      component: () => import("@/views/ReviewView.vue"),
    },
    {
      path: "/system",
      name: "system",
      component: () => import("@/views/SystemView.vue"),
      meta: { admin: true },
    },
    {
      path: "/logs",
      name: "logs",
      component: () => import("@/views/LogsView.vue"),
      meta: { admin: true },
    },
    {
      path: "/config",
      name: "config",
      component: () => import("@/views/ConfigEditor.vue"),
      meta: { admin: true },
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/LoginView.vue"),
      meta: { bare: true },
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: () => import("@/views/NotFound.vue"),
    },
  ],
});

// the role only changes with a new login, which reloads the page
let profile: Promise<UserProfile | undefined> | undefined;

router.beforeEach(async (to) => {
  if (!to.meta.admin) return true;
  profile ??= http.get<UserProfile>("profile").catch(() => undefined);
  const user = await profile;
  return user?.role === "admin" ? true : { name: "dashboard" };
});

// links from the previous interface open a camera as /#camera_name
router.beforeEach((to) => {
  if (to.name === "dashboard" && to.hash.length > 1) {
    const camera = decodeURIComponent(to.hash.slice(1)).split("&")[0];
    if (camera) return { name: "camera", params: { name: camera }, hash: "" };
  }
  return true;
});
