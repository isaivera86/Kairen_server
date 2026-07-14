/* ============================================================
   VALIDADOR DE BOLETOS (híbrido)
   - Online: valida en vivo contra Kairen (varios equipos, sin doble entrada).
   - Offline: usa la lista descargada en el teléfono (IndexedDB) y guarda
     las entradas pendientes para sincronizar cuando vuelva el internet.
   Acepta QR de caja (KRN:<token>) y de bot (KRN:<folio>-<n>).
============================================================ */

let VALIDAR_FUNCION = { eventoId: null, funcionId: null, label: "" };
let qrScanner = null;
let camaraActiva = false;
let ultimoCodigo = "";
let ultimoCodigoTs = 0;

/* ---------- IndexedDB (mini base local) ---------- */
const DB_NOMBRE = "kairenValidador";
let idb = null;

function abrirIDB(){
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NOMBRE, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if(!db.objectStoreNames.contains("boletos")){
                db.createObjectStore("boletos", { keyPath: "codigo" });
            }
            if(!db.objectStoreNames.contains("pendientes")){
                db.createObjectStore("pendientes", { keyPath: "codigo" });
            }
        };
        req.onsuccess = (e) => { idb = e.target.result; resolve(idb); };
        req.onerror = (e) => reject(e);
    });
}

