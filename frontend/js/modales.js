/* =============================
   MODALES Y CONFIRMACION
   ============================= */

var accionConfirmada = null;

/* =============================
   MODALES
   ============================= */


function abrirConfirmacion(titulo, mensaje, accion){

    document.getElementById("confirmacionTitulo").textContent =
        titulo;

    document.getElementById("confirmacionMensaje").textContent =
        mensaje;

    accionConfirmada = accion;

    document
        .getElementById("modalConfirmacion")
        .classList
        .remove("oculto");
}


function cerrarConfirmacion(){

    accionConfirmada = null;

    document
        .getElementById("modalConfirmacion")
        .classList
        .add("oculto");
}


function abrirModalNuevoEvento(){

    descuentosTemporales = [];
    pintarDescuentosTemp();

    document.getElementById("nombre").value = "";
    document.getElementById("lugar").value = "";
    document.getElementById("imagen").value = "";
    document.getElementById("fecha").value = "";
    document.getElementById("hora").value = "";

    document.getElementById("generalPreventa").value = "";
    document.getElementById("generalPrecio").value = "";
    document.getElementById("generalBoletos").value = "";

    document.getElementById("activarPreferente").checked = false;
    document.getElementById("preferentePreventa").value = "";
    document.getElementById("preferentePrecio").value = "";
    document.getElementById("preferenteBoletos").value = "";

    document.getElementById("activarVip").checked = false;
    document.getElementById("vipPreventa").value = "";
    document.getElementById("vipPrecio").value = "";
    document.getElementById("vipBoletos").value = "";

    document.body.classList.add("modal-abierto");

    document
        .getElementById("modalNuevoEvento")
        .classList
        .remove("oculto");
}


function cerrarModalNuevoEvento(){
    
    document
        .getElementById("modalNuevoEvento")
        .classList
        .add("oculto");

    document.body.classList.remove("modal-abierto");    
}


async function crearEvento(boton){

    iniciarCarga(boton, "Guardando...");

    const evento = {
        nombre: document.getElementById("nombre").value,
        lugar: document.getElementById("lugar").value,
        imagen: document.getElementById("imagen").value,
        fecha: document.getElementById("fecha").value,
        hora: document.getElementById("hora").value,
        descuentos: [...descuentosTemporales],

        categorias: {
            general: {
                preventa: Number(
                    document.getElementById("generalPreventa").value
                ),
                precio: Number(
                    document.getElementById("generalPrecio").value
                ),
                boletos: Number(
                    document.getElementById("generalBoletos").value
                )
            },

            preferente: {
                activa:
                    document.getElementById("activarPreferente").checked,
                preventa: Number(
                    document.getElementById("preferentePreventa").value
                ),
                precio: Number(
                    document.getElementById("preferentePrecio").value
                ),
                boletos: Number(
                    document.getElementById("preferenteBoletos").value
                )
            },

            vip: {
                activa:
                    document.getElementById("activarVip").checked,
                preventa: Number(
                    document.getElementById("vipPreventa").value
                ),
                precio: Number(
                    document.getElementById("vipPrecio").value
                ),
                boletos: Number(
                    document.getElementById("vipBoletos").value
                )
            }
        }
    };

    const envioEv =
        await crearConCola(`${API_URL}/api/eventos`, evento, `Evento: ${evento.nombre}`);

    if(!envioEv.online){
        mostrarToast("Evento guardado sin conexión ⏳ (se subirá al reconectar)", "success");
    } else {
        const resultado = envioEv.data || {};
        mostrarToast(resultado.mensaje || "Evento creado", "success");
    }

    document.getElementById("nombre").value = "";
    document.getElementById("lugar").value = "";
    document.getElementById("imagen").value = "";
    document.getElementById("fecha").value = "";
    document.getElementById("hora").value = "";

    document.getElementById("generalPreventa").value = "";
    document.getElementById("generalPrecio").value = "";
    document.getElementById("generalBoletos").value = "";

    document.getElementById("activarPreferente").checked = false;
    document.getElementById("preferentePreventa").value = "";
    document.getElementById("preferentePrecio").value = "";
    document.getElementById("preferenteBoletos").value = "";

    document.getElementById("activarVip").checked = false;
    document.getElementById("vipPreventa").value = "";
    document.getElementById("vipPrecio").value = "";
    document.getElementById("vipBoletos").value = "";

    descuentosTemporales = [];
    pintarDescuentosTemp();

    cerrarModalNuevoEvento();

    cargarEventos();

    terminarCarga(boton);
}


// Botón principal del modal de confirmación.
document.addEventListener("DOMContentLoaded", function(){
    const botonConfirmar = document.getElementById("btnConfirmarAccion");

    if(!botonConfirmar){ return; }

    botonConfirmar.addEventListener("click", async function(){
        if(accionConfirmada){
            await accionConfirmada();
        }

        cerrarConfirmacion();
    });
});


/* ============================================================
   PROMPT REUTILIZABLE (input bonito en vez del prompt() del sistema)

   Uso:
     abrirPrompt("Editar pendiente", textoActual, function(nuevoValor){
         // lo que pasa al guardar (nuevoValor ya viene validado y trim)
     });
============================================================ */

var accionPrompt = null;

function abrirPrompt(titulo, valorInicial, accion){

    document.getElementById("promptTitulo").textContent =
        titulo;

    const input =
        document.getElementById("promptInput");

    input.value = valorInicial || "";

    accionPrompt = accion;

    document
        .getElementById("modalPrompt")
        .classList
        .remove("oculto");

    // Foco + seleccionar el texto para editar cómodo.
    setTimeout(function(){
        input.focus();
        input.select();
    }, 50);
}

function cerrarPrompt(){

    accionPrompt = null;

    document
        .getElementById("modalPrompt")
        .classList
        .add("oculto");
}

// Botón principal + tecla Enter del prompt.
document.addEventListener("DOMContentLoaded", function(){

    const botonGuardar =
        document.getElementById("btnPromptGuardar");

    const input =
        document.getElementById("promptInput");

    if(!botonGuardar || !input){ return; }

    async function confirmarPrompt(){

        const valor =
            input.value.trim();

        if(!valor){
            mostrarToast("No puede quedar vacío", "warning");
            return;
        }

        const accion = accionPrompt;

        cerrarPrompt();

        if(accion){
            await accion(valor);
        }
    }

    botonGuardar.addEventListener("click", confirmarPrompt);

    input.addEventListener("keydown", function(evento){
        if(evento.key === "Enter"){
            confirmarPrompt();
        }
    });
});