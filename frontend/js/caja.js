/* ============================================================
   MÓDULO CAJA / POS — Parte 1: venta de boletos con folios.
   Registra ventas por función (categoría, folios, comprador,
   precio, método de pago) y muestra el resumen del día.
   (Compras / otros movimientos y offline llegan en las
    siguientes partes.)
============================================================ */

let CAJA_CTX = { eventoId: null, funcionId: null, evento: null, funcion: null };
let CAJA_MODO = "venta";
let CAJA_MOVIMIENTOS = [];

function nombreCategoriaCaja(clave){
    if(clave === "preferente"){ return "Preferente"; }
    if(clave === "vip"){ return "VIP"; }
    return "General";
}

function opcionesBoletoCaja(funcion){
    const cats = funcion.categorias || {};
    const base = [
        ["general", "General", cats.general],
        ["preferente", "Preferente", cats.preferente],
        ["vip", "VIP", cats.vip]
    ];

    const ops = [];
    base.forEach(([clave, nombre, c]) => {
        if(!c){ return; }
        if(clave !== "general" && !c.activa){ return; }

        const preventa = Number(c.preventa) || 0;
        const precio = Number(c.precio) || 0;

        if(preventa > 0){
            ops.push({ categoria: clave, etiqueta: `${nombre} preventa`, precio: preventa });
        }
        ops.push({ categoria: clave, etiqueta: nombre, precio: precio });
    });

    return ops;
}

async function abrirCaja(eventoId, funcionId){
    const lista = (typeof eventosActuales !== "undefined") ? eventosActuales : [];
    const evento = lista.find(e => e.id === eventoId);

    if(!evento){ mostrarToast("Evento no encontrado", "error"); return; }

    const funcion = evento.funciones.find(f => f.id === funcionId);
    if(!funcion){ mostrarToast("Función no encontrada", "error"); return; }

    CAJA_CTX = { eventoId, funcionId, evento, funcion };

    const sub = document.getElementById("cajaSubtitulo");
    if(sub){
        sub.textContent = `${evento.nombre} · ${funcion.fecha || ""} ${funcion.hora || ""}`.trim();
    }

    const selCat = document.getElementById("cajaCategoria");
    if(selCat){
        const ops = opcionesBoletoCaja(funcion);
        selCat.innerHTML = ops.map((o, i) =>
            `<option value="${i}" data-categoria="${o.categoria}" data-precio="${o.precio}">${o.etiqueta} · $${o.precio}</option>`
        ).join("");
    }

    const cant = document.getElementById("cajaCantidad");
    if(cant){ cant.value = "1"; }
    const comp = document.getElementById("cajaComprador");
    if(comp){ comp.value = ""; }

    cambiarModoCaja("venta");
    actualizarTotalCaja();

    document.getElementById("modalCaja").classList.remove("oculto");

    await cargarMovimientosCaja();
}

function cerrarCaja(){
    const m = document.getElementById("modalCaja");
    if(m){ m.classList.add("oculto"); }

    const sec = document.getElementById("seccionVentas");
    if(sec && !sec.classList.contains("oculto") && typeof renderPanelVentas === "function"){
        renderPanelVentas();
    }
}

function actualizarTotalCaja(){
    const sel = document.getElementById("cajaCategoria");
    const totalEl = document.getElementById("cajaTotal");
    const cantEl = document.getElementById("cajaCantidad");

    if(!totalEl){ return; }

    const opt = sel && sel.selectedOptions[0];
    const precio = opt ? (Number(opt.dataset.precio) || 0) : 0;
    const cant = Math.max(1, Number(cantEl?.value) || 1);

    totalEl.value = "$" + (precio * cant).toLocaleString("es-MX");
}

function cambiarModoCaja(modo){
    CAJA_MODO = modo;

    document.querySelectorAll(".caja-modo-btn").forEach(b => {
        b.classList.toggle("activo", b.dataset.modo === modo);
    });

    const venta = document.getElementById("cajaCamposVenta");
    const mov = document.getElementById("cajaCamposMovimiento");
    const boton = document.querySelector(".caja-btn-venta");

    if(venta){ venta.classList.toggle("oculto", modo !== "venta"); }
    if(mov){ mov.classList.toggle("oculto", modo === "venta"); }

    if(boton){
        boton.textContent =
            modo === "venta" ? "➕ Registrar venta" :
            modo === "gasto" ? "🛒 Registrar gasto" :
            "➕ Registrar ingreso";
    }
}

function registrarCaja(boton){
    if(CAJA_MODO === "venta"){
        registrarVentaCaja(boton);
    } else {
        registrarMovimientoCaja(boton);
    }
}

