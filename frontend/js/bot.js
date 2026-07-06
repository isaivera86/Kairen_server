/* ============================================================
   PANEL DEL BOT (sección "🤖 Bot")
   - Estado de conexión + QR (reportado por el bot).
   - Precios y mensajes (los lee el bot desde Kairen).
   - Eventos reales con switch de "mostrar en el bot".
============================================================ */

let BOT_CONFIG_KEYS = [];

const BOT_MSG_LABELS = {
    menu: "Menú / saludo inicial",
    confirmacion_venta: "Confirmación de venta (WhatsApp)"
};

async function renderPanelBot(){
    await Promise.all([cargarEstadoBot(), cargarConfigBot(), renderEventosBot()]);
}

/* ---- Logo del boleto ---- */

let BOT_LOGO_URL = "";

function pintarLogoPreview(){
    const prev = document.getElementById("botLogoPreview");
    if(!prev){ return; }
    if(BOT_LOGO_URL){
        prev.innerHTML = `<img src="${BOT_LOGO_URL}" alt="logo">`;
    }else{
        prev.textContent = "Sin logo";
    }
}

async function subirLogoBot(input){
    const file = input.files && input.files[0];
    if(!file){ return; }
    const reader = new FileReader();
    reader.onload = async () => {
        try{
            const r = await fetch(`${API_URL}/api/upload`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dataUrl: reader.result, nombre: file.name })
            });
            const data = await r.json();
            if(!r.ok || !data.url){ throw new Error("upload falló"); }
            BOT_LOGO_URL = data.url;
            pintarLogoPreview();
            await guardarLogoBot();
            mostrarToast("Logo actualizado ✅", "success");
        }catch(e){
            mostrarToast("No se pudo subir el logo", "error");
        }
    };
    reader.readAsDataURL(file);
}

async function quitarLogoBot(){
    BOT_LOGO_URL = "";
    pintarLogoPreview();
    await guardarLogoBot();
    mostrarToast("Logo quitado", "success");
}

async function guardarLogoBot(){
    try{
        await fetch(`${API_URL}/api/bot/config`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ logo: BOT_LOGO_URL })
        });
    }catch(e){ /* se reintenta al guardar config */ }
}

