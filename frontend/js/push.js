/* ============================================================
   NOTIFICACIONES PUSH (frontend)
   - Pide permiso, se suscribe y guarda la suscripción en Kairen.
   - Botón de prueba.
   Requiere: PWA instalada (iPhone) + iOS 16.4+.
============================================================ */

function urlB64ToUint8Array(base64String){
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for(let i = 0; i < raw.length; i++){ arr[i] = raw.charCodeAt(i); }
    return arr;
}

function pushSoportado(){
    return ("serviceWorker" in navigator) && ("PushManager" in window) && ("Notification" in window);
}

async function activarNotificaciones(){
    if(!pushSoportado()){
        mostrarToast("Tu dispositivo no soporta notificaciones aquí. En iPhone, instala la app primero.", "warning");
        return;
    }
    try{
        const permiso = await Notification.requestPermission();
        if(permiso !== "granted"){
            mostrarToast("Permiso de notificaciones no concedido", "warning");
            actualizarBotonPush();
            return;
        }

        const reg = await navigator.serviceWorker.ready;

        // Trae la llave pública del servidor
        const rv = await fetch(`${API_URL}/api/push/vapid`);
        const { publicKey } = await rv.json();

        // Suscribe
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array(publicKey)
        });

        // Guarda la suscripción en Kairen
        await fetch(`${API_URL}/api/push/subscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: sub })
        });

        try{ localStorage.setItem("kairen_push_activo", "1"); }catch(e){}
        mostrarToast("🔔 Notificaciones activadas", "success");
        actualizarBotonPush();
    }catch(e){
        mostrarToast("No se pudieron activar: " + e.message, "error");
    }
}

async function probarNotificacion(){
    try{
        const r = await fetch(`${API_URL}/api/push/test`, { method: "POST" });
        const res = await r.json();
        if(res.enviados > 0){
            mostrarToast("📨 Notificación de prueba enviada", "success");
        }else{
            mostrarToast("No hay dispositivos suscritos aún (activa primero)", "warning");
        }
    }catch(e){
        mostrarToast("No se pudo enviar la prueba", "error");
    }
}

function pushActivo(){
    try{ return localStorage.getItem("kairen_push_activo") === "1" && Notification.permission === "granted"; }
    catch(e){ return false; }
}

function actualizarBotonPush(){
    const cont = document.getElementById("pushBox");
    if(!cont){ return; }
    if(!pushSoportado()){
        cont.innerHTML = `<p class="cal-ayuda">🔕 Para notificaciones, abre Kairen como app instalada.</p>`;
        return;
    }
    if(pushActivo()){
        cont.innerHTML = `
            <div class="cal-suscrito">
                <span>🔔 Notificaciones activadas</span>
                <button class="btn-secundario btn-mini" onclick="probarNotificacion()">Enviar prueba</button>
            </div>`;
    }else{
        cont.innerHTML = `
            <button class="btn-secundario cal-btn-suscribir" onclick="activarNotificaciones()">
                🔔 Activar notificaciones
            </button>
            <p class="cal-ayuda">Recibe tu resumen semanal cada domingo 🌙</p>`;
    }
}
