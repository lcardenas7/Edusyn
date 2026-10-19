/* Edusyn event push worker. Keep this worker network-free and limited to notifications. */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let message;
  try {
    message = event.data.json();
  } catch {
    message = { title: "Nuevo aviso de Edusyn", body: event.data.text() };
  }
  const title = String(message.title || "Nuevo aviso de Edusyn").slice(0, 80);
  const body = String(message.body || "Tienes una nueva invitación.").slice(
    0,
    180,
  );
  const rawUrl = typeof message.url === "string" ? message.url : "/eventos";
  const safeUrl =
    rawUrl.startsWith("/") && !rawUrl.startsWith("//") ? rawUrl : "/eventos";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/brand/edusyn-icon.png",
      badge: "/brand/favicon.png",
      tag: String(message.tag || "edusyn-notification").slice(0, 100),
      renotify: false,
      data: { url: safeUrl },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification.data && event.notification.data.url;
  const target = new URL(
    typeof rawUrl === "string" &&
      rawUrl.startsWith("/") &&
      !rawUrl.startsWith("//")
      ? rawUrl
      : "/eventos",
    self.location.origin,
  ).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((client) =>
          client.url.startsWith(self.location.origin),
        );
        if (existing) {
          if ("navigate" in existing) existing.navigate(target);
          return existing.focus();
        }
        return self.clients.openWindow(target);
      }),
  );
});