async function registrarMovimientoCaja(boton){
    const { eventoId, funcionId } = CAJA_CTX;

    const concepto = (document.getElementById("cajaConcepto")?.value || "").trim();
    const monto = Number(document.getElementById("cajaMonto")?.value) || 0;
    const metodoPago = document.getElementById("cajaMetodoMov")?.value || "efectivo";
    const tipo = CAJA_MODO === "gasto" ? "egreso" : "ingreso";

    if(!concepto){
        mostrarToast("Escribe un concepto", "warning");
        return;
    }
    if(monto <= 0){
        mostrarToast("Pon un monto válido", "warning");
        return;
    }

    iniciarCarga(boton, "Registrando...");

    try{
        const r = await fetch(
            `${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/movimientos`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tipo, concepto, monto, metodoPago })
            }
        );

        const res = await r.json();
        mostrarToast(res.mensaje || "Movimiento registrado", "success");

        const c = document.getElementById("cajaConcepto");
        if(c){ c.value = ""; }
        const m = document.getElementById("cajaMonto");
        if(m){ m.value = ""; }

        await cargarMovimientosCaja();
    }catch(e){
        mostrarToast("Error al registrar", "error");
    }

    terminarCarga(boton);
}

async function cargarMovimientosCaja(){
    const { eventoId, funcionId } = CAJA_CTX;
    try{
        const r = await fetch(`${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/movimientos`);
        const movimientos = await r.json();
        renderCajaMovimientos(Array.isArray(movimientos) ? movimientos : []);
    }catch(e){
        renderCajaMovimientos([]);
    }
}

async function registrarVentaCaja(boton){
    const { eventoId, funcionId } = CAJA_CTX;

    const sel = document.getElementById("cajaCategoria");
    const opt = sel && sel.selectedOptions[0];

    const categoria = opt ? (opt.dataset.categoria || "general") : "general";
    const precioUnitario = opt ? (Number(opt.dataset.precio) || 0) : 0;
    const cantidad = Math.max(1, Number(document.getElementById("cajaCantidad")?.value) || 1);
    const comprador = (document.getElementById("cajaComprador")?.value || "").trim();
    const telefono = (document.getElementById("cajaTelefono")?.value || "").trim();
    const metodoPago = document.getElementById("cajaMetodo")?.value || "efectivo";

    if(precioUnitario <= 0){
        mostrarToast("Ese boleto no tiene precio configurado", "warning");
        return;
    }

    iniciarCarga(boton, "Registrando...");

    try{
        const r = await fetch(
            `${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/movimientos`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tipo: "venta",
                    categoria,
                    precioUnitario,
                    cantidad,
                    comprador,
                    telefono,
                    metodoPago
                })
            }
        );

        const res = await r.json();
        mostrarToast(res.mensaje || "Venta registrada", "success");

        const comp = document.getElementById("cajaComprador");
        if(comp){ comp.value = ""; }
        const tel = document.getElementById("cajaTelefono");
        if(tel){ tel.value = ""; }
        const cant = document.getElementById("cajaCantidad");
        if(cant){ cant.value = "1"; }
        actualizarTotalCaja();

        await cargarMovimientosCaja();
    }catch(e){
        mostrarToast("Error al registrar la venta", "error");
    }

    terminarCarga(boton);
}

function eliminarMovimientoCaja(movId){
    const { eventoId, funcionId } = CAJA_CTX;

    abrirConfirmacion(
        "Eliminar movimiento",
        "¿Seguro que quieres eliminar este movimiento? Los folios ya usados no se reutilizan.",
        async function(){
            try{
                const r = await fetch(
                    `${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/movimientos/${movId}`,
                    { method: "DELETE" }
                );
                const res = await r.json();
                mostrarToast(res.mensaje || "Movimiento eliminado", "success");
                await cargarMovimientosCaja();
            }catch(e){
                mostrarToast("Error al eliminar", "error");
            }
        }
    );
}

function iconoMetodoCaja(m){
    if(m === "transferencia"){ return "🏦"; }
    if(m === "tarjeta"){ return "💳"; }
    return "💵";
}

function pesos(n){
    return "$" + (Number(n) || 0).toLocaleString("es-MX");
}

