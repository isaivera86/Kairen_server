const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.static(path.join(__dirname, "../frontend")));

// ALPHA v1.16: carpeta de datos configurable para persistencia en Railway.
// En Railway: monta un Volume y pon DATA_DIR=/data -> db.json y uploads
// viven en el volumen y sobreviven los redeploys.
// En local: por defecto usa ../database (comportamiento de siempre).
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "../database");
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}

const dbPath = path.join(DATA_DIR, "db.json");
const uploadsDir = path.join(DATA_DIR, "uploads");
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) {}
app.use("/uploads", express.static(uploadsDir));

// Si el volumen está vacío (primer arranque), sembrar db.json:
// copiar la plantilla del repo o crear una estructura mínima.
if(!fs.existsSync(dbPath)){
  const plantilla = path.join(__dirname, "../database/db.json");
  if(fs.existsSync(plantilla) && plantilla !== dbPath){
    fs.copyFileSync(plantilla, dbPath);
  }else{
    fs.writeFileSync(dbPath, JSON.stringify({ eventos: [], configuracion: {}, tiposRegistro: {} }, null, 2));
  }
}

function leerDB() {
  const data = fs.readFileSync(dbPath, "utf8");
  return JSON.parse(data);
}

function guardarDB(data) {
  fs.writeFileSync(
    dbPath,
    JSON.stringify(data, null, 2)
  );
}


function crearCategoriasVacias() {
  return {
    general: {
      preventa: 0,
      precio: 0,
      boletos: 0
    },
    preferente: {
      activa: false,
      preventa: 0,
      precio: 0,
      boletos: 0
    },
    vip: {
      activa: false,
      preventa: 0,
      precio: 0,
      boletos: 0
    }
  };
}

function normalizarTipoRegistro(tipo) {
  const tiposPermitidos = [
    "funcion",
    "activacion",
    "clase",
    "ensayo",
    "grabacion",
    "especial",
    "traslado",
    "mantenimiento"
  ];

  return tiposPermitidos.includes(tipo) ? tipo : "funcion";
}

function crearTimeline(tipoRegistro) {
  return [
    {
      id: Date.now(),
      tipo: "creacion",
      mensaje: `Registro creado (${tipoRegistro})`,
      fecha: new Date().toISOString()
    }
  ];
}

function crearChecklistBase(tipoRegistro) {
  return [];
}


app.get("/", (req, res) => {
  res.send("Servidor de boletera funcionando");
});


app.post("/api/registros", (req, res) => {

  const db = leerDB();

  const {
    tipoRegistro,
    nombre,
    lugar,
    fecha,
    hora,
    contacto,
    telefono,
    notas,
    recurrencia
  } = req.body;

  const tipoFinal = normalizarTipoRegistro(tipoRegistro);

  if (!nombre || !lugar || !fecha || !hora) {
    return res.status(400).json({
      mensaje: "Faltan datos obligatorios"
    });
  }

  if (!db.eventos) {
    db.eventos = [];
  }

  const nuevoRegistro = {
    id: Date.now(),
    tipoRegistro: tipoFinal,
    nombre,
    lugar,
    imagen: "",
    activo: true,
    contacto: contacto || "",
    telefono: telefono || "",
    notas: notas || "",
    checklist: crearChecklistBase(tipoFinal),
    documentos: [],
    contactos: contacto ? [
      {
        id: 1,
        nombre: contacto,
        telefono: telefono || ""
      }
    ] : [],
    timeline: crearTimeline(tipoFinal),
    funciones: [
      {
        id: 1,
        tipoRegistro: tipoFinal,
        fecha,
        hora,
        categorias: crearCategoriasVacias(),
        descuentos: [],
        descuentosActivos: true,
        precio: 0,
        boletosDisponibles: 0,
        contacto: contacto || "",
        telefono: telefono || "",
        notas: notas || "",
        checklist: crearChecklistBase(tipoFinal),
        timeline: crearTimeline(tipoFinal),
        estado: "pendiente",
        activa: true,
        recurrencia: recurrencia || null
      }
    ]
  };

  db.eventos.push(nuevoRegistro);

  guardarDB(db);

  res.json({
    mensaje: "Registro creado correctamente",
    registro: nuevoRegistro
  });
});


app.get("/api/configuracion", (req, res) => {
  const db = leerDB();
  res.json(db.configuracion);
});

app.get("/api/eventos", (req, res) => {
  const db = leerDB();
  res.json(db.eventos);
});

app.post("/api/eventos", (req, res) => {

  const db = leerDB();

  const {
    nombre,
    lugar,
    imagen,
    fecha,
    hora,
    categorias,
    descuentos
  } = req.body;

  const categoriasFinales = {
    general: {
      preventa: Number(categorias?.general?.preventa || 0),
      precio: Number(categorias?.general?.precio || 0),
      boletos: Number(categorias?.general?.boletos || 0)
    },

    preferente: {
      activa: Boolean(categorias?.preferente?.activa),
      preventa: Number(categorias?.preferente?.preventa || 0),
      precio: Number(categorias?.preferente?.precio || 0),
      boletos: Number(categorias?.preferente?.boletos || 0)
    },

    vip: {
      activa: Boolean(categorias?.vip?.activa),
      preventa: Number(categorias?.vip?.preventa || 0),
      precio: Number(categorias?.vip?.precio || 0),
      boletos: Number(categorias?.vip?.boletos || 0)
    }
  };

  const boletosTotales =
    categoriasFinales.general.boletos +
    (
      categoriasFinales.preferente.activa
        ? categoriasFinales.preferente.boletos
        : 0
    ) +
    (
      categoriasFinales.vip.activa
        ? categoriasFinales.vip.boletos
        : 0
    );

  const precioBase =
    categoriasFinales.general.precio;

  const nuevoEvento = {
    id: Date.now(),
    tipoRegistro: "funcion",
    nombre,
    lugar,
    imagen: imagen || "",
    activo: true,
    checklist: [],
    documentos: [],
    contactos: [],
    timeline: crearTimeline("funcion"),
    funciones: [
      {
        id: 1,
        tipoRegistro: "funcion",
        fecha,
        hora,

        categorias: categoriasFinales,

        descuentos: descuentos || [],

        precio: precioBase,
        boletosDisponibles: boletosTotales,

        estado: "pendiente",
        activa: true
      }
    ]
  };

  db.eventos.push(nuevoEvento);

  guardarDB(db);

  res.json({
    mensaje: "Evento creado correctamente"
  });

});

app.patch("/api/eventos/:id/toggle", (req, res) => {

  const db = leerDB();

  const eventoId = Number(req.params.id);

  const evento = db.eventos.find(
    item => item.id === eventoId
  );

  if (!evento) {
    return res.status(404).json({
      mensaje: "Evento no encontrado"
    });
  }

  evento.activo = !evento.activo;

  guardarDB(db);

  res.json({
    mensaje: "Estado del evento actualizado",
    evento
  });

});

app.post("/api/eventos/:id/funciones", (req, res) => {

  const db = leerDB();

  const eventoId = Number(req.params.id);

  const evento = db.eventos.find(
    item => item.id === eventoId
  );

  if (!evento) {
    return res.status(404).json({
      mensaje: "Evento no encontrado"
    });
  }

  const {
    fecha,
    hora,
    precio,
    boletosDisponibles,
    categorias,
    descuentos
  } = req.body;

  const categoriasFinales = categorias || {
    general: {
      preventa: Number(precio || 0),
      precio: Number(precio || 0),
      boletos: Number(boletosDisponibles || 0)
    },

    preferente: {
      activa: false,
      preventa: 0,
      precio: 0,
      boletos: 0
    },

    vip: {
      activa: false,
      preventa: 0,
      precio: 0,
      boletos: 0
    }
  };

  const boletosTotales =
    Number(categoriasFinales.general?.boletos || 0) +
    (
      categoriasFinales.preferente?.activa
        ? Number(categoriasFinales.preferente?.boletos || 0)
        : 0
    ) +
    (
      categoriasFinales.vip?.activa
        ? Number(categoriasFinales.vip?.boletos || 0)
        : 0
    );

  const nuevaFuncion = {
    id: Date.now(),
    fecha,
    hora,
    categorias: categoriasFinales,
    descuentos: descuentos || [],

    // Compatibilidad temporal
    precio: Number(categoriasFinales.general?.precio || precio || 0),
    boletosDisponibles: boletosTotales,

    activa: true
  };

  evento.funciones.push(nuevaFuncion);

  guardarDB(db);

  res.json({
    mensaje: "Función agregada correctamente",
    funcion: nuevaFuncion
  });

});

