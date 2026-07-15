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

const CACHE_VERSION = "kairen-v11";
const CACHE_NAME = `kairen-cache-${CACHE_VERSION}`;

// Archivos esenciales que se guardan al instalar (para funcionar offline)
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "css/base.css",
  "css/layout.css",
  "css/componentes.css",
  "css/dashboard.css",
  "css/eventos.css",
  "css/agenda.css",
  "css/alpha-v1-1-operaciones.css",
  "css/alpha-v1-2-nuevo-registro.css",
  "css/funciones.css",
  "css/modales.css",
  "css/responsive.css",
  "css/theme-dark-premium.css",
  "css/ui-premium.css",
  "css/sidebar-header-compact.css",
  "css/mobile-real-drawer-compact.css",
  "css/registros-engine.css",
  "css/safe-area.css",
  "js/state.js",
  "js/dashboard.js",
  "js/agenda.js",
  "js/registros.js",
  "js/utils.js",
  "js/ui.js",
  "js/configuracion.js",
  "js/descuentos.js",
  "js/funciones.js",
  "js/eventos.js",
  "js/caja.js",
  "js/bot.js",
  "js/reservas.js",
  "js/validar.js",
  "js/calendario.js",
  "js/push.js",
  "js/offline.js",
  "js/modales.js",
  "js/app.js",
  "js/mobile-menu.js",
  "js/sidebar-controls.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png"
];

// Al instalar: guarda los archivos esenciales (uno por uno, sin romper si
// alguno falla) y activa de inmediato.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(url).catch(() => { /* si alguno falla, seguimos */ })
        )
      )
    ).then(() => self.skipWaiting())
  );
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

  // Solo manejamos peticiones de NUESTRO origen. Las de otros dominios
  // (CDN, push, etc.) las dejamos pasar directo al navegador.
  if(url.origin !== self.location.origin){ return; }

  // API y HTML -> RED PRIMERO (nunca versiones viejas de datos/página)
  if(esHTML(req) || url.pathname.startsWith("/api/")){
    event.respondWith(
      fetch(req)
        .then((resp) => {
          if(esHTML(req) && resp && resp.ok){
            const copia = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copia));
          }
          return resp;
        })
        .catch(async () => {
          const cache = await caches.match(req);
          if(cache){ return cache; }
          if(esHTML(req)){
            const idx = await caches.match("./index.html");
            if(idx){ return idx; }
          }
          return new Response("", { status: 504, statusText: "Sin conexion" });
        })
    );
    return;
  }

  // Recursos (css/js/img) -> CACHÉ PRIMERO + actualiza en segundo plano
  event.respondWith(
    caches.match(req).then((cacheado) => {
      if(cacheado){
        // Refresca en segundo plano sin bloquear
        fetch(req).then((resp) => {
          if(resp && resp.status === 200){
            const copia = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copia));
          }
        }).catch(() => {});
        return cacheado;
      }
      // No estaba en caché: ve a la red y guarda
      return fetch(req).then((resp) => {
        if(resp && resp.status === 200){
          const copia = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copia));
        }
        return resp;
      }).catch(() => new Response("", { status: 504, statusText: "Sin conexion" }));
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