function renderCajaMovimientos(movimientos){
    CAJA_MOVIMIENTOS = Array.isArray(movimientos) ? movimientos : [];

    const ventas = CAJA_MOVIMIENTOS.filter(m => m.tipo === "venta");
    const egresos = CAJA_MOVIMIENTOS.filter(m => m.tipo === "egreso");
    const ingresos = CAJA_MOVIMIENTOS.filter(m => m.tipo === "ingreso");

    const totalVendido = ventas.reduce((a, m) => a + (m.monto || 0), 0);
    const totalBoletos = ventas.reduce((a, m) => a + (m.cantidad || 0), 0);
    const totalIngresos = ingresos.reduce((a, m) => a + (m.monto || 0), 0);
    const totalEgresos = egresos.reduce((a, m) => a + (m.monto || 0), 0);
    const saldo = totalVendido + totalIngresos - totalEgresos;

    // Resumen (tarjetas)
    const resumen = document.getElementById("cajaResumen");
    if(resumen){
        resumen.innerHTML = `
            <div class="caja-resumen-item">
                <span class="caja-resumen-label">Vendido (${totalBoletos} bol.)</span>
                <strong class="caja-resumen-valor">${pesos(totalVendido)}</strong>
            </div>
            <div class="caja-resumen-item">
                <span class="caja-resumen-label">Gastos</span>
                <strong class="caja-resumen-valor rojo">${pesos(totalEgresos)}</strong>
            </div>
            <div class="caja-resumen-item">
                <span class="caja-resumen-label">Saldo</span>
                <strong class="caja-resumen-valor verde">${pesos(saldo)}</strong>
            </div>
        `;
    }

    // Desglose por categoría y por método
    const desglose = document.getElementById("cajaDesglose");
    if(desglose){
        const porCat = {};
        ventas.forEach(m => {
            const c = m.categoria || "general";
            porCat[c] = (porCat[c] || 0) + (m.monto || 0);
        });

        const porMetodo = { efectivo: 0, transferencia: 0, tarjeta: 0 };
        [...ventas, ...ingresos].forEach(m => {
            const mp = m.metodoPago || "efectivo";
            porMetodo[mp] = (porMetodo[mp] || 0) + (m.monto || 0);
        });

        const catHTML = Object.keys(porCat).length
            ? Object.entries(porCat).map(([c, v]) =>
                `<span class="caja-chip">${nombreCategoriaCaja(c)}: <b>${pesos(v)}</b></span>`
              ).join("")
            : `<span class="caja-chip caja-chip-vacio">Sin ventas</span>`;

        const metHTML = `
            <span class="caja-chip">💵 ${pesos(porMetodo.efectivo)}</span>
            <span class="caja-chip">🏦 ${pesos(porMetodo.transferencia)}</span>
            <span class="caja-chip">💳 ${pesos(porMetodo.tarjeta)}</span>
        `;

        desglose.innerHTML = `
            <div class="caja-desglose-fila"><span class="caja-desglose-tit">Por categoría</span>${catHTML}</div>
            <div class="caja-desglose-fila"><span class="caja-desglose-tit">Por método</span>${metHTML}</div>
        `;
    }

    // Lista de TODOS los movimientos (más reciente arriba)
    const lista = document.getElementById("cajaLista");
    if(!lista){ return; }

    if(!CAJA_MOVIMIENTOS.length){
        lista.innerHTML = `<p class="caja-vacio">Aún no hay movimientos registrados.</p>`;
        return;
    }

    lista.innerHTML = CAJA_MOVIMIENTOS.slice().reverse().map(m => {
        if(m.tipo === "venta"){
            return `
                <div class="caja-mov">
                    <div class="caja-mov-info">
                        <div class="caja-mov-top">
                            <span class="caja-mov-cat cat-${m.categoria || "general"}">${nombreCategoriaCaja(m.categoria)}</span>
                            <span class="caja-mov-folios">${escaparTexto((m.folios || []).join(", "))}</span>
                        </div>
                        <div class="caja-mov-sub">
                            ${m.comprador ? `👤 ${escaparTexto(m.comprador)} · ` : ""}${m.telefono ? `📱 ${escaparTexto(m.telefono)} · ` : ""}${iconoMetodoCaja(m.metodoPago)} ${escaparTexto(m.metodoPago)} · ${m.cantidad} x ${pesos(m.precioUnitario)}
                        </div>
                    </div>
                    <div class="caja-mov-lado">
                        <strong class="caja-mov-monto">${pesos(m.monto)}</strong>
                        ${m.telefono ? `<button class="caja-mov-wa" onclick="enviarWhatsAppVenta(${m.id})" title="Enviar por WhatsApp">📲</button>` : ""}
                        <button class="caja-mov-qr" onclick="verBoletosQR(${m.id})" title="Ver boletos / QR">🎫</button>
                        <button class="caja-mov-del" onclick="eliminarMovimientoCaja(${m.id})" title="Eliminar">🗑️</button>
                    </div>
                </div>
            `;
        }

        const esEgreso = m.tipo === "egreso";
        return `
            <div class="caja-mov">
                <div class="caja-mov-info">
                    <div class="caja-mov-top">
                        <span class="caja-mov-cat ${esEgreso ? "cat-egreso" : "cat-ingreso"}">${esEgreso ? "🛒 Gasto" : "➕ Ingreso"}</span>
                        <span class="caja-mov-folios">${escaparTexto(m.concepto || "")}</span>
                    </div>
                    <div class="caja-mov-sub">
                        ${iconoMetodoCaja(m.metodoPago)} ${escaparTexto(m.metodoPago)}
                    </div>
                </div>
                <div class="caja-mov-lado">
                    <strong class="caja-mov-monto ${esEgreso ? "rojo" : ""}">${esEgreso ? "−" : ""}${pesos(m.monto)}</strong>
                    <button class="caja-mov-del" onclick="eliminarMovimientoCaja(${m.id})" title="Eliminar">🗑️</button>
                </div>
            </div>
        `;
    }).join("");
}

