const BASE_URL = "https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes";

let currentData = [];
let currentMode = ""; // "ccaa", "maritimos", "historico"
let selectedProductLabel = "";

// Inicialización al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    loadCatalogs();

    document.getElementById("btn-buscar-ccaa").addEventListener("click", fetchByCCAA);
    document.getElementById("btn-buscar-mar").addEventListener("click", fetchMaritimosByProvincia);
    document.getElementById("btn-buscar-hist").addEventListener("click", fetchHistorico);
    document.getElementById("local-search").addEventListener("input", filterTableLocally);
});

// Gestión de pestañas
function setupTabs() {
    const buttons = document.querySelectorAll(".tab-btn");
    const contents = document.querySelectorAll(".tab-content");

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            buttons.forEach(b => b.classList.remove("active"));
            contents.forEach(c => c.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(btn.dataset.tab).classList.add("active");
            hideResults();
        });
    });
}

// Carga dinámica de listados maestros desde la API del Ministerio
async function loadCatalogs() {
    try {
        const [resCCAA, resProv, resProd] = await Promise.all([
            fetch(`${BASE_URL}/Listados/ComunidadesAutonomas/`),
            fetch(`${BASE_URL}/Listados/Provincias/`),
            fetch(`${BASE_URL}/Listados/ProductosPetroliferos/`)
        ]);

        const ccaas = await resCCAA.json();
        const provincias = await resProv.json();
        const productos = await resProd.json();

        populateSelect("select-ccaa", ccaas, "IDCCAA", "CCAA");
        populateSelect("select-prov-mar", provincias, "IDPovincia", "Provincia");
        populateSelect("select-prov-hist", provincias, "IDPovincia", "Provincia");
        populateSelect("select-producto", productos, "IDProducto", "NombreProducto");
    } catch (error) {
        showStatus("Error al cargar los listados maestros de la API del Ministerio.", true);
    }
}

function populateSelect(elementId, items, valueKey, textKey) {
    const select = document.getElementById(elementId);
    select.innerHTML = `<option value="">-- Seleccione una opción --</option>`;
    items.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item[valueKey];
        opt.textContent = item[textKey];
        select.appendChild(opt);
    });
}

// 1. Consulta: Estaciones de servicio por Comunidad Autónoma
async function fetchByCCAA() {
    const idCCAA = document.getElementById("select-ccaa").value;
    if (!idCCAA) return showStatus("Seleccione una Comunidad Autónoma.", true);

    showStatus("Consultando estaciones de servicio en la API REST...");
    try {
        const response = await fetch(`${BASE_URL}/EstacionesTerrestres/FiltroCCAA/${idCCAA}`);
        const json = await response.json();
        currentData = json.ListaEESSPrecio || [];
        currentMode = "ccaa";
        renderTable(currentData);
        showStatus(`Datos actualizados (${json.Fecha}). Se encontraron ${currentData.length} estaciones.`);
    } catch (error) {
        showStatus("Error de conexión con el servicio REST de Estaciones Terrestres.", true);
    }
}

// 2. Consulta: Postes marítimos por Provincia
async function fetchMaritimosByProvincia() {
    const idProv = document.getElementById("select-prov-mar").value;
    if (!idProv) return showStatus("Seleccione una provincia.", true);

    showStatus("Consultando postes marítimos en la API REST...");
    try {
        const response = await fetch(`${BASE_URL}/PostesMaritimos/FiltroProvincia/${idProv}`);
        const json = await response.json();
        currentData = json.ListaEESSPrecio || [];
        currentMode = "maritimos";
        renderTable(currentData);
        showStatus(`Datos actualizados (${json.Fecha}). Se encontraron ${currentData.length} postes marítimos.`);
    } catch (error) {
        showStatus("Error de conexión con el servicio REST de Postes Marítimos.", true);
    }
}

// 3. Consulta: Precios por Provincia, Fecha y Carburante
async function fetchHistorico() {
    const idProv = document.getElementById("select-prov-hist").value;
    const rawDate = document.getElementById("input-fecha").value; // YYYY-MM-DD
    const prodSelect = document.getElementById("select-producto");
    const idProd = prodSelect.value;

    if (!idProv || !rawDate || !idProd) {
        return showStatus("Complete provincia, fecha y tipo de carburante.", true);
    }

    // Convertir fecha YYYY-MM-DD a DD-MM-YYYY que exige la API
    const [year, month, day] = rawDate.split("-");
    const formattedDate = `${day}-${month}-${year}`;
    selectedProductLabel = prodSelect.options[prodSelect.selectedIndex].text;

    showStatus(`Consultando precios históricos para el ${formattedDate}...`);
    try {
        const url = `${BASE_URL}/EstacionesTerrestresHist/FiltroProvinciaProducto/${formattedDate}/${idProv}/${idProd}`;
        const response = await fetch(url);
        const json = await response.json();
        currentData = json.ListaEESSPrecio || [];
        currentMode = "historico";
        renderTable(currentData);
        showStatus(`Histórico del ${formattedDate} cargado. ${currentData.length} estaciones con ${selectedProductLabel}.`);
    } catch (error) {
        showStatus("Error al consultar el histórico. Verifique que la fecha no sea futura o no disponible.", true);
    }
}