function idbGuardarBoletos(lista){
    return new Promise((resolve) => {
        const tx = idb.transaction("boletos", "readwrite");
        const store = tx.objectStore("boletos");
        store.clear();
        lista.forEach(b => store.put(b));
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}

function idbLeerBoleto(codigo){
    return new Promise((resolve) => {
        const tx = idb.transaction("boletos", "readonly");
        const req = tx.objectStore("boletos").get(codigo);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
    });
}

function idbMarcarUsadoLocal(codigo, ts){
    return new Promise((resolve) => {
        const tx = idb.transaction(["boletos", "pendientes"], "readwrite");
        tx.objectStore("boletos").get(codigo).onsuccess = (e) => {
            const b = e.target.result;
            if(b){ b.usado = ts; tx.objectStore("boletos").put(b); }
        };
        tx.objectStore("pendientes").put({ codigo, ts });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}

function idbContarBoletos(){
    return new Promise((resolve) => {
        const tx = idb.transaction("boletos", "readonly");
        const req = tx.objectStore("boletos").count();
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => resolve(0);
    });
}

function idbLeerPendientes(){
    return new Promise((resolve) => {
        const tx = idb.transaction("pendientes", "readonly");
        const req = tx.objectStore("pendientes").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
    });
}

function idbLimpiarPendientes(){
    return new Promise((resolve) => {
        const tx = idb.transaction("pendientes", "readwrite");
        tx.objectStore("pendientes").clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
    });
}

/* ---------- Panel ---------- */
async function renderPanelValidar(){
    if(!idb){ try{ await abrirIDB(); }catch(e){ /* sin idb, solo online */ } }
    await cargarFuncionesValidar();
    await actualizarContadorValidar();
    pintarConexion();
}

async function cargarFuncionesValidar(){
    const sel = document.getElementById("validarFuncion");
    if(!sel){ return; }
    let eventos = [];
    try{
        const r = await fetch(`${API_URL}/api/eventos`);
        eventos = await r.json();
    }catch(e){ eventos = []; }

    const opciones = [];
    (eventos || []).forEach(ev => {
        (ev.funciones || []).forEach(fn => {
            if((fn.tipoRegistro || "funcion") !== "funcion"){ return; }
            const label = `${ev.nombre} — ${fn.fecha || ""} ${fn.hora || ""}`.trim();
            opciones.push({ eventoId: ev.id, funcionId: fn.id, label });
        });
    });

    sel.innerHTML = opciones.length
        ? opciones.map(o => `<option value="${o.eventoId}|${o.funcionId}">${escaparTexto(o.label)}</option>`).join("")
        : `<option value="">(No hay funciones)</option>`;

    if(opciones.length){
        VALIDAR_FUNCION = { ...opciones[0] };
    }
}

function seleccionarFuncionValidar(){
    const sel = document.getElementById("validarFuncion");
    if(!sel || !sel.value){ return; }
    const [eventoId, funcionId] = sel.value.split("|");
    const label = sel.options[sel.selectedIndex].text;
    VALIDAR_FUNCION = { eventoId, funcionId, label };
}

function pintarConexion(){
    const el = document.getElementById("validarEstadoConexion");
    if(!el){ return; }
    if(navigator.onLine){
        el.innerHTML = `🟢 En línea — validación en vivo`;
        el.className = "validar-conexion online";
    }else{
        el.innerHTML = `🔴 Sin internet — usando lista descargada`;
        el.className = "validar-conexion offline";
    }
}
window.addEventListener("online", pintarConexion);
window.addEventListener("offline", pintarConexion);

/* ---------- Descargar lista (offline) ---------- */
async function descargarBoletosOffline(){
    if(!VALIDAR_FUNCION.funcionId){ mostrarToast("Elige una función primero", "warning"); return; }
    if(!idb){ try{ await abrirIDB(); }catch(e){ mostrarToast("No se pudo abrir el almacén local", "error"); return; } }
    try{
        const r = await fetch(`${API_URL}/api/validar/lista?eventoId=${encodeURIComponent(VALIDAR_FUNCION.eventoId)}&funcionId=${encodeURIComponent(VALIDAR_FUNCION.funcionId)}`);
        const data = await r.json();
        await idbGuardarBoletos(data.boletos || []);
        await actualizarContadorValidar();
        mostrarToast(`⬇️ ${data.total || 0} boletos descargados`, "success");
    }catch(e){
        mostrarToast("No se pudo descargar (¿hay internet?)", "error");
    }
}

async function actualizarContadorValidar(){
    const el = document.getElementById("validarContadorTexto");
    if(!el || !idb){ return; }
    const n = await idbContarBoletos();
    const pend = await idbLeerPendientes();
    el.textContent = `Boletos descargados: ${n}` + (pend.length ? ` · ⏳ ${pend.length} por sincronizar` : "");
}

/* ---------- Validar (híbrido) ---------- */
async function validarCodigo(codigoRaw){
    const codigo = String(codigoRaw || "").replace(/^KRN:/i, "").trim();
    if(!codigo){ return; }

    // Evita doble lectura del mismo QR en 3 seg
    const ahora = Date.now();
    if(codigo === ultimoCodigo && (ahora - ultimoCodigoTs) < 3000){ return; }
    ultimoCodigo = codigo; ultimoCodigoTs = ahora;

    if(navigator.onLine){
        // ONLINE: valida en vivo
        try{
            const r = await fetch(`${API_URL}/api/validar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo })
            });
            const res = await r.json();
            mostrarResultadoValidar(res);
            return;
        }catch(e){
            // si falla la red a media, cae a offline
        }
    }
    // OFFLINE: valida contra la lista local
    await validarOffline(codigo);
}

async function validarOffline(codigo){
    if(!idb){
        mostrarResultadoValidar({ estado: "sin_datos" });
        return;
    }
    const b = await idbLeerBoleto(codigo);
    if(!b){
        mostrarResultadoValidar({ estado: "no_existe" });
        return;
    }
    if(b.usado){
        mostrarResultadoValidar({ estado: "usado", cuando: b.usado, info: { folio: b.folio, nombre: b.nombre, tipo: b.tipo } });
        return;
    }
    const ts = new Date().toISOString();
    await idbMarcarUsadoLocal(codigo, ts);
    await actualizarContadorValidar();
    mostrarResultadoValidar({ estado: "valido", info: { folio: b.folio, nombre: b.nombre, tipo: b.tipo }, offline: true });
}

function validarManual(){
    const inp = document.getElementById("validarManual");
    if(!inp || !inp.value.trim()){ return; }
    validarCodigo(inp.value);
    inp.value = "";
    inp.focus();
}

/* ---------- Resultado visual ---------- */
function mostrarResultadoValidar(res){
    const el = document.getElementById("validarResultado");
    if(!el){ return; }
    let clase = "", icono = "", titulo = "", detalle = "";
    const info = res.info || {};

    if(res.estado === "valido"){
        clase = "res-valido"; icono = "🟢"; titulo = "VÁLIDO — Adelante";
        detalle = `${info.folio || ""} · ${info.nombre || ""}` + (res.offline ? " · (offline)" : "");
        beep(true);
    }else if(res.estado === "usado"){
        clase = "res-usado"; icono = "🔴"; titulo = "YA USADO";
        detalle = `${info.folio || ""} · ${info.nombre || ""}` + (res.cuando ? ` · entró: ${formatearCuando(res.cuando)}` : "");
        beep(false);
    }else if(res.estado === "no_valido"){
        clase = "res-usado"; icono = "⛔"; titulo = "NO VÁLIDO";
        detalle = res.motivo || "Boleto no válido";
        beep(false);
    }else if(res.estado === "sin_datos"){
        clase = "res-nada"; icono = "📥"; titulo = "SIN LISTA OFFLINE";
        detalle = "Descarga los boletos con internet antes de usar sin señal.";
        beep(false);
    }else{
        clase = "res-nada"; icono = "⚠️"; titulo = "NO EXISTE";
        detalle = "Boleto no encontrado.";
        beep(false);
    }

    el.className = `validar-resultado ${clase}`;
    el.innerHTML = `<div class="res-icono">${icono}</div><div class="res-titulo">${titulo}</div><div class="res-detalle">${escaparTexto(detalle)}</div>` +
        `<button class="btn-primario res-nuevo" onclick="nuevoEscaneo()">🔄 Nuevo escaneo</button>`;
}

// Limpia el resultado y prepara el siguiente escaneo
function nuevoEscaneo(){
    const el = document.getElementById("validarResultado");
    if(el){ el.className = "validar-resultado"; el.innerHTML = ""; }
    ultimoCodigo = "";
    ultimoCodigoTs = 0;
    const inp = document.getElementById("validarManual");
    if(inp){ inp.value = ""; inp.focus(); }
}

function formatearCuando(iso){
    try{
        const d = new Date(iso);
        return d.toLocaleString("es-MX", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
    }catch(e){ return iso; }
}

function beep(ok){
    try{
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = ok ? 880 : 220;
        o.start();
        g.gain.setValueAtTime(0.2, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        o.stop(ctx.currentTime + 0.25);
    }catch(e){ /* sin sonido */ }
}

/* ---------- Cámara ---------- */
function toggleCamara(){
    if(camaraActiva){ apagarCamara(); }
    else{ encenderCamara(); }
}

function encenderCamara(){
    if(typeof Html5Qrcode === "undefined"){
        mostrarToast("El escáner aún no carga. Revisa tu internet o usa el folio manual.", "warning");
        return;
    }
    const btn = document.getElementById("btnCamara");
    qrScanner = new Html5Qrcode("qrLector");
    qrScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (texto) => { validarCodigo(texto); },
        () => {}
    ).then(() => {
        camaraActiva = true;
        if(btn){ btn.textContent = "⏹️ Apagar cámara"; }
    }).catch(() => {
        mostrarToast("No se pudo abrir la cámara (permiso denegado)", "error");
    });
}

function apagarCamara(){
    const btn = document.getElementById("btnCamara");
    if(qrScanner){
        qrScanner.stop().then(() => { qrScanner.clear(); }).catch(() => {});
    }
    camaraActiva = false;
    if(btn){ btn.textContent = "📷 Encender cámara"; }
}

/* ---------- Sincronizar ---------- */
async function sincronizarEntradas(){
    if(!idb){ mostrarToast("Nada que sincronizar", "info"); return; }
    if(!navigator.onLine){ mostrarToast("Necesitas internet para sincronizar", "warning"); return; }
    const pend = await idbLeerPendientes();
    if(!pend.length){ mostrarToast("No hay entradas pendientes ✅", "success"); return; }
    try{
        const r = await fetch(`${API_URL}/api/validar/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entradas: pend })
        });
        const res = await r.json();
        await idbLimpiarPendientes();
        await actualizarContadorValidar();
        mostrarToast(`🔄 Sincronizado: ${res.aplicadas} ok, ${res.conflictos} repetidos`, "success");
    }catch(e){
        mostrarToast("No se pudo sincronizar", "error");
    }
}