app.patch("/api/eventos/:eventoId/funciones/:funcionId/toggle", (req, res) => {

  const db = leerDB();

  const eventoId = Number(req.params.eventoId);
  const funcionId = Number(req.params.funcionId);

  const evento = db.eventos.find(
    item => item.id === eventoId
  );

  if (!evento) {
    return res.status(404).json({
      mensaje: "Evento no encontrado"
    });
  }

  const funcion = evento.funciones.find(
    item => item.id === funcionId
  );

  if (!funcion) {
    return res.status(404).json({
      mensaje: "Función no encontrada"
    });
  }

  funcion.activa = !funcion.activa;

  guardarDB(db);

  res.json({
    mensaje: "Estado de función actualizado"
  });

});

app.delete("/api/eventos/:eventoId/funciones/:funcionId", (req, res) => {

  const db = leerDB();

  const eventoId = Number(req.params.eventoId);
  const funcionId = Number(req.params.funcionId);

  const evento = db.eventos.find(
    item => item.id === eventoId
  );

  if (!evento) {
    return res.status(404).json({
      mensaje: "Evento no encontrado"
    });
  }

  evento.funciones = evento.funciones.filter(
    funcion => funcion.id !== funcionId
  );

  guardarDB(db);

  res.json({
    mensaje: "Función eliminada correctamente"
  });

});

app.put("/api/eventos/:eventoId/funciones/:funcionId", (req, res) => {

  const db = leerDB();

  const eventoId = Number(req.params.eventoId);
  const funcionId = Number(req.params.funcionId);

  const evento = db.eventos.find(
    item => item.id === eventoId
  );

  if (!evento) {
    return res.status(404).json({
      mensaje: "Evento no encontrado"
    });
  }

  const funcion = evento.funciones.find(
    item => item.id === funcionId
  );

  if (!funcion) {
    return res.status(404).json({
      mensaje: "Función no encontrada"
    });
  }

  const {
    fecha,
    hora,
    categorias,
    precio,
    boletosDisponibles,
    descuentos,
    nombre,
    lugar,
    imagen
  } = req.body;

  const categoriasFinales = categorias || {
    general: {
      preventa: Number(precio || 0),
      precio: Number(precio || 0),
      boletos: Number(boletosDisponibles || 0)
    },

    preferente: {
      activa: false,
      preventa: 0,
      precio: 0,
      boletos: 0
    },

    vip: {
      activa: false,
      preventa: 0,
      precio: 0,
      boletos: 0
    }
  };

  const boletosTotales =
    Number(categoriasFinales.general?.boletos || 0) +
    (
      categoriasFinales.preferente?.activa
        ? Number(categoriasFinales.preferente?.boletos || 0)
        : 0
    ) +
    (
      categoriasFinales.vip?.activa
        ? Number(categoriasFinales.vip?.boletos || 0)
        : 0
    );

  funcion.fecha = fecha;
  funcion.hora = hora;
  funcion.categorias = categoriasFinales;
  funcion.precio = Number(categoriasFinales.general?.precio || precio || 0);
  funcion.boletosDisponibles = boletosTotales;

  if(descuentos){
    funcion.descuentos = descuentos;
  }

  // Alpha v1.17: editor unificado. Si vienen datos del evento, actualizarlos
  // (nombre/lugar/imagen son a nivel evento, compartidos por sus funciones).
  if(typeof nombre === "string" && nombre.trim()){ evento.nombre = nombre.trim(); }
  if(typeof lugar === "string"){ evento.lugar = lugar.trim(); }
  if(typeof imagen === "string"){ evento.imagen = imagen.trim(); }

  guardarDB(db);

  res.json({
    mensaje: "Función actualizada correctamente"
  });

});

app.delete("/api/eventos/:id", (req, res) => {

  const db = leerDB();

  const eventoId = Number(req.params.id);

  const eventoExiste = db.eventos.find(
    evento => evento.id === eventoId
  );

  if (!eventoExiste) {
    return res.status(404).json({
      mensaje: "Evento no encontrado"
    });
  }

  db.eventos = db.eventos.filter(
    evento => evento.id !== eventoId
  );

  guardarDB(db);

  res.json({
    mensaje: "Evento eliminado correctamente"
  });

});


/* ============================================================
   ALPHA v1.8: EDITAR OPERACIÓN

   Edita solo datos básicos del registro (nombre, lugar, fecha,
   hora, contacto, teléfono, notas). NO toca checklist, material,
   estado, categorías, descuentos ni ventas. Ruta distinta a la
   del editor de Función (que vive en PUT .../funciones/:funcionId).
============================================================ */

app.put("/api/eventos/:eventoId/funciones/:funcionId/datos", (req, res) => {

  const db = leerDB();

  const eventoId = Number(req.params.eventoId);
  const funcionId = Number(req.params.funcionId);

  const evento = db.eventos.find(item => item.id === eventoId);
  if (!evento) return res.status(404).json({ mensaje: "Registro no encontrado" });

  const funcion = evento.funciones.find(item => item.id === funcionId);
  if (!funcion) return res.status(404).json({ mensaje: "Fecha del registro no encontrada" });

  const nombre = String(req.body.nombre || "").trim();
  const lugar = String(req.body.lugar || "").trim();
  const fecha = String(req.body.fecha || "").trim();
  const hora = String(req.body.hora || "").trim();

  if (!nombre || !lugar || !fecha || !hora) {
    return res.status(400).json({ mensaje: "Completa nombre, lugar, fecha y hora" });
  }

  // Datos de nivel evento.
  evento.nombre = nombre;
  evento.lugar = lugar;

  // Datos de nivel función (operación).
  funcion.fecha = fecha;
  funcion.hora = hora;
  funcion.contacto = String(req.body.contacto || "").trim();
  funcion.telefono = String(req.body.telefono || "").trim();
  funcion.notas = String(req.body.notas || "").trim();

  // Sprint Recurrencia: guardar/actualizar la regla (null = no repetir).
  funcion.recurrencia = req.body.recurrencia || null;

  const movimiento = {
    id: Date.now(),
    tipo: "edicion",
    mensaje: "Operación editada",
    fecha: new Date().toISOString()
  };

  if (!funcion.timeline) funcion.timeline = [];
  if (!evento.timeline) evento.timeline = [];
  funcion.timeline.push(movimiento);
  evento.timeline.push({ ...movimiento, id: Date.now() + 1 });

  guardarDB(db);

  res.json({ mensaje: "Operación actualizada" });
});


app.put("/api/eventos/:id", (req, res) => {

  const db = leerDB();

  const eventoId = Number(req.params.id);

  const evento = db.eventos.find(
    item => item.id === eventoId
  );

  if (!evento) {
    return res.status(404).json({
      mensaje: "Evento no encontrado"
    });
  }

const {
  nombre,
  lugar,
  imagen
} = req.body;

  evento.nombre = nombre;
  evento.lugar = lugar;
  evento.imagen = imagen || "";

  guardarDB(db);

  res.json({
    mensaje: "Evento actualizado correctamente"
  });

});

app.patch("/api/configuracion/bot/toggle", (req, res) => {

  const db = leerDB();

  db.configuracion.botActivo =
    !db.configuracion.botActivo;

  guardarDB(db);

  res.json({
    mensaje: "Estado del bot actualizado",
    configuracion: db.configuracion
  });

});

app.put("/api/configuracion/nombre", (req, res) => {

  const db = leerDB();

  const { nombreSistema } = req.body;

  db.configuracion.nombreSistema = nombreSistema;

  guardarDB(db);

  res.json({
    mensaje: "Nombre actualizado correctamente",
    configuracion: db.configuracion
  });

});

app.delete("/api/eventos/:eventoId/funciones/:funcionId/descuentos/:index", (req, res) => {

  const db = leerDB();

  const eventoId = Number(req.params.eventoId);
  const funcionId = Number(req.params.funcionId);
  const index = Number(req.params.index);

  const evento = db.eventos.find(
    item => item.id === eventoId
  );

  if (!evento) {
    return res.status(404).json({
      mensaje: "Evento no encontrado"
    });
  }

  const funcion = evento.funciones.find(
    item => item.id === funcionId
  );

  if (!funcion) {
    return res.status(404).json({
      mensaje: "Función no encontrada"
    });
  }

  if (!funcion.descuentos) {
    funcion.descuentos = [];
  }

  funcion.descuentos.splice(index, 1);

  guardarDB(db);

  res.json({
    mensaje: "Descuento eliminado correctamente"
  });

});

app.post("/api/eventos/:eventoId/funciones/:funcionId/descuentos", (req, res) => {

  const db = leerDB();

  const eventoId = Number(req.params.eventoId);
  const funcionId = Number(req.params.funcionId);

  const evento = db.eventos.find(
    item => item.id === eventoId
  );

  if (!evento) {
    return res.status(404).json({
      mensaje: "Evento no encontrado"
    });
  }

  const funcion = evento.funciones.find(
    item => item.id === funcionId
  );

  if (!funcion) {
    return res.status(404).json({
      mensaje: "Función no encontrada"
    });
  }

  const {
    codigo,
    tipo,
    valor
  } = req.body;

  if (!funcion.descuentos) {
    funcion.descuentos = [];
  }

  funcion.descuentos.push({
    codigo,
    tipo,
    valor: Number(valor),
    activo: true
  });

  guardarDB(db);

  res.json({
    mensaje: "Descuento agregado correctamente"
  });

});

