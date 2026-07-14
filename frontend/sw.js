/* ============================================================
   SERVICE WORKER — Kairen PWA
   Estrategia:
   - HTML y llamadas a /api  -> RED PRIMERO (siempre lo más nuevo;
     si no hay red, usa caché como respaldo).
   - CSS/JS/imágenes         -> CACHÉ PRIMERO (abre rápido),
     pero se actualiza en segundo plano.
   Sube el número de versión (CACHE_VERSION) cada vez que quieras
   forzar que todos reciban lo nuevo.
============================================================ */

const CACHE_VERSION = "kairen-v2";
const CACHE_NAME = `kairen-cache-${CACHE_VERSION}`;

// Al instalar, no bloqueamos nada; activamos de inmediato.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Al activar, borra cachés viejos de versiones anteriores.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(
        claves.filter((c) => c !== CACHE_NAME).map((c) => caches.delete(c))
      )
    ).then(() => self.clients.claim())
  );
});

function esHTML(req){
  return req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if(req.method !== "GET"){ return; }

  const url = new URL(req.url);

  // API y HTML -> RED PRIMERO (nunca versiones viejas de datos/página)
  if(esHTML(req) || url.pathname.startsWith("/api/")){
    event.respondWith(
      fetch(req)
        .then((resp) => {
          // Guarda copia del HTML por si luego no hay red
          if(esHTML(req)){
            const copia = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copia));
          }
          return resp;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // Recursos (css/js/img) -> CACHÉ PRIMERO + actualiza en segundo plano
  event.respondWith(
    caches.match(req).then((cacheado) => {
      const red = fetch(req).then((resp) => {
        if(resp && resp.status === 200){
          const copia = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copia));
        }
        return resp;
      }).catch(() => cacheado);
      return cacheado || red;
    })
  );
});

/* ---------- Notificaciones push ---------- */
self.addEventListener("push", (event) => {
  let datos = { title: "Kairen 🔔", body: "Tienes una notificación" };
  try{
    if(event.data){ datos = event.data.json(); }
  }catch(e){ /* usa el default */ }

  event.waitUntil(
    self.registration.showNotification(datos.title || "Kairen 🔔", {
      body: datos.body || "",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      tag: "kairen-notif"
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for(const c of lista){
        if("focus" in c){ return c.focus(); }
      }
      if(clients.openWindow){ return clients.openWindow("./index.html"); }
    })
  );
});