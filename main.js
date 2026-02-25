// ================================================================
//  Bangladesh Land Zoning Dashboard
//  Features: Live Google Sheets | Search+Zoom | Stats Legend
//            Division Filter Table | District Boundaries
//            Mobile Bottom Sheet | Auto-Refresh
// ================================================================

// ── CONFIG ───────────────────────────────────────────────────────
const SHEET_ID  = "1xRA1Padw-hKv-ZprqqWH6KCtCE-PvtJtZeWfwfeihYw";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=upazilas`;

const COL_DIVISION = 2, COL_DISTRICT = 3, COL_UPAZILA = 4, COL_STATUS = 5, COL_UPCODE = 6;
const GEO_UPCODE   = "adm3_pcode";
const GEO_UPAZILA  = "adm3_name";
const GEO_DISTRICT = "adm2_name";
const GEO_DIVISION = "adm1_name";

// ── HELPERS ───────────────────────────────────────────────────────
function norm(str) {
  return (str || "").toString().trim().toLowerCase();
}
function statusColor(status) {
  if (!status) return "#e8ecef";
  const s = norm(status);
  if (s.includes("done") || s.includes("complete"))                      return "#2ecc71";
  if (s.includes("ongoing") || s.includes("progress"))                   return "#f1c40f";
  if (s.includes("todo") || s.includes("pending") || s.includes("to do")) return "#bdc3c7";
  return "#e8ecef";
}

// ── GLOBAL STATE ─────────────────────────────────────────────────
let doneList = [], ongoingList = [], todoList = [];
let upazilaIndex = []; // for mobile search

// ── MOBILE: legend toggle ─────────────────────────────────────────
window.toggleMobileLegend = function () {
  const sheet = document.getElementById("mobileLegendSheet");
  const btn   = document.getElementById("mobileLegendToggle");
  const open  = sheet.style.transform !== "translateY(0px)";
  sheet.style.transform = open ? "translateY(0px)" : "translateY(105%)";
  sheet.style.display   = "block";
  btn.textContent = open ? "✕" : "📊";
  // Sync mobile content from desktop legend
  const mc = document.getElementById("mobileLegendContent");
  if (mc && window.legendDiv) mc.innerHTML = window.legendDiv.innerHTML;
};

// ── MOBILE: search toggle ─────────────────────────────────────────
window.toggleMobileSearch = function () {
  const panel = document.getElementById("mobileSearchPanel");
  const open  = panel.style.display === "block";
  panel.style.display = open ? "none" : "block";
  if (!open) document.getElementById("mobileSearchInput").focus();
};

// ── MOBILE: wire search input ────────────────────────────────────
function initMobileSearch() {
  const input   = document.getElementById("mobileSearchInput");
  const results = document.getElementById("mobileSearchResults");
  if (!input) return;
  input.addEventListener("input", e => {
    const term = e.target.value.trim().toLowerCase();
    results.innerHTML = "";
    if (term.length < 2) return;
    upazilaIndex.filter(u => u.name.toLowerCase().includes(term))
      .slice(0, 10)
      .forEach(u => {
        const div = document.createElement("div");
        div.innerHTML = `<strong>${u.name}</strong>
          <span style="color:#aaa;font-size:11px;margin-left:6px;">${u.district}, ${u.division}</span>`;
        div.onclick = () => {
          u.mapRef.fitBounds(u.bounds, { padding: [50, 50], maxZoom: 12 });
          input.value = u.name;
          results.innerHTML = "";
          document.getElementById("mobileSearchPanel").style.display = "none";
          document.getElementById("mobileSearchBtn").textContent = "🔍";
        };
        results.appendChild(div);
      });
  });
}

// ── TABLE MODAL ───────────────────────────────────────────────────
window.toggleTable = function () {
  const el = document.getElementById("dataTableContainer");
  el.style.display = el.style.display === "none" ? "block" : "none";
  // Hide mobile sheet if open
  const sheet = document.getElementById("mobileLegendSheet");
  if (sheet) { sheet.style.transform = "translateY(105%)"; }
  document.getElementById("mobileLegendToggle").textContent = "📊";
};

window.filterTableByDivision = function () {
  const filter = norm(document.getElementById("divisionFilter")?.value || "");
  const rows   = document.querySelectorAll("#tableBody tr");
  let count = 0;
  rows.forEach(row => {
    const div  = norm(row.getAttribute("data-division") || "");
    const show = !filter || div.includes(filter);
    row.style.display = show ? "" : "none";
    if (show) count++;
  });
  const el = document.getElementById("filterCount");
  if (el) el.textContent = filter ? `Showing ${count} of ${rows.length}` : `All ${rows.length}`;
};

window.showStatusTable = function (type) {
  const listMap  = { done: doneList, ongoing: ongoingList, todo: todoList };
  const titleMap = { done: "✅ Done Upazilas", ongoing: "⏳ Ongoing Upazilas", todo: "🔄 ToDo Upazilas" };
  const bgMap    = { done: "#d4edda", ongoing: "#fff3cd", todo: "#f8f9fa" };
  const list     = listMap[type] || [];
  document.getElementById("tableTitle").textContent = `${titleMap[type]} (${list.length})`;
  const divisions = [...new Set(list.map(i => i.division).filter(Boolean))].sort();
  const rows = list.map((item, idx) => `
    <tr data-division="${item.division || ""}"
        style="background:${idx % 2 === 0 ? bgMap[type] : "white"};">
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;">${item.division  || ""}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;">${item.district  || ""}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-weight:600;">${item.upazila || ""}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;
          color:${statusColor(item.status)};font-weight:700;">${item.status || ""}</td>
    </tr>`).join("");
  document.getElementById("statusTable").innerHTML = `
    <div style="margin-bottom:15px;display:flex;align-items:center;flex-wrap:wrap;gap:10px;">
      <label style="font-weight:700;color:#2c3e50;">Filter by Division:</label>
      <select id="divisionFilter" onchange="filterTableByDivision()"
        style="padding:8px 14px;border:2px solid #ddd;border-radius:6px;font-size:13px;min-width:180px;">
        <option value="">All Divisions (${divisions.length})</option>
        ${divisions.map(d => `<option value="${d}">${d}</option>`).join("")}
      </select>
      <span id="filterCount" style="font-weight:700;color:#666;font-size:13px;"></span>
    </div>
    <div style="overflow:auto;max-height:60vh;border-radius:8px;border:1px solid #eee;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#2c3e50;color:white;position:sticky;top:0;">
            <th style="padding:12px 10px;text-align:left;">Division</th>
            <th style="padding:12px 10px;text-align:left;">District</th>
            <th style="padding:12px 10px;text-align:left;">Upazila</th>
            <th style="padding:12px 10px;text-align:left;">Status</th>
          </tr>
        </thead>
        <tbody id="tableBody">${rows}</tbody>
      </table>
    </div>`;
  window.toggleTable();
  window.filterTableByDivision();
};

// ── LEGEND CONTENT (shared by desktop + mobile) ───────────────────
function legendInnerHTML(stats) {
  const pct = ((stats.done + stats.ongoing) / 495 * 100).toFixed(1);
  return `
    <div style="text-align:center;padding-bottom:12px;border-bottom:2px solid #ecf0f1;margin-bottom:12px;">
      <div style="font-size:13px;font-weight:700;color:#2c3e50;margin-bottom:4px;">📊 Zoning Progress</div>
      <div style="font-size:28px;font-weight:900;color:#27ae60;">${pct}%</div>
      <div style="font-size:11px;color:#aaa;">${stats.total} / 495 upazilas</div>
    </div>
    <div style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
      <span><span style="display:inline-block;width:16px;height:16px;background:#2ecc71;
        border-radius:3px;margin-right:8px;vertical-align:middle;"></span>Done</span>
      <strong>${stats.done}</strong>
    </div>
    <div style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">
      <span><span style="display:inline-block;width:16px;height:16px;background:#f1c40f;
        border-radius:3px;margin-right:8px;vertical-align:middle;"></span>Ongoing</span>
      <strong>${stats.ongoing}</strong>
    </div>
    <div style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;">
      <span><span style="display:inline-block;width:16px;height:16px;background:#bdc3c7;
        border-radius:3px;margin-right:8px;vertical-align:middle;"></span>ToDo</span>
      <strong>${stats.todo}</strong>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;">
      <button onclick="showStatusTable('done')"
        style="background:#2ecc71;color:white;border:none;padding:10px;border-radius:8px;
          cursor:pointer;font-size:13px;font-weight:700;">
        📋 View Done (${stats.done})
      </button>
      <button onclick="showStatusTable('ongoing')"
        style="background:#f1c40f;color:#333;border:none;padding:10px;border-radius:8px;
          cursor:pointer;font-size:13px;font-weight:700;">
        📋 View Ongoing (${stats.ongoing})
      </button>
      <button onclick="showStatusTable('todo')"
        style="background:#bdc3c7;color:#333;border:none;padding:10px;border-radius:8px;
          cursor:pointer;font-size:13px;font-weight:700;">
        📋 View ToDo (${stats.todo})
      </button>
    </div>
    <div style="font-size:10px;color:#bbb;text-align:center;
      border-top:1px solid #f0f0f0;padding-top:8px;">
      🔄 ${new Date().toLocaleTimeString()}
    </div>`;
}

function updateStatsDisplay(stats) {
  // Update desktop legend
  if (window.legendDiv) window.legendDiv.innerHTML = legendInnerHTML(stats);
  // Sync mobile bottom sheet if already open
  const mc = document.getElementById("mobileLegendContent");
  if (mc && mc.innerHTML !== "") mc.innerHTML = legendInnerHTML(stats);
}

// ── GOOGLE SHEET LOADER ───────────────────────────────────────────
async function loadSheetData() {
  try {
    const res     = await fetch(SHEET_URL);
    const text    = await res.text();
    const json    = JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));
    const rows    = json.table.rows || [];
    const statusMap = new Map();
    const stats   = { done: 0, ongoing: 0, todo: 0, total: 0, nodata: 0 };
    doneList = []; ongoingList = []; todoList = [];
    rows.forEach(row => {
      const upcode   = row.c[COL_UPCODE]?.v;
      const status   = row.c[COL_STATUS]?.v;
      const upazila  = row.c[COL_UPAZILA]?.v;
      const district = row.c[COL_DISTRICT]?.v;
      const division = row.c[COL_DIVISION]?.v;
      if (!upcode || !upazila) return;
      stats.total++;
      const entry = { upcode, upazila, district, division, status };
      statusMap.set(String(upcode), entry);
      const s = norm(status);
      if      (s.includes("done") || s.includes("complete"))                       { stats.done++;    doneList.push(entry); }
      else if (s.includes("ongoing") || s.includes("progress"))                    { stats.ongoing++; ongoingList.push(entry); }
      else if (s.includes("todo") || s.includes("pending") || s.includes("to do")) { stats.todo++;    todoList.push(entry); }
      else                                                                           { stats.nodata++; }
    });
    updateStatsDisplay(stats);
    console.log(`✅ Sheet: ${statusMap.size} upazilas`, stats);
    return statusMap;
  } catch (err) {
    console.error("❌ Sheet error:", err);
    updateStatsDisplay({ done: 0, ongoing: 0, todo: 0, total: 0, nodata: 0 });
    return new Map();
  }
}

// ── MAIN MAP ──────────────────────────────────────────────────────
async function initMap() {
  const map = L.map("map", { zoomControl: true }).setView([23.7, 90.4], 7);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> | Land Zoning Dashboard'
  }).addTo(map);

  // Desktop legend
  const legend = L.control({ position: "bottomright" });
  legend.onAdd = function () {
    const div = L.DomUtil.create("div", "info legend");
    div.style.cssText = `background:white;padding:18px;border-radius:10px;
      box-shadow:0 4px 20px rgba(0,0,0,0.22);min-width:215px;font-family:Arial,sans-serif;font-size:13px;`;
    window.legendDiv = div;
    return div;
  };
  legend.addTo(map);
  updateStatsDisplay({ done: 0, ongoing: 0, todo: 0, total: 0, nodata: 0 });

  const statusMap = await loadSheetData();

  const geoRes  = await fetch("./public/bdupazila.json");
  const geojson = await geoRes.json();

  // Desktop search control
  const searchCtrl = L.control({ position: "topleft" });
  searchCtrl.onAdd = function () {
    const wrap = L.DomUtil.create("div");
    wrap.innerHTML = `
      <div style="background:white;padding:7px 12px;border-radius:8px;
        box-shadow:0 2px 12px rgba(0,0,0,0.25);border:2px solid rgba(0,0,0,0.15);
        display:flex;align-items:center;gap:6px;min-width:230px;">
        <span style="font-size:15px;">🔍</span>
        <input id="upazilaSearch" type="text" placeholder="Search upazila..."
          style="border:none;outline:none;flex:1;font-size:13px;background:transparent;" />
        <span id="srchClear" style="cursor:pointer;color:#aaa;font-size:14px;
          user-select:none;padding:0 2px;">✕</span>
      </div>
      <div id="searchDropdown" style="background:white;max-height:220px;overflow-y:auto;
        display:none;box-shadow:0 6px 18px rgba(0,0,0,0.18);border-radius:0 0 8px 8px;
        border:2px solid rgba(0,0,0,0.1);border-top:none;"></div>`;
    L.DomEvent.disableClickPropagation(wrap);
    L.DomEvent.disableScrollPropagation(wrap);

    // Build shared index
    upazilaIndex = geojson.features.map(f => ({
      name:     f.properties[GEO_UPAZILA],
      district: f.properties[GEO_DISTRICT],
      division: f.properties[GEO_DIVISION],
      bounds:   L.geoJSON(f).getBounds(),
      mapRef:   map
    })).filter(u => u.name);

    const input    = wrap.querySelector("#upazilaSearch");
    const dropdown = wrap.querySelector("#searchDropdown");
    wrap.querySelector("#srchClear").onclick = () => { input.value = ""; dropdown.style.display = "none"; };

    input.addEventListener("input", e => {
      const term = e.target.value.trim().toLowerCase();
      dropdown.innerHTML = ""; dropdown.style.display = "none";
      if (term.length < 2) return;
      const hits = upazilaIndex.filter(u => u.name.toLowerCase().includes(term)).slice(0, 10);
      if (!hits.length) {
        dropdown.innerHTML = `<div style="padding:10px 14px;color:#999;font-size:12px;">No upazila found</div>`;
        dropdown.style.display = "block";
        return;
      }
      hits.forEach(u => {
        const item = document.createElement("div");
        item.style.cssText = "padding:9px 14px;cursor:pointer;border-bottom:1px solid #f5f5f5;font-size:13px;";
        item.innerHTML = `<strong>${u.name}</strong>
          <span style="color:#aaa;font-size:11px;margin-left:6px;">${u.district}, ${u.division}</span>`;
        item.onmouseover = () => item.style.background = "#f0f8ff";
        item.onmouseout  = () => item.style.background = "white";
        item.onclick     = () => {
          map.fitBounds(u.bounds, { padding: [50, 50], maxZoom: 12 });
          input.value = u.name;
          dropdown.style.display = "none";
        };
        dropdown.appendChild(item);
      });
      dropdown.style.display = "block";
    });
    document.addEventListener("click", e => {
      if (!wrap.contains(e.target)) dropdown.style.display = "none";
    });
    return wrap;
  };
  searchCtrl.addTo(map);

  // Wire mobile search (same index)
  initMobileSearch();

  // Set mapRef for mobile search after map exists
  upazilaIndex.forEach(u => u.mapRef = map);

  // Upazila layer
  const upazilaLayer = L.geoJSON(geojson, {
    style: f => {
      const rec = statusMap.get(String(f.properties[GEO_UPCODE]));
      return { color: "#555", weight: 0.6, fillColor: statusColor(rec?.status), fillOpacity: 0.82 };
    },
    onEachFeature: (f, layer) => {
      const props  = f.properties;
      const rec    = statusMap.get(String(props[GEO_UPCODE]));
      const status = rec?.status || "No data";
      const color  = statusColor(status);
      layer.bindPopup(`
        <div style="min-width:220px;font-family:Arial,sans-serif;">
          <h3 style="margin:0 0 10px;color:${color};border-bottom:3px solid ${color};padding-bottom:8px;">
            ${props[GEO_UPAZILA]}</h3>
          <table style="width:100%;font-size:13px;border-collapse:collapse;">
            <tr><td style="padding:4px 0;color:#888;width:80px;">District</td>
              <td style="font-weight:600;">${props[GEO_DISTRICT]}</td></tr>
            <tr><td style="padding:4px 0;color:#888;">Division</td>
              <td style="font-weight:600;">${props[GEO_DIVISION]}</td></tr>
            <tr><td style="padding:4px 0;color:#888;">Status</td>
              <td style="color:${color};font-weight:700;">${status}</td></tr>
            <tr><td style="padding:4px 0;color:#888;">Area</td>
              <td>${props.area_sqkm?.toFixed(1) ?? "—"} km²</td></tr>
          </table>
        </div>`);
      layer.on("mouseover", function () {
        this.setStyle({ weight: 2.5, color: "#2c3e50", fillOpacity: 0.95 });
        this.bringToFront();
      });
      layer.on("mouseout", function () { upazilaLayer.resetStyle(this); });
    }
  }).addTo(map);

  // District boundaries
  try {
    const dRes = await fetch("./public/bd-districts.json");
    const districts = await dRes.json();
    L.geoJSON(districts, {
      style: { color: "#2c3e50", weight: 2.5, opacity: 0.9, fill: false, dashArray: "5,4" },
      onEachFeature: (f, l) => l.bindPopup(`<strong>${f.properties.adm2_name}</strong>`)
    }).addTo(map).bringToFront();
  } catch (e) {
    console.warn("bd-districts.json not found — skipping district overlay");
  }

  map.fitBounds(upazilaLayer.getBounds());

  // Initial mobile sheet hidden off-screen
  const sheet = document.getElementById("mobileLegendSheet");
  if (sheet) sheet.style.transform = "translateY(105%)";

  // Auto-refresh every 3 minutes
  setInterval(loadSheetData, 3 * 60 * 1000);
}

// ── START ─────────────────────────────────────────────────────────
initMap().catch(err => {
  console.error("Map error:", err);
  document.body.innerHTML += `<p style="color:red;padding:24px;font-size:16px;">⚠️ ${err.message}</p>`;
});