app.patch("/api/eventos/:eventoId/funciones/:funcionId/descuentos/toggle", (req, res) => {

  const db = leerDB();

  const eventoId = Number(req.params.eventoId);
  const funcionId = Number(req.params.funcionId);

  const evento = db.eventos.find(item => item.id === eventoId);

  if (!evento) {
    return res.status(404).json({
      mensaje: "Evento no encontrado"
    });
  }

  const funcion = evento.funciones.find(item => item.id === funcionId);

  if (!funcion) {
    return res.status(404).json({
      mensaje: "Función no encontrada"
    });
  }

  funcion.descuentosActivos =
    !Boolean(funcion.descuentosActivos);

  guardarDB(db);

  res.json({
    mensaje: "Estado de descuentos actualizado"
  });

});


app.patch("/api/eventos/:eventoId/funciones/:funcionId/checklist/:itemId/toggle", (req, res) => {

  const db = leerDB();

  const eventoId = Number(req.params.eventoId);
  const funcionId = Number(req.params.funcionId);
  const itemId = Number(req.params.itemId);

  const evento = db.eventos.find(item => item.id === eventoId);

  if (!evento) {
    return res.status(404).json({
      mensaje: "Registro no encontrado"
    });
  }

  const funcion = evento.funciones.find(item => item.id === funcionId);

  if (!funcion) {
    return res.status(404).json({
      mensaje: "Fecha del registro no encontrada"
    });
  }

  if (!funcion.checklist && evento.checklist) {
    funcion.checklist = JSON.parse(JSON.stringify(evento.checklist));
  }

  if (!funcion.checklist) {
    funcion.checklist = [];
  }

  const itemChecklist = funcion.checklist.find(item => Number(item.id) === itemId);

  if (!itemChecklist) {
    return res.status(404).json({
      mensaje: "Item de checklist no encontrado"
    });
  }

  itemChecklist.completado = !Boolean(itemChecklist.completado);

  if (!funcion.timeline) {
    funcion.timeline = [];
  }

  funcion.timeline.push({
    id: Date.now(),
    tipo: "checklist",
    mensaje: `${itemChecklist.completado ? "Completado" : "Reabierto"}: ${itemChecklist.texto}`,
    fecha: new Date().toISOString()
  });

  if (!evento.timeline) {
    evento.timeline = [];
  }

  evento.timeline.push({
    id: Date.now(),
    tipo: "checklist",
    mensaje: `${itemChecklist.completado ? "Completado" : "Reabierto"}: ${itemChecklist.texto}`,
    fecha: new Date().toISOString()
  });

  guardarDB(db);

  res.json({
    mensaje: "Checklist actualizado correctamente",
    checklist: funcion.checklist
  });

});



app.post("/api/eventos/:eventoId/funciones/:funcionId/checklist", (req, res) => {
  const db = leerDB();
  const eventoId = Number(req.params.eventoId);
  const funcionId = Number(req.params.funcionId);
  const texto = String(req.body.texto || "").trim();

  if (!texto) return res.status(400).json({ mensaje: "Escribe el pendiente" });

  const evento = db.eventos.find(item => item.id === eventoId);
  if (!evento) return res.status(404).json({ mensaje: "Registro no encontrado" });

  const funcion = evento.funciones.find(item => item.id === funcionId);
  if (!funcion) return res.status(404).json({ mensaje: "Fecha del registro no encontrada" });

  if (!funcion.checklist) funcion.checklist = [];

  const nuevoItem = { id: Date.now(), texto, completado: false };
  funcion.checklist.push(nuevoItem);

  const movimiento = {
    id: Date.now() + 1,
    tipo: "checklist",
    mensaje: `Pendiente agregado: ${texto}`,
    fecha: new Date().toISOString()
  };

  if (!funcion.timeline) funcion.timeline = [];
  if (!evento.timeline) evento.timeline = [];
  funcion.timeline.push(movimiento);
  evento.timeline.push({ ...movimiento, id: Date.now() + 2 });

  guardarDB(db);
  res.json({ mensaje: "Pendiente agregado", item: nuevoItem, checklist: funcion.checklist });
});

app.put("/api/eventos/:eventoId/funciones/:funcionId/checklist/:itemId", (req, res) => {
  const db = leerDB();
  const eventoId = Number(req.params.eventoId);
  const funcionId = Number(req.params.funcionId);
  const itemId = Number(req.params.itemId);
  const texto = String(req.body.texto || "").trim();

  if (!texto) return res.status(400).json({ mensaje: "Escribe el nuevo nombre del pendiente" });

  const evento = db.eventos.find(item => item.id === eventoId);
  if (!evento) return res.status(404).json({ mensaje: "Registro no encontrado" });

  const funcion = evento.funciones.find(item => item.id === funcionId);
  if (!funcion) return res.status(404).json({ mensaje: "Fecha del registro no encontrada" });

  if (!funcion.checklist) funcion.checklist = [];
  const itemChecklist = funcion.checklist.find(item => Number(item.id) === itemId);
  if (!itemChecklist) return res.status(404).json({ mensaje: "Pendiente no encontrado" });

  const anterior = itemChecklist.texto;
  itemChecklist.texto = texto;

  const movimiento = {
    id: Date.now(),
    tipo: "checklist",
    mensaje: `Pendiente renombrado: ${anterior} -> ${texto}`,
    fecha: new Date().toISOString()
  };

  if (!funcion.timeline) funcion.timeline = [];
  if (!evento.timeline) evento.timeline = [];
  funcion.timeline.push(movimiento);
  evento.timeline.push({ ...movimiento, id: Date.now() + 1 });

  guardarDB(db);
  res.json({ mensaje: "Pendiente actualizado", item: itemChecklist, checklist: funcion.checklist });
});

app.delete("/api/eventos/:eventoId/funciones/:funcionId/checklist/:itemId", (req, res) => {
  const db = leerDB();
  const eventoId = Number(req.params.eventoId);
  const funcionId = Number(req.params.funcionId);
  const itemId = Number(req.params.itemId);

  const evento = db.eventos.find(item => item.id === eventoId);
  if (!evento) return res.status(404).json({ mensaje: "Registro no encontrado" });

  const funcion = evento.funciones.find(item => item.id === funcionId);
  if (!funcion) return res.status(404).json({ mensaje: "Fecha del registro no encontrada" });

  if (!funcion.checklist) funcion.checklist = [];
  const index = funcion.checklist.findIndex(item => Number(item.id) === itemId);
  if (index === -1) return res.status(404).json({ mensaje: "Pendiente no encontrado" });

  const eliminado = funcion.checklist.splice(index, 1)[0];

  const movimiento = {
    id: Date.now(),
    tipo: "checklist",
    mensaje: `Pendiente eliminado: ${eliminado.texto}`,
    fecha: new Date().toISOString()
  };

  if (!funcion.timeline) funcion.timeline = [];
  if (!evento.timeline) evento.timeline = [];
  funcion.timeline.push(movimiento);
  evento.timeline.push({ ...movimiento, id: Date.now() + 1 });

  guardarDB(db);
  res.json({ mensaje: "Pendiente eliminado", checklist: funcion.checklist });
});


/* ============================================================
   ALPHA v1.7: MATERIAL POR OPERACIÓN
   Material = cosas que llevar/preparar (distinto del checklist).
   Item: { id, nombre, listo }
============================================================ */

app.post("/api/eventos/:eventoId/funciones/:funcionId/material", (req, res) => {
  const db = leerDB();
  const eventoId = Number(req.params.eventoId);
  const funcionId = Number(req.params.funcionId);
  const nombre = String(req.body.nombre || "").trim();

  if (!nombre) return res.status(400).json({ mensaje: "Escribe el material" });

  const evento = db.eventos.find(item => item.id === eventoId);
  if (!evento) return res.status(404).json({ mensaje: "Registro no encontrado" });

  const funcion = evento.funciones.find(item => item.id === funcionId);
  if (!funcion) return res.status(404).json({ mensaje: "Fecha del registro no encontrada" });

  if (!funcion.material) funcion.material = [];

  const nuevoItem = { id: Date.now(), nombre, listo: false };
  funcion.material.push(nuevoItem);

  const movimiento = {
    id: Date.now() + 1,
    tipo: "material",
    mensaje: `Material agregado: ${nombre}`,
    fecha: new Date().toISOString()
  };

  if (!funcion.timeline) funcion.timeline = [];
  if (!evento.timeline) evento.timeline = [];
  funcion.timeline.push(movimiento);
  evento.timeline.push({ ...movimiento, id: Date.now() + 2 });

  guardarDB(db);
  res.json({ mensaje: "Material agregado", item: nuevoItem, material: funcion.material });
});


