const API_BASE = "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes";

let datasetActual = [];
let datasetMostrado = [];
let vistaActiva = "ccaa"; // "ccaa" | "maritimos" | "historico"
let modoVisual = "cards"; // "cards" | "table"
let etiquetaCarburante = "";
let fechaApi = "";

const TITULOS_VISTAS = {
    "view-ccaa": {
        titulo: "Estaciones de Servicio por Comunidad Autónoma",
        subtitulo: "Consulta en tiempo real de precios terrestres en territorio nacional"
    },
    "view-maritimos": {
        titulo: "Postes Marítimos por Provincia",
        subtitulo: "Puntos de suministro de carburante en puertos y litoral"
    },
    "view-historico": {
        titulo: "Histórico de Precios por Provincia y Día",
        subtitulo: "Evolución diaria de tarifas por tipo de combustible"
    }
};

document.addEventListener("DOMContentLoaded", () => {
    iniciarNavegacion();
    cargarListadosMaestros();

    document.getElementById("btn-buscar-ccaa").addEventListener("click", consultarPorCCAA);
    document.getElementById("btn-buscar-mar").addEventListener("click", consultarMaritimos);
    document.getElementById("btn-buscar-hist").addEventListener("click", consultarHistorico);
    
    // Eventos de filtrado y ordenación combinados
    document.getElementById("quick-filter").addEventListener("input", aplicarFiltrosYOrden);
    document.getElementById("sort-select").addEventListener("change", aplicarFiltrosYOrden);
    
    document.getElementById("btn-export-csv").addEventListener("click", exportarCSV);
    document.getElementById("mode-cards").addEventListener("click", () => cambiarModoVisual("cards"));
    document.getElementById("mode-table").addEventListener("click", () => cambiarModoVisual("table"));
});

function iniciarNavegacion() {
    const botones = document.querySelectorAll(".nav-item");
    const grupos = document.querySelectorAll(".filter-group");

    botones.forEach(btn => {
        btn.addEventListener("click", () => {
            botones.forEach(b => b.classList.remove("active"));
            grupos.forEach(g => g.classList.remove("active"));

            btn.classList.add("active");
            const targetId = btn.dataset.view;
            document.getElementById(targetId).classList.add("active");

            document.getElementById("view-title").textContent = TITULOS_VISTAS[targetId].titulo;
            document.getElementById("view-subtitle").textContent = TITULOS_VISTAS[targetId].subtitulo;

            limpiarPantalla();
        });
    });
}

async function cargarListadosMaestros() {
    try {
        const [rCCAA, rProv, rProd] = await Promise.all([
            fetch(`${API_BASE}/Listados/ComunidadesAutonomas/`),
            fetch(`${API_BASE}/Listados/Provincias/`),
            fetch(`${API_BASE}/Listados/ProductosPetroliferos/`)
        ]);

        rellenarSelect("select-ccaa", await rCCAA.json(), "IDCCAA", "CCAA");
        const provincias = await rProv.json();
        rellenarSelect("select-prov-mar", provincias, "IDPovincia", "Provincia");
        rellenarSelect("select-prov-hist", provincias, "IDPovincia", "Provincia");
        rellenarSelect("select-producto", await rProd.json(), "IDProducto", "NombreProducto");
    } catch (e) {
        mostrarAlerta("No se pudieron cargar los catálogos iniciales de la API del Ministerio.", true);
    }
}

function rellenarSelect(id, lista, claveValor, claveTexto) {
    const sel = document.getElementById(id);
    sel.innerHTML = `<option value="">-- Seleccionar --</option>`;
    lista.forEach(el => {
        const opt = document.createElement("option");
        opt.value = el[claveValor];
        opt.textContent = el[claveTexto];
        sel.appendChild(opt);
    });
}

