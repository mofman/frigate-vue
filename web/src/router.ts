import { createRouter, createWebHistory } from "vue-router";
import LiveDashboard from "@/views/LiveDashboard.vue";

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

// links from the previous interface open a camera as /#camera_name
router.beforeEach((to) => {
  if (to.name === "dashboard" && to.hash.length > 1) {
    const camera = decodeURIComponent(to.hash.slice(1)).split("&")[0];
    if (camera) return { name: "camera", params: { name: camera }, hash: "" };
  }
  return true;
});