app.patch("/api/eventos/:eventoId/funciones/:funcionId/material/:itemId/toggle", (req, res) => {
  const db = leerDB();
  const eventoId = Number(req.params.eventoId);
  const funcionId = Number(req.params.funcionId);
  const itemId = Number(req.params.itemId);

  const evento = db.eventos.find(item => item.id === eventoId);
  if (!evento) return res.status(404).json({ mensaje: "Registro no encontrado" });

  const funcion = evento.funciones.find(item => item.id === funcionId);
  if (!funcion) return res.status(404).json({ mensaje: "Fecha del registro no encontrada" });

  if (!funcion.material) funcion.material = [];

  const item = funcion.material.find(m => Number(m.id) === itemId);
  if (!item) return res.status(404).json({ mensaje: "Material no encontrado" });

  item.listo = !item.listo;

  const movimiento = {
    id: Date.now(),
    tipo: "material",
    mensaje: item.listo ? `Material listo: ${item.nombre}` : `Material pendiente: ${item.nombre}`,
    fecha: new Date().toISOString()
  };

  if (!funcion.timeline) funcion.timeline = [];
  if (!evento.timeline) evento.timeline = [];
  funcion.timeline.push(movimiento);
  evento.timeline.push({ ...movimiento, id: Date.now() + 1 });

  guardarDB(db);
  res.json({ mensaje: "Material actualizado", material: funcion.material });
});


app.put("/api/eventos/:eventoId/funciones/:funcionId/material/:itemId", (req, res) => {
  const db = leerDB();
  const eventoId = Number(req.params.eventoId);
  const funcionId = Number(req.params.funcionId);
  const itemId = Number(req.params.itemId);
  const nombre = String(req.body.nombre || "").trim();

  if (!nombre) return res.status(400).json({ mensaje: "Escribe el nuevo nombre del material" });

  const evento = db.eventos.find(item => item.id === eventoId);
  if (!evento) return res.status(404).json({ mensaje: "Registro no encontrado" });

  const funcion = evento.funciones.find(item => item.id === funcionId);
  if (!funcion) return res.status(404).json({ mensaje: "Fecha del registro no encontrada" });

  if (!funcion.material) funcion.material = [];

  const item = funcion.material.find(m => Number(m.id) === itemId);
  if (!item) return res.status(404).json({ mensaje: "Material no encontrado" });

  const anterior = item.nombre;
  item.nombre = nombre;

  const movimiento = {
    id: Date.now(),
    tipo: "material",
    mensaje: `Material editado: ${anterior} → ${nombre}`,
    fecha: new Date().toISOString()
  };

  if (!funcion.timeline) funcion.timeline = [];
  if (!evento.timeline) evento.timeline = [];
  funcion.timeline.push(movimiento);
  evento.timeline.push({ ...movimiento, id: Date.now() + 1 });

  guardarDB(db);
  res.json({ mensaje: "Material actualizado", material: funcion.material });
});


app.delete("/api/eventos/:eventoId/funciones/:funcionId/material/:itemId", (req, res) => {
  const db = leerDB();
  const eventoId = Number(req.params.eventoId);
  const funcionId = Number(req.params.funcionId);
  const itemId = Number(req.params.itemId);

  const evento = db.eventos.find(item => item.id === eventoId);
  if (!evento) return res.status(404).json({ mensaje: "Registro no encontrado" });

  const funcion = evento.funciones.find(item => item.id === funcionId);
  if (!funcion) return res.status(404).json({ mensaje: "Fecha del registro no encontrada" });

  if (!funcion.material) funcion.material = [];
  const index = funcion.material.findIndex(m => Number(m.id) === itemId);
  if (index === -1) return res.status(404).json({ mensaje: "Material no encontrado" });

  const eliminado = funcion.material.splice(index, 1)[0];

  const movimiento = {
    id: Date.now(),
    tipo: "material",
    mensaje: `Material eliminado: ${eliminado.nombre}`,
    fecha: new Date().toISOString()
  };

  if (!funcion.timeline) funcion.timeline = [];
  if (!evento.timeline) evento.timeline = [];
  funcion.timeline.push(movimiento);
  evento.timeline.push({ ...movimiento, id: Date.now() + 1 });

  guardarDB(db);
  res.json({ mensaje: "Material eliminado", material: funcion.material });
});


/* ============================================================
   ALPHA v1.11: DOCUMENTOS POR OPERACIÓN
   Item: { id, nombre, tipo, url, notas, creadoEn }
============================================================ */

function timelineDoc(evento, funcion, mensaje){
  const mov = { id: Date.now(), tipo: "documento", mensaje, fecha: new Date().toISOString() };
  if (!funcion.timeline) funcion.timeline = [];
  if (!evento.timeline) evento.timeline = [];
  funcion.timeline.push(mov);
  evento.timeline.push({ ...mov, id: Date.now() + 1 });
}

app.post("/api/eventos/:eventoId/funciones/:funcionId/documentos", (req, res) => {
  const db = leerDB();
  const evento = db.eventos.find(item => item.id === Number(req.params.eventoId));
  if (!evento) return res.status(404).json({ mensaje: "Registro no encontrado" });
  const funcion = evento.funciones.find(item => item.id === Number(req.params.funcionId));
  if (!funcion) return res.status(404).json({ mensaje: "Fecha del registro no encontrada" });

  const nombre = String(req.body.nombre || "").trim();
  if (!nombre) return res.status(400).json({ mensaje: "Escribe el nombre del documento" });

  if (!funcion.documentos) funcion.documentos = [];

  const nuevo = {
    id: Date.now(),
    nombre,
    tipo: String(req.body.tipo || "").trim(),
    url: String(req.body.url || "").trim(),
    notas: String(req.body.notas || "").trim(),
    creadoEn: new Date().toISOString()
  };
  funcion.documentos.push(nuevo);
  timelineDoc(evento, funcion, `Documento agregado: ${nombre}`);

  guardarDB(db);
  res.json({ mensaje: "Documento agregado", item: nuevo, documentos: funcion.documentos });
});

app.put("/api/eventos/:eventoId/funciones/:funcionId/documentos/:documentoId", (req, res) => {
  const db = leerDB();
  const evento = db.eventos.find(item => item.id === Number(req.params.eventoId));
  if (!evento) return res.status(404).json({ mensaje: "Registro no encontrado" });
  const funcion = evento.funciones.find(item => item.id === Number(req.params.funcionId));
  if (!funcion) return res.status(404).json({ mensaje: "Fecha del registro no encontrada" });

  if (!funcion.documentos) funcion.documentos = [];
  const doc = funcion.documentos.find(d => Number(d.id) === Number(req.params.documentoId));
  if (!doc) return res.status(404).json({ mensaje: "Documento no encontrado" });

  const nombre = String(req.body.nombre || "").trim();
  if (!nombre) return res.status(400).json({ mensaje: "Escribe el nombre del documento" });

  doc.nombre = nombre;
  doc.tipo = String(req.body.tipo || "").trim();
  doc.url = String(req.body.url || "").trim();
  doc.notas = String(req.body.notas || "").trim();
  timelineDoc(evento, funcion, `Documento editado: ${nombre}`);

  guardarDB(db);
  res.json({ mensaje: "Documento actualizado", documentos: funcion.documentos });
});

app.delete("/api/eventos/:eventoId/funciones/:funcionId/documentos/:documentoId", (req, res) => {
  const db = leerDB();
  const evento = db.eventos.find(item => item.id === Number(req.params.eventoId));
  if (!evento) return res.status(404).json({ mensaje: "Registro no encontrado" });
  const funcion = evento.funciones.find(item => item.id === Number(req.params.funcionId));
  if (!funcion) return res.status(404).json({ mensaje: "Fecha del registro no encontrada" });

  if (!funcion.documentos) funcion.documentos = [];
  const index = funcion.documentos.findIndex(d => Number(d.id) === Number(req.params.documentoId));
  if (index === -1) return res.status(404).json({ mensaje: "Documento no encontrado" });

  const eliminado = funcion.documentos.splice(index, 1)[0];
  timelineDoc(evento, funcion, `Documento eliminado: ${eliminado.nombre}`);

  guardarDB(db);
  res.json({ mensaje: "Documento eliminado", documentos: funcion.documentos });
});


/* ============================================================
   ALPHA v1.12: PERSONAS POR OPERACIÓN
   Item: { id, nombre, rol, telefono, correo, notas, creadoEn }
============================================================ */

