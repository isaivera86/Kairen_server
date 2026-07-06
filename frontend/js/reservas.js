/* ============================================================
   PANEL DE RESERVAS (sección "📋 Reservas")
   Lista las reservas del bot. Confirmar (efectivo/transferencia)
   envía el boleto con QR. Cancelar la marca cancelada.
============================================================ */

let RESERVAS_CACHE = [];
let RESERVAS_FILTRO = "todas";

async function renderPanelReservas(){
    const cont = document.getElementById("reservasLista");
    if(!cont){ return; }
    cont.innerHTML = `<p class="caja-vacio">Cargando…</p>`;

    try{
        const r = await fetch(`${API_URL}/api/reservas`);
        RESERVAS_CACHE = await r.json();
    }catch(e){
        cont.innerHTML = `<p class="caja-vacio">No se pudieron cargar las reservas.</p>`;
        return;
    }
    pintarReservas();
}

function filtrarReservas(filtro, btn){
    RESERVAS_FILTRO = filtro;
    document.querySelectorAll(".reservas-filtro").forEach(b => b.classList.remove("active"));
    if(btn){ btn.classList.add("active"); }
    pintarReservas();
}

function esConfirmada(s){ return String(s).toLowerCase().includes("confirm"); }
function esCancelada(s){ return String(s).toLowerCase().includes("cancel"); }

function pintarReservas(){
    const cont = document.getElementById("reservasLista");
    if(!cont){ return; }

    let lista = [...RESERVAS_CACHE].reverse(); // más recientes primero

    if(RESERVAS_FILTRO === "pendientes"){
        lista = lista.filter(r => !esConfirmada(r.status) && !esCancelada(r.status));
    }else if(RESERVAS_FILTRO === "confirmadas"){
        lista = lista.filter(r => esConfirmada(r.status));
    }else if(RESERVAS_FILTRO === "canceladas"){
        lista = lista.filter(r => esCancelada(r.status));
    }

    if(!lista.length){
        cont.innerHTML = `<p class="caja-vacio">No hay reservas aquí.</p>`;
        return;
    }

    cont.innerHTML = lista.map(r => {
        const conf = esConfirmada(r.status);
        const canc = esCancelada(r.status);
        const claseEstado = conf ? "ok" : (canc ? "err" : "warn");
        const evento = escaparTexto(r.evento || r.funcion || "—");
        const cuando = `${escaparTexto(r.fecha || "")} ${escaparTexto(r.hora || r.horario || "")}`.trim();
        const tel = escaparTexto(r.telefono || "");

        let acciones = "";
        if(!conf && !canc){
            acciones = `
                <button class="btn-primary btn-mini" onclick="confirmarReserva('${escaparTexto(r.folio)}')">✅ Confirmar</button>
                <button class="btn-peligro btn-mini" onclick="cancelarReserva('${escaparTexto(r.folio)}')">❌ Cancelar</button>
            `;
        }else if(conf){
            acciones = `<button class="btn-secundario btn-mini" onclick="reenviarBoleto('${escaparTexto(r.folio)}')">📨 Reenviar boleto</button>`;
        }

        return `
            <div class="reserva-card">
                <div class="reserva-top">
                    <strong>🧾 ${escaparTexto(r.folio)}</strong>
                    <span class="reserva-estado reserva-estado-${claseEstado}">${escaparTexto(r.status || "pendiente")}</span>
                </div>
                <div class="reserva-body">
                    <div>🎭 ${evento}</div>
                    <div>📅 ${cuando || "—"}</div>
                    <div>👤 ${escaparTexto(r.nombre || "—")}</div>
                    <div>🎟️ ${r.boletos || 0} boleto(s) · 💵 $${r.total || 0}${r.metodoPago ? " · " + escaparTexto(r.metodoPago) : ""}</div>
                    <div>📱 ${tel || "—"}</div>
                </div>
                <div class="reserva-acciones">${acciones}</div>
            </div>
        `;
    }).join("");
}

async function confirmarReserva(folio){
    const metodo = await elegirMetodoPago();
    if(!metodo){ return; }
    try{
        const r = await fetch(`${API_URL}/api/reservas/${encodeURIComponent(folio)}/confirmar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ metodoPago: metodo })
        });
        if(!r.ok){ throw new Error("no ok"); }
        mostrarToast(`Reserva ${folio} confirmada. Boleto en camino 🎫`, "success");
        renderPanelReservas();
    }catch(e){
        mostrarToast("No se pudo confirmar", "error");
    }
}

async function cancelarReserva(folio){
    if(!confirm(`¿Cancelar la reserva ${folio}?`)){ return; }
    try{
        const r = await fetch(`${API_URL}/api/reservas/${encodeURIComponent(folio)}/cancelar`, { method: "POST" });
        if(!r.ok){ throw new Error("no ok"); }
        mostrarToast(`Reserva ${folio} cancelada`, "success");
        renderPanelReservas();
    }catch(e){
        mostrarToast("No se pudo cancelar", "error");
    }
}

async function reenviarBoleto(folio){
    // Confirmar de nuevo re-encola el boleto (mismo método que ya tenía o transferencia).
    try{
        const r = await fetch(`${API_URL}/api/reservas/${encodeURIComponent(folio)}/confirmar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ metodoPago: "transferencia" })
        });
        if(!r.ok){ throw new Error("no ok"); }
        mostrarToast("Boleto reenviado 📨", "success");
    }catch(e){
        mostrarToast("No se pudo reenviar", "error");
    }
}

// Mini selector de método de pago (efectivo / transferencia)
function elegirMetodoPago(){
    return new Promise(resolve => {
        const overlay = document.createElement("div");
        overlay.className = "reserva-modal-overlay";
        overlay.innerHTML = `
            <div class="reserva-modal">
                <h3>¿Cómo se pagó?</h3>
                <div class="reserva-modal-botones">
                    <button class="btn-primary" data-m="efectivo">💵 Efectivo</button>
                    <button class="btn-primary" data-m="transferencia">🏦 Transferencia</button>
                </div>
                <button class="btn-secundario btn-mini" data-m="">Cancelar</button>
            </div>
        `;
        overlay.addEventListener("click", (e) => {
            const b = e.target.closest("button");
            if(!b && e.target !== overlay){ return; }
            const m = b ? b.dataset.m : "";
            document.body.removeChild(overlay);
            resolve(m || null);
        });
        document.body.appendChild(overlay);
    });
}