async function cargarEstadoBot(){
    const cont = document.getElementById("botEstado");
    if(!cont){ return; }

    let est = { estado: "desconocido", qr: null, ts: null };
    try{
        const r = await fetch(`${API_URL}/api/bot/estado`);
        est = await r.json();
    }catch(e){ /* deja default */ }

    const mapa = {
        conectado:    { icono: "🟢", texto: "Conectado", clase: "ok" },
        esperando_qr: { icono: "🟡", texto: "Esperando QR", clase: "warn" },
        desconectado: { icono: "🔴", texto: "Desconectado", clase: "err" },
        desconocido:  { icono: "⚪", texto: "Sin datos (¿bot apagado?)", clase: "off" }
    };
    const info = mapa[est.estado] || mapa.desconocido;
    const cuando = est.ts ? new Date(est.ts).toLocaleString("es-MX") : "—";

    cont.innerHTML = `
        <div class="bot-estado-fila bot-estado-${info.clase}">
            <span class="bot-estado-icono">${info.icono}</span>
            <div>
                <strong>${info.texto}</strong>
                <div class="bot-estado-sub">Último reporte: ${cuando}</div>
            </div>
        </div>
        <div id="botQR" class="bot-qr"></div>
    `;

    const qrCont = document.getElementById("botQR");
    if(est.estado === "esperando_qr" && est.qr && qrCont){
        qrCont.innerHTML = `<p class="bot-ayuda">Escanea este QR con WhatsApp:</p><div id="botQRImg" class="bot-qr-img"></div>`;
        const div = document.getElementById("botQRImg");
        if(typeof QRCode !== "undefined" && div){
            new QRCode(div, { text: est.qr, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
        }
    }
}

async function cargarConfigBot(){
    let cfg = { precios: {}, mensajes: {} };
    try{
        const r = await fetch(`${API_URL}/api/bot/config`);
        cfg = await r.json();
    }catch(e){
        mostrarToast("No se pudo cargar la config del bot", "error");
        return;
    }

    const pn = document.getElementById("botPrecioNormal");
    const pp = document.getElementById("botPrecioPreventa");
    if(pn){ pn.value = cfg.precios?.normal ?? ""; }
    if(pp){ pp.value = cfg.precios?.preventa ?? ""; }

    BOT_LOGO_URL = cfg.logo || "";
    pintarLogoPreview();

    const cont = document.getElementById("botMensajes");
    if(!cont){ return; }

    BOT_CONFIG_KEYS = Object.keys(cfg.mensajes || {});
    if(!BOT_CONFIG_KEYS.length){
        cont.innerHTML = `<p class="caja-vacio">Aún no hay mensajes configurados.</p>`;
        return;
    }

    cont.innerHTML = BOT_CONFIG_KEYS.map(k => {
        const label = BOT_MSG_LABELS[k] || k;
        const val = escaparTexto(cfg.mensajes[k] || "");
        const filas = Math.min(10, Math.max(3, (cfg.mensajes[k] || "").split("\n").length + 1));
        return `
            <div class="bot-campo">
                <label class="bot-campo-label">${escaparTexto(label)} <span class="bot-campo-key">(${escaparTexto(k)})</span></label>
                <textarea id="botMsg_${escaparTexto(k)}" rows="${filas}">${val}</textarea>
            </div>
        `;
    }).join("");
}

async function guardarConfigBot(){
    const mensajes = {};
    BOT_CONFIG_KEYS.forEach(k => {
        const ta = document.getElementById(`botMsg_${k}`);
        if(ta){ mensajes[k] = ta.value; }
    });

    const precios = {
        normal: Number(document.getElementById("botPrecioNormal")?.value || 0),
        preventa: Number(document.getElementById("botPrecioPreventa")?.value || 0)
    };

    try{
        const r = await fetch(`${API_URL}/api/bot/config`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ precios, mensajes, logo: BOT_LOGO_URL })
        });
        if(!r.ok){ throw new Error("PUT falló"); }
        mostrarToast("Configuración del bot guardada ✅", "success");
    }catch(e){
        mostrarToast("No se pudo guardar", "error");
    }
}

/* ---- Eventos reales con switch de visibilidad ---- */

async function renderEventosBot(){
    const cont = document.getElementById("botEventos");
    if(!cont){ return; }

    let eventos = [];
    try{
        const r = await fetch(`${API_URL}/api/bot/eventos-config`);
        eventos = await r.json();
    }catch(e){
        cont.innerHTML = `<p class="caja-vacio">No se pudieron cargar los eventos.</p>`;
        return;
    }

    if(!eventos.length){
        cont.innerHTML = `<p class="caja-vacio">No hay eventos. Créalos en la sección Eventos.</p>`;
        return;
    }

    cont.innerHTML = eventos.map(ev => {
        const sinFunciones = ev.numFunciones === 0;
        const inactivo = !ev.activo;
        let nota = "";
        if(inactivo){ nota = `<span class="bot-evento-nota">⚠️ Evento pausado</span>`; }
        else if(sinFunciones){ nota = `<span class="bot-evento-nota">⚠️ Sin funciones activas</span>`; }
        else { nota = `<span class="bot-evento-sub">${ev.numFunciones} función(es)</span>`; }

        return `
            <div class="bot-evento-fila">
                <div class="bot-evento-info">
                    <strong>${escaparTexto(ev.nombre)}</strong>
                    <div>${escaparTexto(ev.lugar || "")} ${nota}</div>
                </div>
                <label class="bot-switch">
                    <input type="checkbox" ${ev.enBot ? "checked" : ""}
                        onchange="toggleEventoBot('${ev.id}', this.checked)">
                    <span class="bot-switch-track"></span>
                </label>
            </div>
        `;
    }).join("");
}

async function toggleEventoBot(id, visible){
    try{
        const r = await fetch(`${API_URL}/api/bot/eventos/${encodeURIComponent(id)}/visible`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ visible })
        });
        if(!r.ok){ throw new Error("no ok"); }
        mostrarToast(visible ? "Evento visible en el bot ✅" : "Evento oculto del bot 🚫", "success");
    }catch(e){
        mostrarToast("No se pudo cambiar", "error");
        renderEventosBot();
    }
}