function timelinePersona(evento, funcion, mensaje){
  const mov = { id: Date.now(), tipo: "persona", mensaje, fecha: new Date().toISOString() };
  if (!funcion.timeline) funcion.timeline = [];
  if (!evento.timeline) evento.timeline = [];
  funcion.timeline.push(mov);
  evento.timeline.push({ ...mov, id: Date.now() + 1 });
}

app.post("/api/eventos/:eventoId/funciones/:funcionId/personas", (req, res) => {
  const db = leerDB();
  const evento = db.eventos.find(item => item.id === Number(req.params.eventoId));
  if (!evento) return res.status(404).json({ mensaje: "Registro no encontrado" });
  const funcion = evento.funciones.find(item => item.id === Number(req.params.funcionId));
  if (!funcion) return res.status(404).json({ mensaje: "Fecha del registro no encontrada" });

  const nombre = String(req.body.nombre || "").trim();
  if (!nombre) return res.status(400).json({ mensaje: "Escribe el nombre de la persona" });

  if (!funcion.personas) funcion.personas = [];

  const nueva = {
    id: Date.now(),
    nombre,
    rol: String(req.body.rol || "").trim(),
    telefono: String(req.body.telefono || "").trim(),
    correo: String(req.body.correo || "").trim(),
    notas: String(req.body.notas || "").trim(),
    creadoEn: new Date().toISOString()
  };
  funcion.personas.push(nueva);
  timelinePersona(evento, funcion, `Persona agregada: ${nombre}`);

  guardarDB(db);
  res.json({ mensaje: "Persona agregada", item: nueva, personas: funcion.personas });
});

app.put("/api/eventos/:eventoId/funciones/:funcionId/personas/:personaId", (req, res) => {
  const db = leerDB();
  const evento = db.eventos.find(item => item.id === Number(req.params.eventoId));
  if (!evento) return res.status(404).json({ mensaje: "Registro no encontrado" });
  const funcion = evento.funciones.find(item => item.id === Number(req.params.funcionId));
  if (!funcion) return res.status(404).json({ mensaje: "Fecha del registro no encontrada" });

  if (!funcion.personas) funcion.personas = [];
  const persona = funcion.personas.find(p => Number(p.id) === Number(req.params.personaId));
  if (!persona) return res.status(404).json({ mensaje: "Persona no encontrada" });

  const nombre = String(req.body.nombre || "").trim();
  if (!nombre) return res.status(400).json({ mensaje: "Escribe el nombre de la persona" });

  persona.nombre = nombre;
  persona.rol = String(req.body.rol || "").trim();
  persona.telefono = String(req.body.telefono || "").trim();
  persona.correo = String(req.body.correo || "").trim();
  persona.notas = String(req.body.notas || "").trim();
  timelinePersona(evento, funcion, `Persona editada: ${nombre}`);

  guardarDB(db);
  res.json({ mensaje: "Persona actualizada", personas: funcion.personas });
});

app.delete("/api/eventos/:eventoId/funciones/:funcionId/personas/:personaId", (req, res) => {
  const db = leerDB();
  const evento = db.eventos.find(item => item.id === Number(req.params.eventoId));
  if (!evento) return res.status(404).json({ mensaje: "Registro no encontrado" });
  const funcion = evento.funciones.find(item => item.id === Number(req.params.funcionId));
  if (!funcion) return res.status(404).json({ mensaje: "Fecha del registro no encontrada" });

  if (!funcion.personas) funcion.personas = [];
  const index = funcion.personas.findIndex(p => Number(p.id) === Number(req.params.personaId));
  if (index === -1) return res.status(404).json({ mensaje: "Persona no encontrada" });

  const eliminada = funcion.personas.splice(index, 1)[0];
  timelinePersona(evento, funcion, `Persona eliminada: ${eliminada.nombre}`);

  guardarDB(db);
  res.json({ mensaje: "Persona eliminada", personas: funcion.personas });
});


/* ============================================================
   MÓDULO CAJA / POS (Parte 1): movimientos por función.
   Tipos: "venta" (boletos, con folios) | "compra" | "ingreso" | "egreso".
   Folios: contador monotónico por categoría (únicos aunque se borre).
============================================================ */

function generarTokenBoleto(){
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  ).toUpperCase();
}

/* ============================================================
   CONFIG DEL BOT (editable desde Kairen)
   - precios + plantillas de mensajes (con variables {x})
   - el bot lee esto desde /api/bot/config
============================================================ */

const BOT_CONFIG_DEFAULT = {
  precios: { normal: 450, preventa: 300 },
  funciones: [
    { nombre: "Domingo 14 de Junio", horario: "19:00 hrs", capacidad: 300, hoja: "Domingo14", activa: true },
    { nombre: "Viernes 26 de Junio", horario: "19:00 hrs", capacidad: 300, hoja: "Viernes26", activa: true },
    { nombre: "Domingo 28 de Junio", horario: "19:00 hrs", capacidad: 300, hoja: "Domingo28", activa: true }
  ],
  mensajes: {
    menu: "🎭 *LA DIVINA COMEDIA 2.0*\n\n¡Hola! Gracias por escribirnos. ¿Qué deseas hacer?\n\n*1* · Comprar boletos 🎟️\n*2* · Ver mi reservación 🔎\n*3* · Preguntas frecuentes ❓\n\nEl boleto general cuesta *{precio_normal} MXN*.\nResponde con el número de la opción.",
    confirmacion_venta: "Hola {nombre}! 🎫\nTu compra para *{evento}* el {fecha} está confirmada.\n{categoria} · {cantidad} boleto(s)\nFolios: {folios}\n¡Te esperamos!"
  }
};

function obtenerBotConfig(db){
  if(!db.botConfig){ db.botConfig = {}; }
  const c = db.botConfig;
  if(!c.precios){ c.precios = { ...BOT_CONFIG_DEFAULT.precios }; }
  if(c.precios.normal === undefined){ c.precios.normal = BOT_CONFIG_DEFAULT.precios.normal; }
  if(c.precios.preventa === undefined){ c.precios.preventa = BOT_CONFIG_DEFAULT.precios.preventa; }
  if(!c.mensajes){ c.mensajes = {}; }
  for(const k in BOT_CONFIG_DEFAULT.mensajes){
    if(c.mensajes[k] === undefined){ c.mensajes[k] = BOT_CONFIG_DEFAULT.mensajes[k]; }
  }
  if(!Array.isArray(c.funciones)){ c.funciones = BOT_CONFIG_DEFAULT.funciones.map(f => ({ ...f })); }
  if(c.logo === undefined){ c.logo = ""; }
  return c;
}

function aplicarPlantilla(tpl, vars){
  return String(tpl || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ""));
}

function construirMensajeVenta(evento, funcion, mov, db){
  const cfg = obtenerBotConfig(db);
  const cat = mov.categoria === "preferente" ? "Preferente"
            : mov.categoria === "vip" ? "VIP" : "General";

  const vars = {
    nombre: mov.comprador || "",
    evento: evento.nombre || "",
    fecha: `${funcion.fecha || ""} ${funcion.hora || ""}`.trim(),
    categoria: cat,
    cantidad: mov.cantidad || 0,
    folios: (mov.folios || []).join(", "),
    precio_normal: cfg.precios.normal,
    precio_preventa: cfg.precios.preventa
  };

  return aplicarPlantilla(cfg.mensajes.confirmacion_venta, vars);
}

app.get("/api/eventos/:eventoId/funciones/:funcionId/movimientos", (req, res) => {
  const db = leerDB();
  const evento = db.eventos.find(item => item.id === Number(req.params.eventoId));
  if (!evento) return res.status(404).json({ mensaje: "Registro no encontrado" });
  const funcion = evento.funciones.find(item => item.id === Number(req.params.funcionId));
  if (!funcion) return res.status(404).json({ mensaje: "Fecha del registro no encontrada" });

  res.json(funcion.movimientos || []);
});

