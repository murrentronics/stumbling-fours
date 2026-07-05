/**
 * Capacitor / Android entry point.
 *
 * Does NOT use TanStack Start's SSR RouterProvider — that renders a full
 * <html><head><body> shell which creates nested document elements inside
 * the WebView and completely breaks native input handling.
 *
 * Instead we wire up TanStack Router in SPA mode (same router, same routes,
 * same auth/store — just no SSR shell) exactly like Bartendaz does.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

// Override the root route's shellComponent so it never renders
// <html><head><body> — on Capacitor the HTML shell is already in
// index.capacitor.html and must not be duplicated.
const queryClient = new QueryClient();

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  // Disable SSR — this is a pure client-side SPA on Android
  defaultSsr: false,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
);