// 1. Estaciones por Comunidad Autónoma
async function consultarPorCCAA() {
    const id = document.getElementById("select-ccaa").value;
    if (!id) return mostrarAlerta("Por favor, selecciona una Comunidad Autónoma.", true);

    mostrarAlerta("Conectando con el servicio REST de estaciones terrestres...");
    try {
        const res = await fetch(`${API_BASE}/EstacionesTerrestres/FiltroCCAA/${id}`);
        const data = await res.json();
        datasetActual = data.ListaEESSPrecio || [];
        fechaApi = data.Fecha || "Hoy";
        vistaActiva = "ccaa";
        reiniciarControlesYMostrar();
    } catch (e) {
        mostrarAlerta("Error al obtener datos de estaciones terrestres.", true);
    }
}

// 2. Postes marítimos por provincia
async function consultarMaritimos() {
    const id = document.getElementById("select-prov-mar").value;
    if (!id) return mostrarAlerta("Por favor, selecciona una provincia.", true);

    mostrarAlerta("Consultando postes marítimos en la API...");
    try {
        const res = await fetch(`${API_BASE}/PostesMaritimos/FiltroProvincia/${id}`);
        const data = await res.json();
        datasetActual = data.ListaEESSPrecio || [];
        fechaApi = data.Fecha || "Hoy";
        vistaActiva = "maritimos";
        reiniciarControlesYMostrar();
    } catch (e) {
        mostrarAlerta("Error al consultar postes marítimos.", true);
    }
}

// 3. Precios por provincia, fecha y carburante
async function consultarHistorico() {
    const idProv = document.getElementById("select-prov-hist").value;
    const fechaRaw = document.getElementById("input-fecha").value;
    const selProd = document.getElementById("select-producto");
    const idProd = selProd.value;

    if (!idProv || !fechaRaw || !idProd) {
        return mostrarAlerta("Debes seleccionar provincia, fecha y carburante.", true);
    }

    const [y, m, d] = fechaRaw.split("-");
    const fechaFormateada = `${d}-${m}-${y}`;
    etiquetaCarburante = selProd.options[selProd.selectedIndex].text;

    mostrarAlerta(`Consultando histórico para el ${fechaFormateada}...`);
    try {
        const url = `${API_BASE}/EstacionesTerrestresHist/FiltroProvinciaProducto/${fechaFormateada}/${idProv}/${idProd}`;
        const res = await fetch(url);
        const data = await res.json();
        datasetActual = data.ListaEESSPrecio || [];
        fechaApi = fechaFormateada;
        vistaActiva = "historico";
        reiniciarControlesYMostrar();
    } catch (e) {
        mostrarAlerta("No hay datos disponibles para esa fecha o provincia.", true);
    }
}

function reiniciarControlesYMostrar() {
    document.getElementById("quick-filter").value = "";
    document.getElementById("sort-select").value = "default";
    procesarYMostrar(datasetActual);
}

function procesarYMostrar(lista) {
    document.getElementById("alert-box").classList.add("hidden");

    if (datasetActual.length === 0) {
        limpiarPantalla();
        return mostrarAlerta("No se encontraron registros para los filtros seleccionados.", true);
    }

    datasetMostrado = lista;
    actualizarKPIs(lista);
    document.getElementById("kpi-section").classList.remove("hidden");
    document.getElementById("toolbar").classList.remove("hidden");
    document.getElementById("btn-export-csv").classList.remove("hidden");

    renderizarTarjetas(lista);
    renderizarTabla(lista);
    aplicarVisibilidadModo();
}

// Extrae el valor numérico del precio principal según el modo activo
function obtenerPrecioNumerico(item) {
    const clave = vistaActiva === "historico" ? "PrecioProducto" : "Precio Gasolina 95 E5";
    const raw = item[clave] || item["Precio Gasoleo A"] || "";
    const valor = parseFloat(raw.replace(",", "."));
    return isNaN(valor) ? null : valor;
}