app.post("/api/eventos/:eventoId/funciones/:funcionId/movimientos", (req, res) => {
  const db = leerDB();
  const evento = db.eventos.find(item => item.id === Number(req.params.eventoId));
  if (!evento) return res.status(404).json({ mensaje: "Registro no encontrado" });
  const funcion = evento.funciones.find(item => item.id === Number(req.params.funcionId));
  if (!funcion) return res.status(404).json({ mensaje: "Fecha del registro no encontrada" });

  if (!funcion.movimientos) funcion.movimientos = [];
  if (!funcion.foliosContador) funcion.foliosContador = {};

  const {
    tipo, concepto, monto, metodoPago,
    categoria, cantidad, comprador, precioUnitario, notas, telefono
  } = req.body;

  const movimiento = {
    id: Date.now(),
    tipo: tipo || "venta",
    metodoPago: metodoPago || "efectivo",
    concepto: String(concepto || "").trim(),
    notas: String(notas || "").trim(),
    fecha: new Date().toISOString()
  };

  if (movimiento.tipo === "venta") {
    const cant = Math.max(1, Number(cantidad) || 1);
    const precio = Number(precioUnitario) || 0;
    const cat = categoria || "general";
    const prefijo = cat === "preferente" ? "PREF" : cat === "vip" ? "VIP" : "GEN";

    const actual = Number(funcion.foliosContador[cat]) || 0;
    const folios = [];
    for (let i = 1; i <= cant; i++) {
      folios.push(`${prefijo}-${String(actual + i).padStart(3, "0")}`);
    }
    funcion.foliosContador[cat] = actual + cant;

    movimiento.categoria = cat;
    movimiento.cantidad = cant;
    movimiento.precioUnitario = precio;
    movimiento.comprador = String(comprador || "").trim();
    movimiento.telefono = String(telefono || "").trim();
    movimiento.folios = folios;
    movimiento.boletos = folios.map(f => ({ folio: f, token: generarTokenBoleto() }));
    movimiento.monto = precio * cant;
    if (!movimiento.concepto) {
      movimiento.concepto = `Venta ${cant} x ${cat}`;
    }
  } else {
    movimiento.monto = Number(monto) || 0;
  }

  funcion.movimientos.push(movimiento);

  // Outbox: si la venta trae teléfono, se encola el mensaje de confirmación.
  if(movimiento.tipo === "venta" && movimiento.telefono){
    if(!db.outbox){ db.outbox = []; }
    db.outbox.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      movId: movimiento.id,
      eventoNombre: evento.nombre,
      telefono: movimiento.telefono,
      comprador: movimiento.comprador || "",
      texto: construirMensajeVenta(evento, funcion, movimiento, db),
      estado: "pendiente",
      intentos: 0,
      creado: new Date().toISOString(),
      enviado: null
    });
  }

  guardarDB(db);
  res.json({ mensaje: "Movimiento registrado", movimiento });
});

app.delete("/api/eventos/:eventoId/funciones/:funcionId/movimientos/:movId", (req, res) => {
  const db = leerDB();
  const evento = db.eventos.find(item => item.id === Number(req.params.eventoId));
  if (!evento) return res.status(404).json({ mensaje: "Registro no encontrado" });
  const funcion = evento.funciones.find(item => item.id === Number(req.params.funcionId));
  if (!funcion) return res.status(404).json({ mensaje: "Fecha del registro no encontrada" });

  funcion.movimientos = (funcion.movimientos || []).filter(
    m => Number(m.id) !== Number(req.params.movId)
  );

  guardarDB(db);
  res.json({ mensaje: "Movimiento eliminado", movimientos: funcion.movimientos });
});


/* ============================================================
   OUTBOX / MENSAJERÍA: cola de mensajes de confirmación.
   Kairen encola; el bot (Baileys) los jala y envía con lapso.
   Protegido con token (env OUTBOX_TOKEN) para los endpoints del bot.
============================================================ */

const OUTBOX_TOKEN = process.env.OUTBOX_TOKEN || "";

function outboxTokenOk(req, res){
  if(OUTBOX_TOKEN && req.headers["x-outbox-token"] !== OUTBOX_TOKEN){
    res.status(401).json({ mensaje: "Token inválido" });
    return false;
  }
  return true;
}

// Bot: obtener pendientes
app.get("/api/outbox/pendientes", (req, res) => {
  if(!outboxTokenOk(req, res)){ return; }
  const db = leerDB();
  res.json((db.outbox || []).filter(m => m.estado === "pendiente"));
});

// Bot: marcar enviado/error
app.post("/api/outbox/:id/marcar", (req, res) => {
  if(!outboxTokenOk(req, res)){ return; }
  const db = leerDB();
  if(!db.outbox){ db.outbox = []; }
  const item = db.outbox.find(m => Number(m.id) === Number(req.params.id));
  if(!item){ return res.status(404).json({ mensaje: "Mensaje no encontrado" }); }

  item.estado = req.body.estado === "enviado" ? "enviado" : "error";
  item.intentos = (item.intentos || 0) + 1;
  if(item.estado === "enviado"){ item.enviado = new Date().toISOString(); }
  if(req.body.error){ item.error = String(req.body.error).slice(0, 300); }

  guardarDB(db);
  res.json({ mensaje: "Actualizado" });
});

// Panel: listar toda la mensajería
app.get("/api/outbox", (req, res) => {
  const db = leerDB();
  res.json(db.outbox || []);
});

// Panel: reencolar un mensaje
app.post("/api/outbox/:id/reenviar", (req, res) => {
  const db = leerDB();
  if(!db.outbox){ db.outbox = []; }
  const item = db.outbox.find(m => Number(m.id) === Number(req.params.id));
  if(!item){ return res.status(404).json({ mensaje: "Mensaje no encontrado" }); }
  item.estado = "pendiente";
  item.error = null;
  guardarDB(db);
  res.json({ mensaje: "Reencolado" });
});


/* ============================================================
   BOT: configuración (mensajes + precios) y estado de conexión.
   - El panel de Kairen edita /api/bot/config.
   - El bot lee /api/bot/config y reporta su estado en /api/bot/estado.
============================================================ */

// Leer config (bot + panel)
app.get("/api/bot/config", (req, res) => {
  const db = leerDB();
  const cfg = obtenerBotConfig(db);
  guardarDB(db); // persiste defaults la primera vez
  res.json(cfg);
});

// Guardar config (panel)
app.put("/api/bot/config", (req, res) => {
  const db = leerDB();
  const cfg = obtenerBotConfig(db);
  const { precios, mensajes } = req.body || {};

  if(precios && typeof precios === "object"){
    if(precios.normal !== undefined){ cfg.precios.normal = Number(precios.normal) || 0; }
    if(precios.preventa !== undefined){ cfg.precios.preventa = Number(precios.preventa) || 0; }
  }
  if(mensajes && typeof mensajes === "object"){
    for(const k in mensajes){ cfg.mensajes[k] = String(mensajes[k]); }
  }
  if(req.body.logo !== undefined){ cfg.logo = String(req.body.logo || ""); }
  if(Array.isArray(req.body.funciones)){
    cfg.funciones = req.body.funciones.map(f => ({
      nombre: String(f.nombre || "").trim(),
      horario: String(f.horario || "").trim(),
      capacidad: Number(f.capacidad) || 0,
      hoja: String(f.hoja || "").trim(),
      activa: f.activa !== false
    })).filter(f => f.nombre);
  }

  guardarDB(db);
  res.json({ mensaje: "Configuración guardada", config: cfg });
});

// Estado del bot (lo lee el panel)
app.get("/api/bot/estado", (req, res) => {
  const db = leerDB();
  const est = db.botEstado || { estado: "desconocido", qr: null, ts: null };

  // Heartbeat: si el bot lleva mucho sin reportar, se considera desconectado.
  const LIMITE_MS = 90 * 1000; // 90 segundos
  if(est.ts && est.estado === "conectado"){
    const desde = Date.now() - new Date(est.ts).getTime();
    if(desde > LIMITE_MS){
      return res.json({ ...est, estado: "desconectado", qr: null, stale: true });
    }
  }

  res.json(est);
});

// Estado del bot (lo reporta el bot) — protegido con token
app.post("/api/bot/estado", (req, res) => {
  if(!outboxTokenOk(req, res)){ return; }
  const db = leerDB();
  db.botEstado = {
    estado: String(req.body.estado || "desconocido"),
    qr: req.body.qr || null,
    ts: new Date().toISOString()
  };
  guardarDB(db);
  res.json({ mensaje: "ok" });
});

// Eventos activos para el BOT (2 niveles: evento -> funciones)
app.get("/api/bot/eventos", (req, res) => {
  const db = leerDB();
  const salida = (db.eventos || [])
    .filter(ev => ev.activo !== false && ev.enBot !== false)
    .map(ev => ({
      id: ev.id,
      nombre: ev.nombre,
      lugar: ev.lugar || "",
      funciones: (ev.funciones || [])
        .filter(fn => (fn.tipoRegistro || "funcion") === "funcion" && fn.activa !== false)
        .map(fn => ({
          id: fn.id,
          fecha: fn.fecha || "",
          hora: fn.hora || "",
          precio: fn.precio || (fn.categorias && fn.categorias.general && fn.categorias.general.precio) || 0,
          boletosDisponibles: (fn.boletosDisponibles != null ? fn.boletosDisponibles
            : (fn.categorias && fn.categorias.general && fn.categorias.general.boletos)) || 0
        }))
    }))
    .filter(ev => ev.funciones.length > 0);
  res.json(salida);
});

// Lista de eventos para el PANEL Bot (con switch de visibilidad)
app.get("/api/bot/eventos-config", (req, res) => {
  const db = leerDB();
  const out = (db.eventos || []).map(ev => ({
    id: ev.id,
    nombre: ev.nombre,
    lugar: ev.lugar || "",
    activo: ev.activo !== false,
    enBot: ev.enBot !== false,
    numFunciones: (ev.funciones || [])
      .filter(fn => (fn.tipoRegistro || "funcion") === "funcion" && fn.activa !== false).length
  }));
  res.json(out);
});