function csvEscape(v){
    const s = String(v === null || v === undefined ? "" : v);
    if(/[",\n]/.test(s)){
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

function exportarCajaCSV(){
    if(!CAJA_MOVIMIENTOS.length){
        mostrarToast("No hay movimientos para exportar", "warning");
        return;
    }

    const { evento, funcion } = CAJA_CTX;

    const ventas = CAJA_MOVIMIENTOS.filter(m => m.tipo === "venta");
    const egresos = CAJA_MOVIMIENTOS.filter(m => m.tipo === "egreso");
    const ingresos = CAJA_MOVIMIENTOS.filter(m => m.tipo === "ingreso");

    const totalVendido = ventas.reduce((a, m) => a + (m.monto || 0), 0);
    const totalBoletos = ventas.reduce((a, m) => a + (m.cantidad || 0), 0);
    const totalIngresos = ingresos.reduce((a, m) => a + (m.monto || 0), 0);
    const totalEgresos = egresos.reduce((a, m) => a + (m.monto || 0), 0);
    const saldo = totalVendido + totalIngresos - totalEgresos;

    const porCat = {};
    ventas.forEach(m => { const c = m.categoria || "general"; porCat[c] = (porCat[c] || 0) + (m.monto || 0); });
    const porMetodo = { efectivo: 0, transferencia: 0, tarjeta: 0 };
    [...ventas, ...ingresos].forEach(m => { const mp = m.metodoPago || "efectivo"; porMetodo[mp] = (porMetodo[mp] || 0) + (m.monto || 0); });

    const lineas = [];

    lineas.push(["RESUMEN"]);
    lineas.push(["Evento", evento?.nombre || ""]);
    lineas.push(["Fecha", `${funcion?.fecha || ""} ${funcion?.hora || ""}`.trim()]);
    lineas.push([]);
    lineas.push(["Concepto", "Valor"]);
    lineas.push(["Total vendido", totalVendido]);
    lineas.push(["Boletos vendidos", totalBoletos]);
    lineas.push(["Otros ingresos", totalIngresos]);
    lineas.push(["Gastos", totalEgresos]);
    lineas.push(["Saldo", saldo]);
    lineas.push([]);
    lineas.push(["Ventas por categoría"]);
    Object.entries(porCat).forEach(([c, v]) => lineas.push([nombreCategoriaCaja(c), v]));
    lineas.push([]);
    lineas.push(["Ingresos por método"]);
    lineas.push(["Efectivo", porMetodo.efectivo]);
    lineas.push(["Transferencia", porMetodo.transferencia]);
    lineas.push(["Tarjeta", porMetodo.tarjeta]);
    lineas.push([]);
    lineas.push([]);

    lineas.push(["DETALLE"]);
    lineas.push(["Fecha/Hora", "Tipo", "Concepto/Categoría", "Folios", "Comprador", "Teléfono", "Cantidad", "Precio unit.", "Método", "Monto"]);

    CAJA_MOVIMIENTOS.forEach(m => {
        const fechaLegible = m.fecha ? new Date(m.fecha).toLocaleString("es-MX") : "";
        if(m.tipo === "venta"){
            lineas.push([
                fechaLegible, "Venta", nombreCategoriaCaja(m.categoria),
                (m.folios || []).join(" "), m.comprador || "", m.telefono || "",
                m.cantidad || "", m.precioUnitario || "", m.metodoPago || "", m.monto || 0
            ]);
        } else {
            lineas.push([
                fechaLegible, m.tipo === "egreso" ? "Gasto" : "Ingreso", m.concepto || "",
                "", "", "", "", "", m.metodoPago || "",
                (m.tipo === "egreso" ? -1 : 1) * (m.monto || 0)
            ]);
        }
    });

    const csv = "\uFEFF" + lineas.map(fila => fila.map(csvEscape).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const nombreArch = `caja-${(evento?.nombre || "evento").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${funcion?.fecha || ""}.csv`;
    a.href = url;
    a.download = nombreArch;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    mostrarToast("Reporte CSV descargado", "success");
}


/* ============================================================
   PANEL GLOBAL DE VENTAS (sección "Ventas" del sidebar)
============================================================ */

async function renderPanelVentas(){
    let eventos = [];
    try{
        const r = await fetch(`${API_URL}/api/eventos`);
        eventos = await r.json();
    }catch(e){
        eventos = (typeof eventosActuales !== "undefined") ? eventosActuales : [];
    }
    if(!Array.isArray(eventos)){ eventos = []; }

    let gVendido = 0, gBoletos = 0, gGastos = 0, gSaldo = 0;
    const filas = [];

    eventos.forEach(ev => {
        (ev.funciones || []).forEach(fn => {
            if((fn.tipoRegistro || "funcion") !== "funcion"){ return; }

            const movs = fn.movimientos || [];
            const ventas = movs.filter(m => m.tipo === "venta");
            const egresos = movs.filter(m => m.tipo === "egreso");
            const ingresos = movs.filter(m => m.tipo === "ingreso");

            const vendido = ventas.reduce((a, m) => a + (m.monto || 0), 0);
            const boletos = ventas.reduce((a, m) => a + (m.cantidad || 0), 0);
            const gastos = egresos.reduce((a, m) => a + (m.monto || 0), 0);
            const ingr = ingresos.reduce((a, m) => a + (m.monto || 0), 0);
            const saldo = vendido + ingr - gastos;

            gVendido += vendido;
            gBoletos += boletos;
            gGastos += gastos;
            gSaldo += saldo;

            filas.push({ ev, fn, vendido, boletos, saldo });
        });
    });

    const resumen = document.getElementById("ventasResumenGlobal");
    if(resumen){
        resumen.innerHTML = `
            <div class="caja-resumen-item">
                <span class="caja-resumen-label">Vendido (${gBoletos} bol.)</span>
                <strong class="caja-resumen-valor">${pesos(gVendido)}</strong>
            </div>
            <div class="caja-resumen-item">
                <span class="caja-resumen-label">Gastos</span>
                <strong class="caja-resumen-valor rojo">${pesos(gGastos)}</strong>
            </div>
            <div class="caja-resumen-item">
                <span class="caja-resumen-label">Saldo</span>
                <strong class="caja-resumen-valor verde">${pesos(gSaldo)}</strong>
            </div>
        `;
    }

    const cont = document.getElementById("ventasFunciones");
    if(!cont){ return; }

    if(!filas.length){
        cont.innerHTML = `<p class="caja-vacio">No hay funciones con boletaje todavía.</p>`;
        return;
    }

    filas.sort((a, b) => (b.vendido - a.vendido));

    cont.innerHTML = filas.map(f => `
        <div class="ventas-func-card">
            <div class="ventas-func-info">
                <strong class="ventas-func-nombre">${escaparTexto(f.ev.nombre)}</strong>
                <span class="ventas-func-sub">📅 ${escaparTexto(`${f.fn.fecha || ""} ${f.fn.hora || ""}`.trim())} · ${f.boletos} boletos</span>
            </div>
            <div class="ventas-func-lado">
                <div class="ventas-func-montos">
                    <strong class="ventas-func-vendido">${pesos(f.vendido)}</strong>
                    <span class="ventas-func-saldo">Saldo ${pesos(f.saldo)}</span>
                </div>
                <button class="btn-secundario btn-mini" onclick="abrirTablaVentas(${f.ev.id}, ${f.fn.id})">📋 Tabla</button>
                <button class="btn-secundario btn-mini" onclick="abrirCaja(${f.ev.id}, ${f.fn.id})">💵 Caja</button>
            </div>
        </div>
    `).join("");
}

/* ============================================================
   TABLA DE VENTAS por función (solo lectura + borrar)
============================================================ */

let TABLA_VENTAS_CTX = { eventoId: null, funcionId: null };

async function abrirTablaVentas(eventoId, funcionId){
    TABLA_VENTAS_CTX = { eventoId, funcionId };
    const modal = document.getElementById("modalTablaVentas");
    if(modal){ modal.classList.remove("oculto"); }
    document.body.classList.add("modal-abierto");
    await cargarTablaVentas();
}

function cerrarTablaVentas(){
    const modal = document.getElementById("modalTablaVentas");
    if(modal){ modal.classList.add("oculto"); }
    document.body.classList.remove("modal-abierto");
    const sec = document.getElementById("seccionVentas");
    if(sec && !sec.classList.contains("oculto") && typeof renderPanelVentas === "function"){
        renderPanelVentas();
    }
}

async function cargarTablaVentas(){
    const { eventoId, funcionId } = TABLA_VENTAS_CTX;
    const cont = document.getElementById("tablaVentasBody");
    const tot = document.getElementById("tablaVentasTotales");
    if(cont){ cont.innerHTML = `<tr><td colspan="7" class="caja-vacio">Cargando…</td></tr>`; }

    let movimientos = [];
    try{
        const r = await fetch(`${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/movimientos`);
        movimientos = await r.json();
    }catch(e){ movimientos = []; }

    const ventas = (Array.isArray(movimientos) ? movimientos : []).filter(m => m.tipo === "venta");

    if(!ventas.length){
        if(cont){ cont.innerHTML = `<tr><td colspan="7" class="caja-vacio">Aún no hay ventas en esta función.</td></tr>`; }
        if(tot){ tot.innerHTML = ""; }
        return;
    }

    if(cont){
        cont.innerHTML = ventas.slice().reverse().map(m => {
            const folios = (m.folios || []).join(", ");
            const origen = m.origen === "bot" ? "🤖 Bot" : "🏪 Caja";
            const pago = `${iconoMetodoCaja(m.metodoPago)} ${escaparTexto(m.metodoPago || "")}`;
            return `
                <tr>
                    <td>${escaparTexto(folios)}</td>
                    <td>${escaparTexto(m.comprador || "—")}</td>
                    <td class="tv-num">${m.cantidad || 0}</td>
                    <td class="tv-num">${pesos(m.monto)}</td>
                    <td>${pago}</td>
                    <td>${origen}</td>
                    <td class="tv-acc"><button class="caja-mov-del" onclick="eliminarVentaTabla(${m.id})" title="Eliminar">🗑️</button></td>
                </tr>
            `;
        }).join("");
    }

    const totalVendido = ventas.reduce((a, m) => a + (m.monto || 0), 0);
    const totalBoletos = ventas.reduce((a, m) => a + (m.cantidad || 0), 0);
    if(tot){
        tot.innerHTML = `
            <div class="tv-total-item">🎟️ Boletos vendidos: <strong>${totalBoletos}</strong></div>
            <div class="tv-total-item">💰 Total vendido: <strong>${pesos(totalVendido)}</strong></div>
        `;
    }
}

async function eliminarVentaTabla(movId){
    const ok = await confirmarAccionVentas("¿Eliminar esta venta?");
    if(!ok){ return; }
    const { eventoId, funcionId } = TABLA_VENTAS_CTX;
    try{
        const r = await fetch(`${API_URL}/api/eventos/${eventoId}/funciones/${funcionId}/movimientos/${movId}`, { method: "DELETE" });
        if(!r.ok){ throw new Error("no ok"); }
        mostrarToast("Venta eliminada 🗑️", "success");
        await cargarTablaVentas();
    }catch(e){
        mostrarToast("No se pudo eliminar", "error");
    }
}

// Confirmación con estilo propio (para la tabla)
function confirmarAccionVentas(mensaje){
    return new Promise(resolve => {
        const overlay = document.createElement("div");
        overlay.className = "reserva-modal-overlay";
        overlay.innerHTML = `
            <div class="reserva-modal">
                <h3>${mensaje}</h3>
                <div class="reserva-modal-botones">
                    <button class="btn-peligro" data-r="1">Sí, eliminar</button>
                    <button class="btn-secundario" data-r="0">No</button>
                </div>
            </div>
        `;
        overlay.addEventListener("click", (e) => {
            const b = e.target.closest("button");
            if(b){
                document.body.removeChild(overlay);
                resolve(b.dataset.r === "1");
            }else if(e.target === overlay){
                document.body.removeChild(overlay);
                resolve(false);
            }
        });
        document.body.appendChild(overlay);
    });
}


/* ============================================================
   EXPORTAR VENTAS: un libro Excel con una hoja por función
   (con respaldo a CSV combinado si la librería no cargó).
============================================================ */

function movimientosResumen(movs){
    const ventas = movs.filter(m => m.tipo === "venta");
    const eg = movs.filter(m => m.tipo === "egreso");
    const ing = movs.filter(m => m.tipo === "ingreso");
    const vendido = ventas.reduce((a, m) => a + (m.monto || 0), 0);
    const boletos = ventas.reduce((a, m) => a + (m.cantidad || 0), 0);
    const gastos = eg.reduce((a, m) => a + (m.monto || 0), 0);
    const ingresos = ing.reduce((a, m) => a + (m.monto || 0), 0);
    return { vendido, boletos, gastos, ingresos, saldo: vendido + ingresos - gastos };
}

function filasDetalleFuncion(movs){
    const rows = [["Fecha/Hora", "Tipo", "Concepto/Categoría", "Folios", "Comprador", "Teléfono", "Cantidad", "Precio unit.", "Método", "Monto"]];
    movs.forEach(m => {
        const f = m.fecha ? new Date(m.fecha).toLocaleString("es-MX") : "";
        if(m.tipo === "venta"){
            rows.push([f, "Venta", nombreCategoriaCaja(m.categoria), (m.folios || []).join(" "), m.comprador || "", m.telefono || "", m.cantidad || "", m.precioUnitario || "", m.metodoPago || "", m.monto || 0]);
        } else {
            rows.push([f, m.tipo === "egreso" ? "Gasto" : "Ingreso", m.concepto || "", "", "", "", "", "", m.metodoPago || "", (m.tipo === "egreso" ? -1 : 1) * (m.monto || 0)]);
        }
    });
    return rows;
}

async function exportarVentasExcel(){
    let eventos = [];
    try{
        const r = await fetch(`${API_URL}/api/eventos`);
        eventos = await r.json();
    }catch(e){
        eventos = (typeof eventosActuales !== "undefined") ? eventosActuales : [];
    }
    if(!Array.isArray(eventos)){ eventos = []; }

    const funcs = [];
    eventos.forEach(ev => (ev.funciones || []).forEach(fn => {
        if((fn.tipoRegistro || "funcion") !== "funcion"){ return; }
        funcs.push({ ev, fn });
    }));

    if(!funcs.length){
        mostrarToast("No hay funciones para exportar", "warning");
        return;
    }

    // Respaldo si la librería Excel no cargó (p. ej. sin internet)
    if(typeof XLSX === "undefined"){
        exportarVentasCSVCombinado(funcs);
        return;
    }

    const wb = XLSX.utils.book_new();

    // Hoja Resumen
    const resumenRows = [["RESUMEN GLOBAL"], [], ["Evento", "Fecha", "Vendido", "Boletos", "Gastos", "Saldo"]];
    let gV = 0, gB = 0, gG = 0, gS = 0;

    funcs.forEach(({ ev, fn }) => {
        const r = movimientosResumen(fn.movimientos || []);
        gV += r.vendido; gB += r.boletos; gG += r.gastos; gS += r.saldo;
        resumenRows.push([ev.nombre, `${fn.fecha || ""} ${fn.hora || ""}`.trim(), r.vendido, r.boletos, r.gastos, r.saldo]);
    });
    resumenRows.push([]);
    resumenRows.push(["TOTAL", "", gV, gB, gG, gS]);

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumenRows), "Resumen");

    // Una hoja por función
    const usados = {};
    funcs.forEach(({ ev, fn }) => {
        const movs = fn.movimientos || [];
        const r = movimientosResumen(movs);

        const rows = [
            [ev.nombre],
            [`${fn.fecha || ""} ${fn.hora || ""}`.trim()],
            ["Vendido", r.vendido, "Gastos", r.gastos, "Saldo", r.saldo],
            []
        ].concat(filasDetalleFuncion(movs));

        let base = `${ev.nombre} ${fn.fecha || ""}`
            .replace(/[\[\]\*\?\/\\:]/g, "")
            .trim()
            .slice(0, 28) || "Función";
        let nombre = base.slice(0, 31);
        let i = 2;
        while(usados[nombre]){ nombre = `${base} ${i}`.slice(0, 31); i++; }
        usados[nombre] = true;

        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), nombre);
    });

    XLSX.writeFile(wb, `ventas-kairen-${new Date().toISOString().slice(0, 10)}.xlsx`);
    mostrarToast("Excel exportado (una hoja por función)", "success");
}

