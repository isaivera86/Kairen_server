/* =============================
   ARRANQUE PRINCIPAL
   ============================= */

async function iniciarApp(){
    try{ await cargarConfiguracion(); }
    catch(e){ console.warn("Config sin conexión:", e); }

    try{ await cargarCatalogoTipos(); }
    catch(e){ console.warn("Tipos sin conexión:", e); }

    try{ await cargarEventos(); }
    catch(e){ console.warn("Eventos sin conexión:", e); }

    mostrarSeccion("hoy");
}

iniciarApp();