// Prender/apagar un evento en el bot
app.post("/api/bot/eventos/:id/visible", (req, res) => {
  const db = leerDB();
  const ev = (db.eventos || []).find(e => String(e.id) === String(req.params.id));
  if(!ev){ return res.status(404).json({ mensaje: "Evento no encontrado" }); }
  ev.enBot = req.body.visible !== false;
  guardarDB(db);
  res.json({ mensaje: "ok", enBot: ev.enBot });
});


/* ============================================================
   RESERVAS (migración: viven en Kairen, no en Google Sheets)
   El bot crea/consulta reservas aquí.
============================================================ */

const STATUS_OCUPAN_CUPO = [
  "pre-confirmada", "comprobante recibido", "pago confirmado", "cortesía", "confirmada"
];

function obtenerReservas(db){
  if(!Array.isArray(db.reservas)){ db.reservas = []; }
  return db.reservas;
}

function generarFolioReserva(db){
  const reservas = obtenerReservas(db);
  let ultimo = 0;
  reservas.forEach(r => {
    const n = parseInt(String(r.folio || "").replace("R", ""), 10);
    if(!isNaN(n) && n > ultimo){ ultimo = n; }
  });
  return `R${String(ultimo + 1).padStart(3, "0")}`;
}

function capacidadDeFuncion(db, nombre){
  const cfg = obtenerBotConfig(db);
  const f = (cfg.funciones || []).find(x =>
    String(x.nombre).toLowerCase() === String(nombre).toLowerCase()
  );
  return f && f.capacidad ? Number(f.capacidad) : 300;
}

function ocupadosDeFuncion(db, nombre){
  const reservas = obtenerReservas(db);
  let ocupados = 0;
  reservas.forEach(r => {
    const misma = String(r.funcion || "").toLowerCase() === String(nombre).toLowerCase();
    const ocupa = STATUS_OCUPAN_CUPO.includes(String(r.status || "").toLowerCase());
    const b = parseInt(r.boletos || 0, 10);
    if(misma && ocupa && !isNaN(b)){ ocupados += b; }
  });
  return ocupados;
}

// Crear reserva (la usa el bot)
app.post("/api/reservas", (req, res) => {
  const db = leerDB();
  const reservas = obtenerReservas(db);
  const { nombre, funcion, horario, boletos, total, clienteJid, telefono, codigoPromo, eventoId, funcionId, evento, fecha, hora } = req.body || {};

  if(!funcion || !boletos){
    return res.status(400).json({ mensaje: "Faltan datos (funcion, boletos)" });
  }

  const folio = generarFolioReserva(db);
  const reserva = {
    folio,
    nombre: String(nombre || "").trim(),
    evento: String(evento || "").trim(),
    eventoId: eventoId != null ? eventoId : null,
    funcionId: funcionId != null ? funcionId : null,
    funcion: String(funcion).trim(),
    fecha: String(fecha || "").trim(),
    hora: String(hora || "").trim(),
    horario: String(horario || "").trim(),
    boletos: Number(boletos) || 0,
    total: Number(total) || 0,
    status: "pre-confirmada",
    clienteJid: String(clienteJid || "").trim(),
    telefono: String(telefono || "").trim(),
    codigoPromo: codigoPromo || null,
    qr: "",
    checkIn: "",
    creado: new Date().toISOString()
  };

  reservas.push(reserva);
  guardarDB(db);
  res.json({ mensaje: "Reserva creada", folio, reserva });
});

// Listar todas (para el panel a futuro)
app.get("/api/reservas", (req, res) => {
  const db = leerDB();
  res.json(obtenerReservas(db));
});

// Reservas de un cliente
app.get("/api/reservas/cliente/:jid", (req, res) => {
  const db = leerDB();
  const jid = req.params.jid;
  res.json(obtenerReservas(db).filter(r => r.clienteJid === jid));
});

function funcionReal(db, eventoId, funcionId){
  const ev = (db.eventos || []).find(e => String(e.id) === String(eventoId));
  if(!ev){ return null; }
  const fn = (ev.funciones || []).find(f => String(f.id) === String(funcionId));
  return fn ? { ev, fn } : null;
}

function ocupadosReserva(db, eventoId, funcionId){
  return obtenerReservas(db)
    .filter(r =>
      String(r.eventoId) === String(eventoId) &&
      String(r.funcionId) === String(funcionId) &&
      STATUS_OCUPAN_CUPO.includes(String(r.status || "").toLowerCase()))
    .reduce((a, r) => a + (parseInt(r.boletos || 0, 10) || 0), 0);
}

// Cupo de una función
app.get("/api/reservas/cupo", (req, res) => {
  const db = leerDB();
  const { eventoId, funcionId, funcion } = req.query;

  if(eventoId && funcionId){
    const fr = funcionReal(db, eventoId, funcionId);
    const capacidad = fr ? (fr.fn.boletosDisponibles != null ? fr.fn.boletosDisponibles : 300) : 300;
    const ocupados = ocupadosReserva(db, eventoId, funcionId);
    return res.json({ capacidad, ocupados, disponibles: capacidad - ocupados });
  }

  const capacidad = capacidadDeFuncion(db, funcion || "");
  const ocupados = ocupadosDeFuncion(db, funcion || "");
  res.json({ capacidad, ocupados, disponibles: capacidad - ocupados });
});

// Actualizar status de una reserva (por folio)
app.post("/api/reservas/:folio/status", (req, res) => {
  const db = leerDB();
  const reservas = obtenerReservas(db);
  const r = reservas.find(x =>
    String(x.folio).toUpperCase() === String(req.params.folio).toUpperCase()
  );
  if(!r){ return res.status(404).json({ mensaje: "Reserva no encontrada" }); }
  r.status = String(req.body.status || r.status);
  guardarDB(db);
  res.json({ mensaje: "Status actualizado", reserva: r });
});

// Encola el boleto (con QR) para que el bot lo envíe por WhatsApp
function encolarBoleto(db, reserva){
  if(!reserva.telefono){ return; }
  if(!db.outbox){ db.outbox = []; }
  db.outbox.push({
    id: Date.now() + Math.floor(Math.random() * 1000),
    tipo: "boleto",
    telefono: reserva.telefono,
    comprador: reserva.nombre || "",
    folio: reserva.folio,
    boleto: {
      folio: reserva.folio,
      evento: reserva.evento || reserva.funcion || "",
      fecha: reserva.fecha || "",
      hora: reserva.hora || reserva.horario || "",
      nombre: reserva.nombre || "",
      boletos: Number(reserva.boletos) || 1
    },
    estado: "pendiente",
    intentos: 0,
    creado: new Date().toISOString(),
    enviado: null
  });
}

// Registra la reserva confirmada como VENTA en la caja de su función.
function registrarVentaDesdeReserva(db, reserva){
  if(reserva.ventaRegistrada){ return; }              // ya se registró, no duplicar
  if(reserva.eventoId == null || reserva.funcionId == null){ return; }

  const evento = (db.eventos || []).find(e => String(e.id) === String(reserva.eventoId));
  if(!evento){ return; }
  const funcion = (evento.funciones || []).find(f => String(f.id) === String(reserva.funcionId));
  if(!funcion){ return; }

  if(!funcion.movimientos){ funcion.movimientos = []; }
  if(!funcion.foliosContador){ funcion.foliosContador = {}; }

  const cant = Math.max(1, Number(reserva.boletos) || 1);
  const cat = "general";
  const prefijo = "GEN";
  const actual = Number(funcion.foliosContador[cat]) || 0;
  const folios = [];
  for(let i = 1; i <= cant; i++){
    folios.push(`${prefijo}-${String(actual + i).padStart(3, "0")}`);
  }
  funcion.foliosContador[cat] = actual + cant;

  const total = Number(reserva.total) || 0;
  const precioUnitario = cant > 0 ? Math.round(total / cant) : total;

  funcion.movimientos.push({
    id: Date.now(),
    tipo: "venta",
    metodoPago: reserva.metodoPago || "transferencia",
    categoria: cat,
    cantidad: cant,
    precioUnitario,
    comprador: reserva.nombre || "",
    telefono: reserva.telefono || "",
    folios,
    boletos: folios.map(f => ({ folio: f, token: generarTokenBoleto() })),
    monto: total,
    concepto: `WhatsApp ${reserva.folio}`,
    notas: `Reserva ${reserva.folio} (bot)`,
    origen: "bot",
    fecha: new Date().toISOString()
  });

  reserva.ventaRegistrada = true;
}