// Combina filtro de texto y ordenación seleccionada
function aplicarFiltrosYOrden() {
    const query = document.getElementById("quick-filter").value.toLowerCase().trim();
    const criterioOrden = document.getElementById("sort-select").value;

    // 1. Filtrado
    let resultado = datasetActual.filter(item =>
        (item["Municipio"] && item["Municipio"].toLowerCase().includes(query)) ||
        (item["Rótulo"] && item["Rótulo"].toLowerCase().includes(query)) ||
        (item["Dirección"] && item["Dirección"].toLowerCase().includes(query))
    );

    // 2. Ordenación (se trabaja sobre copia para no alterar el orden original)
    resultado = [...resultado];

    if (criterioOrden === "price-asc") {
        resultado.sort((a, b) => {
            const pA = obtenerPrecioNumerico(a);
            const pB = obtenerPrecioNumerico(b);
            if (pA === null) return 1;  // Enviar estaciones sin precio al final
            if (pB === null) return -1;
            return pA - pB;
        });
    } else if (criterioOrden === "price-desc") {
        resultado.sort((a, b) => {
            const pA = obtenerPrecioNumerico(a);
            const pB = obtenerPrecioNumerico(b);
            if (pA === null) return 1;
            if (pB === null) return -1;
            return pB - pA;
        });
    } else if (criterioOrden === "muni-asc") {
        resultado.sort((a, b) => (a["Municipio"] || "").localeCompare(b["Municipio"] || "", "es"));
    } else if (criterioOrden === "brand-asc") {
        resultado.sort((a, b) => (a["Rótulo"] || "").localeCompare(b["Rótulo"] || "", "es"));
    }

    procesarYMostrar(resultado);
}

function actualizarKPIs(lista) {
    document.getElementById("kpi-total").textContent = lista.length;
    document.getElementById("kpi-date").textContent = fechaApi;

    const clavePrecio = vistaActiva === "historico" ? "PrecioProducto" : "Precio Gasolina 95 E5";
    const precios = lista
        .map(item => parseFloat((item[clavePrecio] || "").replace(",", ".")))
        .filter(num => !isNaN(num) && num > 0);

    if (precios.length > 0) {
        const min = Math.min(...precios).toFixed(3);
        const avg = (precios.reduce((a, b) => a + b, 0) / precios.length).toFixed(3);
        document.getElementById("kpi-min").textContent = `${min} €/L`;
        document.getElementById("kpi-avg").textContent = `${avg} €/L`;
    } else {
        document.getElementById("kpi-min").textContent = "N/D";
        document.getElementById("kpi-avg").textContent = "N/D";
    }
}

function renderizarTarjetas(lista) {
    const cont = document.getElementById("cards-container");
    cont.innerHTML = "";

    lista.slice(0, 150).forEach(item => {
        let preciosHTML = "";
        if (vistaActiva === "historico") {
            preciosHTML = `<div class="pill">${etiquetaCarburante}: <strong>${item["PrecioProducto"] || "-"} €</strong></div>`;
        } else if (vistaActiva === "maritimos") {
            preciosHTML = `
                <div class="pill">G95 E5: <strong>${item["Precio Gasolina 95 E5"] || "-"} €</strong></div>
                <div class="pill">Gasóleo A: <strong>${item["Precio Gasoleo A"] || "-"} €</strong></div>
                <div class="pill">Gasóleo B: <strong>${item["Precio Gasoleo B"] || "-"} €</strong></div>
            `;
        } else {
            preciosHTML = `
                <div class="pill">Gasolina 95: <strong>${item["Precio Gasolina 95 E5"] || "-"} €</strong></div>
                <div class="pill">Gasóleo A: <strong>${item["Precio Gasoleo A"] || "-"} €</strong></div>
            `;
        }

        cont.innerHTML += `
            <article class="station-card">
                <div>
                    <div class="station-header">
                        <span class="station-brand">${item["Rótulo"] || "Sin Rótulo"}</span>
                        <span class="badge-muni">${item["Municipio"] || ""}</span>
                    </div>
                    <p class="station-address">${item["Dirección"] || ""} ${item["Horario"] ? "• " + item["Horario"] : ""}</p>
                </div>
                <div class="price-pills">${preciosHTML}</div>
            </article>
        `;
    });
}