// Renderizado dinámico de la tabla según el tipo de consulta
function renderTable(data) {
    const table = document.getElementById("results-table");
    const thead = document.getElementById("table-head");
    const tbody = document.getElementById("table-body");
    const filterBox = document.getElementById("filter-box");

    tbody.innerHTML = "";
    document.getElementById("result-count").textContent = `Mostrando ${data.length} registros`;

    if (data.length === 0) {
        table.classList.add("hidden");
        filterBox.classList.add("hidden");
        return;
    }

    filterBox.classList.remove("hidden");
    table.classList.remove("hidden");

    if (currentMode === "ccaa") {
        thead.innerHTML = `<tr>
            <th>Rótulo</th><th>Municipio</th><th>Dirección</th><th>Horario</th>
            <th>Gasolina 95 E5</th><th>Gasóleo A</th>
        </tr>`;
        data.forEach(item => {
            tbody.innerHTML += `<tr>
                <td><strong>${item["Rótulo"] || "-"}</strong></td>
                <td>${item["Municipio"] || "-"}</td>
                <td>${item["Dirección"] || "-"}</td>
                <td>${item["Horario"] || "-"}</td>
                <td>${item["Precio Gasolina 95 E5"] ? item["Precio Gasolina 95 E5"] + " €" : "-"}</td>
                <td>${item["Precio Gasoleo A"] ? item["Precio Gasoleo A"] + " €" : "-"}</td>
            </tr>`;
        });
    } else if (currentMode === "maritimos") {
        thead.innerHTML = `<tr>
            <th>Rótulo / Puerto</th><th>Municipio</th><th>Dirección</th>
            <th>Gasolina 95 E5</th><th>Gasóleo A Habitual</th><th>Gasóleo B</th>
        </tr>`;
        data.forEach(item => {
            tbody.innerHTML += `<tr>
                <td><strong>${item["Rótulo"] || "-"}</strong></td>
                <td>${item["Municipio"] || "-"}</td>
                <td>${item["Dirección"] || "-"}</td>
                <td>${item["Precio Gasolina 95 E5"] ? item["Precio Gasolina 95 E5"] + " €" : "-"}</td>
                <td>${item["Precio Gasoleo A"] ? item["Precio Gasoleo A"] + " €" : "-"}</td>
                <td>${item["Precio Gasoleo B"] ? item["Precio Gasoleo B"] + " €" : "-"}</td>
            </tr>`;
        });
    } else if (currentMode === "historico") {
        thead.innerHTML = `<tr>
            <th>Rótulo</th><th>Municipio</th><th>Dirección</th>
            <th>Carburante</th><th>Precio (€/L)</th>
        </tr>`;
        data.forEach(item => {
            tbody.innerHTML += `<tr>
                <td><strong>${item["Rótulo"] || "-"}</strong></td>
                <td>${item["Municipio"] || "-"}</td>
                <td>${item["Dirección"] || "-"}</td>
                <td>${selectedProductLabel}</td>
                <td><strong>${item["PrecioProducto"] ? item["PrecioProducto"] + " €" : "-"}</strong></td>
            </tr>`;
        });
    }
}

// Filtrado instantáneo en cliente
function filterTableLocally(e) {
    const query = e.target.value.toLowerCase();
    const filtered = currentData.filter(item =>
        (item["Municipio"] && item["Municipio"].toLowerCase().includes(query)) ||
        (item["Rótulo"] && item["Rótulo"].toLowerCase().includes(query)) ||
        (item["Dirección"] && item["Dirección"].toLowerCase().includes(query))
    );
    renderTable(filtered);
}

function showStatus(msg, isError = false) {
    const bar = document.getElementById("status-bar");
    bar.textContent = msg;
    bar.className = isError ? "status-bar error" : "status-bar";
    bar.classList.remove("hidden");
}

function hideResults() {
    document.getElementById("status-bar").classList.add("hidden");
    document.getElementById("filter-box").classList.add("hidden");
    document.getElementById("results-table").classList.add("hidden");
}