// Confirmar pago -> status Confirmada + encola el boleto con QR
app.post("/api/reservas/:folio/confirmar", (req, res) => {
  const db = leerDB();
  const reservas = obtenerReservas(db);
  const r = reservas.find(x =>
    String(x.folio).toUpperCase() === String(req.params.folio).toUpperCase()
  );
  if(!r){ return res.status(404).json({ mensaje: "Reserva no encontrada" }); }

  const yaConfirmada = String(r.status || "").toLowerCase().includes("confirm");

  r.status = "Confirmada";
  r.metodoPago = String(req.body.metodoPago || r.metodoPago || "transferencia");
  r.confirmado = new Date().toISOString();

  registrarVentaDesdeReserva(db, r);  // suma a Ventas (solo la 1a vez)
  encolarBoleto(db, r);               // (re)envía el boleto con QR
  guardarDB(db);

  res.json({ mensaje: yaConfirmada ? "Boleto reenviado" : "Reserva confirmada, boleto en camino", reserva: r });
});

// Cancelar reserva
app.post("/api/reservas/:folio/cancelar", (req, res) => {
  const db = leerDB();
  const reservas = obtenerReservas(db);
  const r = reservas.find(x =>
    String(x.folio).toUpperCase() === String(req.params.folio).toUpperCase()
  );
  if(!r){ return res.status(404).json({ mensaje: "Reserva no encontrada" }); }

  r.status = "Cancelada";
  r.cancelado = new Date().toISOString();

  if(r.telefono){
    if(!db.outbox){ db.outbox = []; }
    db.outbox.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      telefono: r.telefono,
      comprador: r.nombre || "",
      texto: `Hola ${r.nombre || ""} 👋\nTu reservación *${r.folio}* fue cancelada.\nSi crees que es un error, escríbenos.`,
      estado: "pendiente",
      intentos: 0,
      creado: new Date().toISOString(),
      enviado: null
    });
  }

  guardarDB(db);
  res.json({ mensaje: "Reserva cancelada", reserva: r });
});


/* ============================================================
   ALPHA v1.14: CATÁLOGO DE TIPOS DE REGISTRO (editable)

   Los tipos operativos viven en db.tiposRegistro. "funcion"
   NO vive aquí: es boletaje y se maneja aparte (protegido).
   Al eliminar un tipo, los registros que ya lo usan se
   conservan (el frontend cae a sus defaults para mostrarlos).
============================================================ */

const TIPOS_REGISTRO_DEFAULT = {
  activacion:    { icono: "📍", nombre: "Activación",      clase: "tipo-activacion",    descripcion: "Marca, plaza o evento promocional." },
  clase:         { icono: "🎓", nombre: "Clase",           clase: "tipo-clase",         descripcion: "Taller, curso, masterclass o capacitación." },
  ensayo:        { icono: "🎤", nombre: "Ensayo",          clase: "tipo-ensayo",        descripcion: "Preparación artística o técnica." },
  grabacion:     { icono: "🎬", nombre: "Grabación",       clase: "tipo-grabacion",     descripcion: "Video, streaming, contenido o sesión." },
  especial:      { icono: "🎪", nombre: "Evento especial", clase: "tipo-especial",      descripcion: "Actividad única o evento no recurrente." },
  traslado:      { icono: "🚚", nombre: "Traslado",        clase: "tipo-traslado",      descripcion: "Equipo, staff, utilería o logística." },
  mantenimiento: { icono: "🛠️", nombre: "Mantenimiento",   clase: "tipo-mantenimiento", descripcion: "Reparaciones o revisión técnica." }
};

function asegurarCatalogoTipos(db){
  if(!db.tiposRegistro || typeof db.tiposRegistro !== "object" || Array.isArray(db.tiposRegistro)){
    db.tiposRegistro = { ...TIPOS_REGISTRO_DEFAULT };
    return true;
  }
  return false;
}

function slugTipo(nombre){
  return String(nombre || "")
    .toLowerCase()
    .trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

app.get("/api/tipos-registro", (req, res) => {
  const db = leerDB();
  if(asegurarCatalogoTipos(db)){ guardarDB(db); }
  res.json({ tipos: db.tiposRegistro });
});

app.post("/api/tipos-registro", (req, res) => {
  const db = leerDB();
  asegurarCatalogoTipos(db);

  const nombre = String(req.body.nombre || "").trim();
  if(!nombre){ return res.status(400).json({ mensaje: "Escribe el nombre del tipo" }); }

  const slug = slugTipo(nombre);
  if(!slug){ return res.status(400).json({ mensaje: "Nombre inválido" }); }
  if(slug === "funcion"){ return res.status(400).json({ mensaje: "Ese tipo está reservado" }); }
  if(db.tiposRegistro[slug]){ return res.status(400).json({ mensaje: "Ya existe un tipo con ese nombre" }); }

  db.tiposRegistro[slug] = {
    icono: (String(req.body.icono || "").trim() || "📌"),
    nombre,
    clase: "tipo-" + slug,
    descripcion: String(req.body.descripcion || "").trim(),
    custom: true
  };

  guardarDB(db);
  res.json({ mensaje: "Tipo agregado", tipos: db.tiposRegistro });
});

app.delete("/api/tipos-registro/:slug", (req, res) => {
  const db = leerDB();
  asegurarCatalogoTipos(db);

  const slug = String(req.params.slug || "");
  if(slug === "funcion"){ return res.status(400).json({ mensaje: "No se puede eliminar Función" }); }
  if(!db.tiposRegistro[slug]){ return res.status(404).json({ mensaje: "Tipo no encontrado" }); }

  delete db.tiposRegistro[slug];

  guardarDB(db);
  res.json({ mensaje: "Tipo eliminado", tipos: db.tiposRegistro });
});


/* ============================================================
   ALPHA v1.16: SUBIDA DE ARCHIVOS LOCALES

   El cliente manda { dataUrl, nombre }. Guardamos el archivo en
   disco (database/uploads) y devolvemos una URL /uploads/...
   Así db.json queda ligero (solo guarda la ruta, no el base64).
============================================================ */

const MIME_EXT = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf"
};

app.post("/api/upload", (req, res) => {
  try{
    const dataUrl = String(req.body.dataUrl || "");
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

    if(!match){
      return res.status(400).json({ mensaje: "Archivo inválido" });
    }

    const mime = match[1];
    const buffer = Buffer.from(match[2], "base64");

    if(buffer.length > 15 * 1024 * 1024){
      return res.status(413).json({ mensaje: "El archivo es muy grande (máx 15 MB)" });
    }

    const ext = MIME_EXT[mime] || (String(mime.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "") || "bin");
    const nombreArchivo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    fs.writeFileSync(path.join(uploadsDir, nombreArchivo), buffer);

    res.json({
      mensaje: "Archivo subido",
      url: `/uploads/${nombreArchivo}`,
      mime,
      nombre: String(req.body.nombre || "")
    });
  }catch(error){
    res.status(500).json({ mensaje: "No se pudo subir el archivo" });
  }
});

/* ============================================================
   ALPHA v1.5: ESTADO DE OPERACIÓN

   El usuario fija el estado manualmente. El estado "en curso"
   por fecha se calcula en el frontend al mostrar; aquí solo
   guardamos el valor elegido y registramos el timeline.
============================================================ */

app.patch("/api/eventos/:eventoId/funciones/:funcionId/estado", (req, res) => {

  const db = leerDB();

  const eventoId = Number(req.params.eventoId);
  const funcionId = Number(req.params.funcionId);
  const { estado } = req.body;

  const ESTADOS_VALIDOS = ["pendiente", "confirmado", "en_curso", "finalizado", "cancelado"];

  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({
      mensaje: "Estado no válido"
    });
  }

  const evento = db.eventos.find(item => item.id === eventoId);

  if (!evento) {
    return res.status(404).json({
      mensaje: "Registro no encontrado"
    });
  }

  const funcion = evento.funciones.find(item => item.id === funcionId);

  if (!funcion) {
    return res.status(404).json({
      mensaje: "Fecha del registro no encontrada"
    });
  }

  const NOMBRES = {
    pendiente: "Pendiente",
    confirmado: "Confirmado",
    en_curso: "En curso",
    finalizado: "Finalizado",
    cancelado: "Cancelado"
  };

  const estadoAnterior =
    funcion.estado || "pendiente";

  funcion.estado = estado;

  const entrada = {
    id: Date.now(),
    tipo: "estado",
    mensaje: `Estado cambiado: ${NOMBRES[estadoAnterior]} → ${NOMBRES[estado]}`,
    fecha: new Date().toISOString()
  };

  if (!funcion.timeline) {
    funcion.timeline = [];
  }

  funcion.timeline.push(entrada);

  if (!evento.timeline) {
    evento.timeline = [];
  }

  evento.timeline.push({
    ...entrada,
    id: Date.now() + 1
  });

  guardarDB(db);

  res.json({
    mensaje: "Estado actualizado",
    estado
  });
});


app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});