function renderizarTabla(lista) {
    const thead = document.getElementById("table-head");
    const tbody = document.getElementById("table-body");
    tbody.innerHTML = "";

    if (vistaActiva === "historico") {
        thead.innerHTML = `<tr><th>Rótulo</th><th>Municipio</th><th>Dirección</th><th>Carburante</th><th>Precio</th></tr>`;
        lista.forEach(i => {
            tbody.innerHTML += `<tr>
                <td><strong>${i["Rótulo"] || "-"}</strong></td>
                <td>${i["Municipio"] || "-"}</td>
                <td>${i["Dirección"] || "-"}</td>
                <td>${etiquetaCarburante}</td>
                <td><strong>${i["PrecioProducto"] ? i["PrecioProducto"] + " €" : "-"}</strong></td>
            </tr>`;
        });
    } else if (vistaActiva === "maritimos") {
        thead.innerHTML = `<tr><th>Puerto / Rótulo</th><th>Municipio</th><th>Dirección</th><th>G95 E5</th><th>Gasóleo A</th><th>Gasóleo B</th></tr>`;
        lista.forEach(i => {
            tbody.innerHTML += `<tr>
                <td><strong>${i["Rótulo"] || "-"}</strong></td>
                <td>${i["Municipio"] || "-"}</td>
                <td>${i["Dirección"] || "-"}</td>
                <td>${i["Precio Gasolina 95 E5"] || "-"} €</td>
                <td>${i["Precio Gasoleo A"] || "-"} €</td>
                <td>${i["Precio Gasoleo B"] || "-"} €</td>
            </tr>`;
        });
    } else {
        thead.innerHTML = `<tr><th>Rótulo</th><th>Municipio</th><th>Dirección</th><th>Horario</th><th>G95 E5</th><th>Gasóleo A</th></tr>`;
        lista.forEach(i => {
            tbody.innerHTML += `<tr>
                <td><strong>${i["Rótulo"] || "-"}</strong></td>
                <td>${i["Municipio"] || "-"}</td>
                <td>${i["Dirección"] || "-"}</td>
                <td>${i["Horario"] || "-"}</td>
                <td>${i["Precio Gasolina 95 E5"] || "-"} €</td>
                <td>${i["Precio Gasoleo A"] || "-"} €</td>
            </tr>`;
        });
    }
}

function cambiarModoVisual(modo) {
    modoVisual = modo;
    document.getElementById("mode-cards").classList.toggle("active", modo === "cards");
    document.getElementById("mode-table").classList.toggle("active", modo === "table");
    aplicarVisibilidadModo();
}

function aplicarVisibilidadModo() {
    document.getElementById("cards-container").classList.toggle("hidden", modoVisual !== "cards");
    document.getElementById("table-container").classList.toggle("hidden", modoVisual !== "table");
}

function exportarCSV() {
    if (!datasetMostrado.length) return;
    const filas = [["Rotulo", "Municipio", "Direccion", "Gasolina_95", "Gasoleo_A", "Precio_Producto"]];
    datasetMostrado.forEach(i => {
        filas.push([
            `"${(i["Rótulo"] || "").replace(/"/g, '""')}"`,
            `"${(i["Municipio"] || "").replace(/"/g, '""')}"`,
            `"${(i["Dirección"] || "").replace(/"/g, '""')}"`,
            `"${i["Precio Gasolina 95 E5"] || ""}"`,
            `"${i["Precio Gasoleo A"] || ""}"`,
            `"${i["PrecioProducto"] || ""}"`
        ]);
    });
    const csvContent = "data:text/csv;charset=utf-8," + filas.map(e => e.join(";")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `carburantes_${vistaActiva}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function mostrarAlerta(texto, esError = false) {
    const box = document.getElementById("alert-box");
    box.textContent = texto;
    box.className = esError ? "alert-box error" : "alert-box";
    box.classList.remove("hidden");
}

function limpiarPantalla() {
    document.getElementById("alert-box").classList.add("hidden");
    document.getElementById("kpi-section").classList.add("hidden");
    document.getElementById("toolbar").classList.add("hidden");
    document.getElementById("btn-export-csv").classList.add("hidden");
    document.getElementById("cards-container").classList.add("hidden");
    document.getElementById("table-container").classList.add("hidden");
}