function exportarVentasCSVCombinado(funcs){
    const lineas = [];
    funcs.forEach(({ ev, fn }) => {
        const movs = fn.movimientos || [];
        const r = movimientosResumen(movs);
        lineas.push([`=== ${ev.nombre} · ${fn.fecha || ""} ${fn.hora || ""}`.trim() + " ==="]);
        lineas.push(["Vendido", r.vendido, "Gastos", r.gastos, "Saldo", r.saldo]);
        filasDetalleFuncion(movs).forEach(f => lineas.push(f));
        lineas.push([]);
        lineas.push([]);
    });

    const csv = "\uFEFF" + lineas.map(fila => fila.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas-kairen-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    mostrarToast("Exportado en CSV (una sección por función)", "success");
}


/* ============================================================
   PARTE 3A: QR de boletos (acceso al teatro)
   Cada boleto tiene un token único; el QR codifica "KRN:<token>".
============================================================ */

function verBoletosQR(movId){
    const m = CAJA_MOVIMIENTOS.find(x => Number(x.id) === Number(movId));
    if(!m){ return; }

    // Compatibilidad: ventas viejas sin "boletos" -> usar folios.
    const boletos = (m.boletos && m.boletos.length)
        ? m.boletos
        : (m.folios || []).map(f => ({ folio: f, token: f }));

    const titulo = document.getElementById("boletosQRTitulo");
    if(titulo){
        titulo.textContent = `${nombreCategoriaCaja(m.categoria)} · ${m.comprador || "Sin nombre"}`;
    }

    const cont = document.getElementById("boletosQRContenido");
    if(!cont){ return; }
    cont.innerHTML = "";

    boletos.forEach(b => {
        const card = document.createElement("div");
        card.className = "boleto-qr-card";

        const img = document.createElement("div");
        img.className = "boleto-qr-img";
        card.appendChild(img);

        const folio = document.createElement("div");
        folio.className = "boleto-qr-folio";
        folio.textContent = b.folio;
        card.appendChild(folio);

        if(m.comprador){
            const nom = document.createElement("div");
            nom.className = "boleto-qr-nombre";
            nom.textContent = m.comprador;
            card.appendChild(nom);
        }

        cont.appendChild(card);

        if(typeof QRCode !== "undefined"){
            new QRCode(img, {
                text: `KRN:${b.token}`,
                width: 150,
                height: 150,
                correctLevel: QRCode.CorrectLevel.M
            });
        } else {
            img.textContent = b.token;
        }
    });

    document.getElementById("modalBoletosQR").classList.remove("oculto");
}

function cerrarBoletosQR(){
    const m = document.getElementById("modalBoletosQR");
    if(m){ m.classList.add("oculto"); }
}

function imprimirBoletosQR(){
    window.print();
}


/* Enviar boleto por WhatsApp (wa.me — semi-automático, sin bot) */
function enviarWhatsAppVenta(movId){
    const m = CAJA_MOVIMIENTOS.find(x => Number(x.id) === Number(movId));
    if(!m || !m.telefono){ return; }

    const { evento, funcion } = CAJA_CTX;

    let tel = String(m.telefono).replace(/\D/g, "");
    if(tel.length === 10){ tel = "52" + tel; }

    const folios = (m.boletos && m.boletos.length ? m.boletos.map(b => b.folio) : (m.folios || [])).join(", ");

    const partes = [
        `Hola${m.comprador ? " " + m.comprador : ""}! 🎫`,
        `Tu compra para *${evento?.nombre || ""}*`,
        `📅 ${`${funcion?.fecha || ""} ${funcion?.hora || ""}`.trim()}`,
        `🎟️ ${nombreCategoriaCaja(m.categoria)} · ${m.cantidad} boleto(s)`,
        folios ? `Folios: ${folios}` : "",
        "¡Te esperamos!"
    ].filter(Boolean);

    const texto = encodeURIComponent(partes.join("\n"));
    window.open(`https://wa.me/${tel}?text=${texto}`, "_blank");
}


/* ============================================================
   PANEL DE MENSAJERÍA (outbox de confirmaciones WhatsApp)
============================================================ */

function abrirMensajeria(){
    document.getElementById("modalMensajeria").classList.remove("oculto");
    renderMensajeria();
}

function cerrarMensajeria(){
    document.getElementById("modalMensajeria").classList.add("oculto");
}

async function renderMensajeria(){
    const resumen = document.getElementById("mensajeriaResumen");
    const lista = document.getElementById("mensajeriaLista");
    if(lista){ lista.innerHTML = `<p class="caja-vacio">Cargando...</p>`; }

    let items = [];
    try{
        const r = await fetch(`${API_URL}/api/outbox`);
        items = await r.json();
    }catch(e){
        if(lista){ lista.innerHTML = `<p class="caja-vacio">No se pudo cargar.</p>`; }
        return;
    }
    if(!Array.isArray(items)){ items = []; }

    const pend = items.filter(m => m.estado === "pendiente").length;
    const env = items.filter(m => m.estado === "enviado").length;
    const err = items.filter(m => m.estado === "error").length;

    if(resumen){
        resumen.innerHTML = `
            <div class="msj-chip msj-chip-pend">⏳ ${pend} pendientes</div>
            <div class="msj-chip msj-chip-env">✅ ${env} enviados</div>
            <div class="msj-chip msj-chip-err">⚠️ ${err} errores</div>
        `;
    }

    if(!lista){ return; }
    if(!items.length){
        lista.innerHTML = `<p class="caja-vacio">Aún no hay mensajes. Se encolan al registrar una venta con teléfono.</p>`;
        return;
    }

    // Más recientes primero
    items.sort((a, b) => new Date(b.creado) - new Date(a.creado));

    lista.innerHTML = items.map(m => {
        const icono = m.estado === "enviado" ? "✅" : (m.estado === "error" ? "⚠️" : "⏳");
        const clase = m.estado === "enviado" ? "env" : (m.estado === "error" ? "err" : "pend");
        return `
            <div class="msj-item msj-item-${clase}">
                <div class="msj-item-info">
                    <div class="msj-item-top">
                        <span class="msj-item-icono">${icono}</span>
                        <strong>${escaparTexto(m.comprador || "Sin nombre")}</strong>
                        <span class="msj-item-tel">📱 ${escaparTexto(m.telefono || "")}</span>
                    </div>
                    <div class="msj-item-sub">${escaparTexto(m.eventoNombre || "")}${m.error ? ` · ${escaparTexto(m.error)}` : ""}</div>
                </div>
                ${m.estado !== "enviado"
                    ? `<button class="btn-secundario btn-mini" onclick="reenviarMensaje(${m.id})">Reencolar</button>`
                    : ""}
            </div>
        `;
    }).join("");
}

async function reenviarMensaje(id){
    try{
        await fetch(`${API_URL}/api/outbox/${id}/reenviar`, { method: "POST" });
        mostrarToast("Mensaje reencolado", "success");
        renderMensajeria();
    }catch(e){
        mostrarToast("No se pudo reencolar", "error");
    }
}