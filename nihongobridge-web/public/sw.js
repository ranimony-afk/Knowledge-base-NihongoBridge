self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(payload.title || "NihongoBridge study reminder", {
      body: payload.body || "Your review cards are ready.",
      data: { url: payload.url || "/dashboard" },
      tag: "nihongobridge-study-reminder",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => client.url.includes(url));
      return existing ? existing.focus() : clients.openWindow(url);
    }),
  );
});
