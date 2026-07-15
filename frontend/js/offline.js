/* ============================================================
   COLA OFFLINE
   Si creas un registro/evento SIN internet, se guarda en el
   teléfono (IndexedDB) y se sube solo al reconectar (o con el
   botón "Subir"). Muestra una barra con los pendientes.
============================================================ */

const OFF_DB_NOMBRE = "kairenOffline";
let offDb = null;

function offAbrir(){
    return new Promise((resolve, reject) => {
        const r = indexedDB.open(OFF_DB_NOMBRE, 3);
        r.onupgradeneeded = (e) => {
            const db = e.target.result;
            if(!db.objectStoreNames.contains("cola")){
                db.createObjectStore("cola", { keyPath: "id" });
            }
            if(!db.objectStoreNames.contains("cache")){
                db.createObjectStore("cache", { keyPath: "clave" });
            }
        };
        r.onsuccess = (e) => {
            offDb = e.target.result;
            // Si por alguna razón falta el almacén cache, forzamos upgrade
            if(!offDb.objectStoreNames.contains("cache")){
                const ver = offDb.version + 1;
                offDb.close();
                const r2 = indexedDB.open(OFF_DB_NOMBRE, ver);
                r2.onupgradeneeded = (ev) => {
                    const db2 = ev.target.result;
                    if(!db2.objectStoreNames.contains("cola")){
                        db2.createObjectStore("cola", { keyPath: "id" });
                    }
                    if(!db2.objectStoreNames.contains("cache")){
                        db2.createObjectStore("cache", { keyPath: "clave" });
                    }
                };
                r2.onsuccess = (ev) => { offDb = ev.target.result; resolve(offDb); };
                r2.onerror = (ev) => reject(ev);
                return;
            }
            resolve(offDb);
        };
        r.onerror = (e) => reject(e);
        r.onblocked = () => { /* otra pestaña la tiene abierta; esperamos */ };
    });
}

/* Caché de datos (eventos, etc.) para verlos sin internet */
async function offCacheGuardar(clave, valor){
    if(!offDb){ try{ await offAbrir(); }catch(e){ return; } }
    return new Promise((resolve) => {
        try{
            const tx = offDb.transaction("cache", "readwrite");
            tx.objectStore("cache").put({ clave, valor });
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        }catch(e){ resolve(); }
    });
}

async function offCacheLeer(clave){
    if(!offDb){ try{ await offAbrir(); }catch(e){ return null; } }
    return new Promise((resolve) => {
        try{
            const tx = offDb.transaction("cache", "readonly");
            const rq = tx.objectStore("cache").get(clave);
            rq.onsuccess = () => resolve(rq.result ? rq.result.valor : null);
            rq.onerror = () => resolve(null);
        }catch(e){ resolve(null); }
    });
}

async function offGuardar(item){
    if(!offDb){ try{ await offAbrir(); }catch(e){ return; } }
    return new Promise((resolve) => {
        const tx = offDb.transaction("cola", "readwrite");
        tx.objectStore("cola").put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}

async function offListar(){
    if(!offDb){ try{ await offAbrir(); }catch(e){ return []; } }
    return new Promise((resolve) => {
        const tx = offDb.transaction("cola", "readonly");
        const rq = tx.objectStore("cola").getAll();
        rq.onsuccess = () => resolve(rq.result || []);
        rq.onerror = () => resolve([]);
    });
}

async function offBorrar(id){
    if(!offDb){ try{ await offAbrir(); }catch(e){ return; } }
    return new Promise((resolve) => {
        const tx = offDb.transaction("cola", "readwrite");
        tx.objectStore("cola").delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}

// Encola una creación pendiente
async function encolarCreacion(url, body, resumen){
    const item = {
        id: "off_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        url, body, resumen,
        ts: new Date().toISOString()
    };
    await offGuardar(item);
    actualizarBarraPendientes();
    return item;
}

/* Intenta crear online; si no hay red o falla, lo encola.
   Devuelve { ok, online } */
async function crearConCola(url, body, resumen){
    if(navigator.onLine){
        try{
            const r = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            if(!r.ok){ throw new Error("no ok"); }
            const data = await r.json().catch(() => ({}));
            return { ok: true, online: true, data };
        }catch(e){ /* cae a la cola */ }
    }
    await encolarCreacion(url, body, resumen);
    return { ok: true, online: false };
}

/* Sube todo lo pendiente */
async function sincronizarCola(silencioso){
    if(!navigator.onLine){
        if(!silencioso && typeof mostrarToast === "function"){
            mostrarToast("Sin internet para subir", "warning");
        }
        return;
    }
    const items = await offListar();
    if(!items.length){
        if(!silencioso && typeof mostrarToast === "function"){
            mostrarToast("No hay pendientes ✅", "success");
        }
        return;
    }
    let subidos = 0;
    for(const it of items){
        try{
            const r = await fetch(it.url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(it.body)
            });
            if(r.ok){ await offBorrar(it.id); subidos++; }
        }catch(e){ /* se queda para el próximo intento */ }
    }
    actualizarBarraPendientes();
    if(subidos && typeof mostrarToast === "function"){
        mostrarToast(`⬆️ ${subidos} pendiente(s) subido(s)`, "success");
    }
    if(subidos){
        if(typeof cargarEventos === "function"){ try{ cargarEventos(); }catch(e){} }
        if(typeof cargarAgenda === "function"){ try{ cargarAgenda(); }catch(e){} }
        if(typeof renderAgenda === "function"){ try{ renderAgenda(); }catch(e){} }
    }
}

/* Devuelve los pendientes cuyo URL coincide (para pintarlos en las listas) */
async function offPendientesPorTipo(fragmentoUrl){
    const items = await offListar();
    return items.filter(it => (it.url || "").includes(fragmentoUrl));
}

/* Barra flotante con el conteo de pendientes */
async function actualizarBarraPendientes(){
    const items = await offListar();
    let barra = document.getElementById("barraPendientes");

    if(!items.length){
        if(barra){ barra.remove(); }
        return;
    }
    if(!barra){
        barra = document.createElement("div");
        barra.id = "barraPendientes";
        barra.className = "barra-pendientes";
        document.body.appendChild(barra);
    }
    const online = navigator.onLine;
    barra.innerHTML = `
        <span>⏳ ${items.length} sin subir</span>
        <button onclick="sincronizarCola()" ${online ? "" : "disabled"}>
            ${online ? "Subir ahora" : "Sin internet"}
        </button>
    `;
}

/* Al reconectar, sube solo */
window.addEventListener("online", () => {
    actualizarBarraPendientes();
    sincronizarCola(true);
});
window.addEventListener("offline", () => {
    actualizarBarraPendientes();
});
window.addEventListener("load", () => {
    actualizarBarraPendientes();
    if(navigator.onLine){ sincronizarCola(true); }
});