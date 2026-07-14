/* ============================================================
   CALENDARIO (suscripción + por evento)
   - "Sincronizar todo": suscribe el calendario en el iPhone (webcal).
     Una vez activo, TODOS los compromisos entran solos.
   - Por evento: si ya hay suscripción activa, muestra "✓ en tu
     calendario". Si no, permite agregar ese evento suelto (.ics).
   Nota: el token debe coincidir con CAL_TOKEN del servidor (def: dory2026).
============================================================ */

const CAL_TOKEN_CLIENTE = "dory2026";
const CAL_MARCA_SUSCRITO = "kairen_cal_suscrito";

function calBaseHttps(){
    return `${location.protocol}//${location.host}/api/calendario/${CAL_TOKEN_CLIENTE}`;
}
function calBaseWebcal(){
    return `webcal://${location.host}/api/calendario/${CAL_TOKEN_CLIENTE}`;
}

function calSuscrito(){
    try{ return localStorage.getItem(CAL_MARCA_SUSCRITO) === "1"; }
    catch(e){ return false; }
}

// Botón grande: suscribir todo
function suscribirCalendarioTodo(){
    try{ localStorage.setItem(CAL_MARCA_SUSCRITO, "1"); }catch(e){}
    // Abre la app Calendario del teléfono para suscribirse
    window.location.href = calBaseWebcal();
    // Refresca la interfaz para mostrar "activo"
    setTimeout(actualizarBotonCalendario, 800);
    if(typeof mostrarToast === "function"){
        mostrarToast("📅 Abriendo tu calendario para suscribir...", "success");
    }
}

// Quitar la marca (por si se quiere volver a suscribir / cambió de teléfono)
function desmarcarCalendario(){
    try{ localStorage.removeItem(CAL_MARCA_SUSCRITO); }catch(e){}
    actualizarBotonCalendario();
    if(typeof mostrarToast === "function"){
        mostrarToast("Marca de suscripción borrada", "info");
    }
}

// Actualiza el botón grande de la Agenda según el estado
function actualizarBotonCalendario(){
    const cont = document.getElementById("calSuscribirBox");
    if(!cont){ return; }
    if(calSuscrito()){
        cont.innerHTML = `
            <div class="cal-suscrito">
                <span>✅ Calendario sincronizado — tus compromisos entran solos</span>
                <button class="btn-secundario btn-mini" onclick="desmarcarCalendario()">Volver a suscribir</button>
            </div>`;
    }else{
        cont.innerHTML = `
            <button class="btn-primary cal-btn-suscribir" onclick="suscribirCalendarioTodo()">
                📅 Sincronizar mi calendario
            </button>
            <p class="cal-ayuda">Actívalo una vez y todos tus compromisos aparecerán solos en tu calendario 📲</p>`;
    }
}

/* ---------- Por evento ---------- */

// ¿Este evento ya está en el calendario? (si hay suscripción, TODOS lo están)
function eventoEnCalendario(){
    return calSuscrito();
}

// Devuelve el HTML del botón/leyenda de calendario para una tarjeta de evento
function botonCalendarioEvento(eventoId, funcionId, fecha, hora, nombre, lugar, notas){
    if(eventoEnCalendario()){
        return `<span class="cal-evento-ok">✓ En tu calendario</span>`;
    }
    const datos = encodeURIComponent(JSON.stringify({ eventoId, funcionId, fecha, hora, nombre, lugar, notas }));
    return `<button class="btn-secundario btn-mini" onclick="agregarEventoCalendario('${datos}')">📅 Agregar este</button>`;
}

// Genera un .ics de un solo evento y lo abre (el teléfono ofrece "Agregar a calendario")
function agregarEventoCalendario(datosEnc){
    let d;
    try{ d = JSON.parse(decodeURIComponent(datosEnc)); }catch(e){ return; }

    const ics = generarICSUnEvento(d);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    // Abrir en nueva pestaña -> el sistema ofrece agregar al calendario
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    if(typeof mostrarToast === "function"){
        mostrarToast("📅 Abriendo evento para agregar...", "success");
    }
}

function icsEscCliente(t){
    return String(t || "")
        .replace(/\\/g, "\\\\").replace(/;/g, "\\;")
        .replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function icsFechaCliente(fecha, hora){
    const f = String(fecha || "").replace(/-/g, "");
    const p = String(hora || "00:00").split(":");
    const hh = (p[0] || "00").padStart(2, "0");
    const mm = (p[1] || "00").padStart(2, "0");
    return `${f}T${hh}${mm}00`;
}
function icsFinCliente(fecha, hora){
    try{
        const [a, m, dd] = String(fecha).split("-").map(n => parseInt(n, 10));
        const [hh, mm] = String(hora || "00:00").split(":").map(n => parseInt(n, 10));
        const dt = new Date(a, m - 1, dd, hh || 0, mm || 0);
        dt.setHours(dt.getHours() + 2);
        const z = (n) => String(n).padStart(2, "0");
        return `${dt.getFullYear()}${z(dt.getMonth()+1)}${z(dt.getDate())}T${z(dt.getHours())}${z(dt.getMinutes())}00`;
    }catch(e){ return icsFechaCliente(fecha, hora); }
}

function generarICSUnEvento(d){
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    let ics = "";
    ics += "BEGIN:VCALENDAR\r\n";
    ics += "VERSION:2.0\r\n";
    ics += "PRODID:-//Kairen//Agenda//ES\r\n";
    ics += "BEGIN:VEVENT\r\n";
    ics += `UID:kairen-${d.eventoId}-${d.funcionId}@kairen\r\n`;
    ics += `DTSTAMP:${stamp}\r\n`;
    ics += `DTSTART:${icsFechaCliente(d.fecha, d.hora)}\r\n`;
    ics += `DTEND:${icsFinCliente(d.fecha, d.hora)}\r\n`;
    ics += `SUMMARY:${icsEscCliente(d.nombre || "Compromiso")}\r\n`;
    if(d.lugar){ ics += `LOCATION:${icsEscCliente(d.lugar)}\r\n`; }
    if(d.notas){ ics += `DESCRIPTION:${icsEscCliente(d.notas)}\r\n`; }
    ics += "BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Recordatorio\r\nTRIGGER:-P1D\r\nEND:VALARM\r\n";
    ics += "END:VEVENT\r\n";
    ics += "END:VCALENDAR\r\n";
    return ics;
}
