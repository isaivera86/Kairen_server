/* =============================
   UI GENERAL
   ============================= */


function mostrarToast(
    mensaje,
    tipo = "success"
){

    const toast =
        document.getElementById("toast");

    const texto =
        document.getElementById("toastMensaje");

    const icono =
        document.getElementById("toastIcon");

    texto.textContent = mensaje;

    if(tipo === "success"){
        icono.textContent = "✅";
    }

    if(tipo === "error"){
        icono.textContent = "❌";
    }

    if(tipo === "warning"){
        icono.textContent = "⚠️";
    }

    toast.classList.remove("oculto");

    toast.classList.remove(
        "toast-success",
        "toast-error",
        "toast-warning"
    );

    toast.classList.add(
        `toast-${tipo}`
    );

    setTimeout(() => {

        toast.classList.add(
            "oculto"
        );

    }, 3000);
}


/* ============================================================
   NAVEGACION ENTRE SECCIONES

   Esta es la UNICA definicion de mostrarSeccion.
   (Antes existia una copia en navigation-override.js que la
    pisaba; eso ya quedo eliminado.)

   Notas del mapeo:
   - Hay 6 secciones pero solo 5 menus en el sidebar.
   - "nuevoRegistro" no tiene menu propio: se navega desde
     Agenda, por eso deja activo el menu de Funciones/Agenda.
============================================================ */

// Todas las secciones que pueden ocultarse.
const SECCIONES_APP = [
    "Dashboard",
    "Hoy",
    "Eventos",
    "Funciones",
    "Ventas",
    "Reservas",
    "Bot",
    "Configuracion",
    "NuevoRegistro"
];

// Todos los menus del sidebar.
const MENUS_APP = [
    "Dashboard",
    "Hoy",
    "Eventos",
    "Funciones",
    "Ventas",
    "Reservas",
    "Bot",
    "Configuracion"
];

// Que seccion y que menu se activan para cada vista.
const MAPA_NAVEGACION = {
    dashboard:     { seccion: "Dashboard",     menu: "Dashboard" },
    hoy:           { seccion: "Hoy",           menu: "Hoy" },
    eventos:       { seccion: "Eventos",       menu: "Eventos" },
    funciones:     { seccion: "Funciones",     menu: "Funciones" },
    ventas:        { seccion: "Ventas",        menu: "Ventas" },
    reservas:      { seccion: "Reservas",      menu: "Reservas" },
    bot:           { seccion: "Bot",           menu: "Bot" },
    configuracion: { seccion: "Configuracion", menu: "Configuracion" },
    // nuevoRegistro no tiene menu propio -> resalta Agenda.
    nuevoRegistro: { seccion: "NuevoRegistro", menu: "Funciones" }
};


function mostrarSeccion(seccion){

    // 1. Ocultar todas las secciones.
    SECCIONES_APP.forEach(nombre => {
        const bloque = document.getElementById(`seccion${nombre}`);
        if(bloque){ bloque.classList.add("oculto"); }
    });

    // 2. Quitar el estado activo de todos los menus.
    MENUS_APP.forEach(nombre => {
        const menu = document.getElementById(`menu${nombre}`);
        if(menu){ menu.classList.remove("active"); }
    });

    // 3. Resolver destino (con fallback a dashboard).
    const destino =
        MAPA_NAVEGACION[seccion] || MAPA_NAVEGACION.dashboard;

    // 4. Mostrar la seccion destino.
    const bloqueActivo =
        document.getElementById(`seccion${destino.seccion}`);

    if(bloqueActivo){ bloqueActivo.classList.remove("oculto"); }

    // 5. Activar el menu correspondiente.
    const menuActivo =
        document.getElementById(`menu${destino.menu}`);

    if(menuActivo){ menuActivo.classList.add("active"); }

    // ALPHA v1.6: render bajo demanda de la Vista Hoy (usa datos ya cargados).
    if(destino.seccion === "Hoy" && typeof renderVistaHoy === "function"){
        renderVistaHoy();
    }

    // Caja: panel global de ventas bajo demanda.
    if(destino.seccion === "Ventas" && typeof renderPanelVentas === "function"){
        renderPanelVentas();
    }

    // Reservas: panel de reservas del bot bajo demanda.
    if(destino.seccion === "Reservas" && typeof renderPanelReservas === "function"){
        renderPanelReservas();
    }

    // Bot: panel de configuración/estado bajo demanda.
    if(destino.seccion === "Bot" && typeof renderPanelBot === "function"){
        renderPanelBot();
    }
}


function toggleCamposCategoria(switchId, contenedorId){
    const activo = document.getElementById(switchId)?.checked;
    const contenedor = document.getElementById(contenedorId);

    if(!contenedor){ return; }

    if(activo){
        contenedor.classList.remove("oculto");
    }else{
        contenedor.classList.add("oculto");
    }
}