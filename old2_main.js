// ================================================================
//  Bangladesh Land Zoning Dashboard v2 — Suman
//  New: 3 overlay layers | Layer on/off + opacity in legend
//       Enhanced popup (Revision, Workshop, Comment)
//       District + Division filter in table | Mobile-friendly
// ================================================================

// ── CONFIG ───────────────────────────────────────────────────────
const SHEET_ID  = "1xRA1Padw-hKv-ZprqqWH6KCtCE-PvtJtZeWfwfeihYw";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=upazilas`;

// ── COLUMN INDICES (after adding new columns after Status) ────────
// Sheet layout: FID | Country | Division | District | Upazila | Status | Revision | Workshop | Comment | upazila_pcode
const COL_DIVISION = 2;
const COL_DISTRICT = 3;
const COL_UPAZILA  = 4;
const COL_REPORT   = 5;  // Zoning Report Status
const COL_REVISION = 6;  // Revision Status       ← NEW column G
const COL_WORKSHOP = 7;  // Workshop Status        ← NEW column H
const COL_COMMENT  = 8;  // Comment                ← NEW column I
const COL_UPCODE   = 9;  // upazila_pcode          ← shifted to column J

// ── GeoJSON PROPERTY KEYS ─────────────────────────────────────────
const GEO_UPCODE   = "adm3_pcode";
const GEO_UPAZILA  = "adm3_name";
const GEO_DISTRICT = "adm2_name";
const GEO_DIVISION = "adm1_name";

// ── LAYER VISIBILITY + OPACITY STATE ─────────────────────────────
const layerVisible = { report: true, revision: false, workshop: false, district: true };
const layerOpacity = { report: 0.82, revision: 0.78, workshop: 0.78, district: 0.9 };

// ── GLOBAL STATE ─────────────────────────────────────────────────
window._map    = null;
window.layers  = { report: null, revision: null, workshop: null, district: null };
window.legendDiv = null;
let upazilaIndex = [];
let doneList = [], ongoingList = [], todoList = [];
let lastStats = { done: 0, ongoing: 0, todo: 0, total: 0, nodata: 0 };
let currentTableList = [];

// ── HELPERS ───────────────────────────────────────────────────────
function norm(s) { return (s || "").toString().trim().toLowerCase(); }

function statusColor(status, type = "report") {
  const s = norm(status);
  if (!s || s === "none" || s === "n/a" || s === "-") {
    return type === "report" ? "#dfe6e9" : "#f0f4f8";
  }
  if (s.includes("done") || s.includes("complete")) {
    return type === "revision" ? "#2980b9" : type === "workshop" ? "#8e44ad" : "#27ae60";
  }
  if (s.includes("ongoing") || s.includes("progress")) return "#f39c12";
  if (s.includes("todo") || s.includes("pending") || s.includes("to do")) return "#95a5a6";
  return "#dfe6e9";
}

function statusBadge(status, type = "report") {
  if (!status || norm(status) === "none") {
    return `<span style="color:#bbb;font-size:11px;">➖ None</span>`;
  }
  const s = norm(status);
  const color = statusColor(status, type);
  const icon = (s.includes("done") || s.includes("complete")) ? "✅"
    : (s.includes("ongoing") || s.includes("progress")) ? "⏳"
    : (s.includes("todo") || s.includes("pending")) ? "🔲" : "❓";
  return `<span style="color:${color};font-weight:700;">${icon} ${status}</span>`;
}

// ── LAYER CONTROLS (called from inline HTML handlers) ─────────────
window.toggleLayer = function(name) {
  const cb = document.querySelector(`[data-layer="${name}"]`);
  if (!cb) return;
  layerVisible[name] = cb.checked;
  const layer = window.layers[name];
  if (!layer || !window._map) return;
  if (cb.checked) {
    layer.addTo(window._map);
    if (name !== "district" && layerVisible.district && window.layers.district) {
      window.layers.district.bringToFront();
    }
  } else {
    window._map.removeLayer(layer);
  }
};

window.setLayerOpacity = function(name, val) {
  layerOpacity[name] = parseFloat(val);
  const layer = window.layers[name];
  if (!layer) return;
  layer.setStyle(name === "district"
    ? { opacity: parseFloat(val) }
    : { fillOpacity: parseFloat(val) }
  );
  const span = document.getElementById(`opval-${name}`);
  if (span) span.textContent = Math.round(val * 100) + "%";
  const mspan = document.getElementById(`opval-m-${name}`);
  if (mspan) mspan.textContent = Math.round(val * 100) + "%";
};

// ── MOBILE CONTROLS ───────────────────────────────────────────────
window.toggleMobileLegend = function() {
  const sheet = document.getElementById("mobileLegendSheet");
  const btn   = document.getElementById("mobileLegendToggle");
  const isOpen = sheet.style.transform === "translateY(0px)";
  sheet.style.transform = isOpen ? "translateY(105%)" : "translateY(0px)";
  sheet.style.display   = "block";
  btn.textContent = isOpen ? "📊" : "✕";
  if (!isOpen) {
    const mc = document.getElementById("mobileLegendContent");
    if (mc && window.legendDiv) mc.innerHTML = window.legendDiv.innerHTML;
  }
};

window.toggleMobileSearch = function() {
  const panel = document.getElementById("mobileSearchPanel");
  const isOpen = panel.style.display === "block";
  panel.style.display = isOpen ? "none" : "block";
  if (!isOpen) setTimeout(() => document.getElementById("mobileSearchInput")?.focus(), 80);
};

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
          u.mapRef.fitBounds(u.bounds, { padding: [50,50], maxZoom: 12 });
          input.value = u.name;
          results.innerHTML = "";
          document.getElementById("mobileSearchPanel").style.display = "none";
        };
        results.appendChild(div);
      });
  });
}

// ── TABLE MODAL ───────────────────────────────────────────────────
window.toggleTable = function() {
  const el = document.getElementById("dataTableContainer");
  el.style.display = el.style.display === "none" ? "block" : "none";
  const sheet = document.getElementById("mobileLegendSheet");
  if (sheet) sheet.style.transform = "translateY(105%)";
  const btn = document.getElementById("mobileLegendToggle");
  if (btn) btn.textContent = "📊";
};

window.filterTable = function() {
  const divF  = norm(document.getElementById("divisionFilter")?.value || "");
  const distF = norm(document.getElementById("districtFilter")?.value || "");
  const rows  = document.querySelectorAll("#tableBody tr");
  let count = 0;
  rows.forEach(row => {
    const rd = norm(row.getAttribute("data-division") || "");
    const rt = norm(row.getAttribute("data-district") || "");
    const show = (!divF || rd.includes(divF)) && (!distF || rt.includes(distF));
    row.style.display = show ? "" : "none";
    if (show) count++;
  });
  const el = document.getElementById("filterCount");
  if (el) el.textContent = `Showing ${count} of ${rows.length}`;
  // Repopulate district dropdown based on division
  const sel = document.getElementById("districtFilter");
  if (sel) {
    const curDist = norm(sel.value);
    const dists = [...new Set(
      currentTableList
        .filter(i => !divF || norm(i.division).includes(divF))
        .map(i => i.district).filter(Boolean)
    )].sort();
    sel.innerHTML = `<option value="">All Districts</option>`
      + dists.map(d => `<option value="${d}" ${norm(d) === curDist ? "selected" : ""}>${d}</option>`).join("");
  }
};

window.showStatusTable = function(type) {
  const listMap  = { done: doneList, ongoing: ongoingList, todo: todoList };
  const titleMap = { done: "✅ Done Upazilas", ongoing: "⏳ Ongoing Upazilas", todo: "🔲 ToDo Upazilas" };
  const bgMap    = { done: "#eafaf1", ongoing: "#fef9e7", todo: "#f8f9fa" };
  const list     = listMap[type] || [];
  currentTableList = list;

  document.getElementById("tableTitle").innerHTML =
    `${titleMap[type]} <span style="font-size:12px;font-weight:400;color:#888;">(Zoning Report)</span>`;

  const divisions = [...new Set(list.map(i => i.division).filter(Boolean))].sort();
  const districts = [...new Set(list.map(i => i.district).filter(Boolean))].sort();

  const rows = list.map((item, idx) => `
    <tr data-division="${item.division||""}" data-district="${item.district||""}"
        style="background:${idx%2===0 ? bgMap[type] : "white"};">
      <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;">${item.division||""}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;">${item.district||""}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;font-weight:600;">${item.upazila||""}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;">${statusBadge(item.report,"report")}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;">${statusBadge(item.revision,"revision")}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;">${statusBadge(item.workshop,"workshop")}</td>
    </tr>`).join("");

  document.getElementById("statusTable").innerHTML = `
    <div style="margin-bottom:14px;display:flex;align-items:center;flex-wrap:wrap;gap:8px;">
      <label style="font-weight:700;color:#2c3e50;font-size:13px;">Filter:</label>
      <select id="divisionFilter" onchange="filterTable()"
        style="padding:7px 12px;border:2px solid #ddd;border-radius:7px;font-size:13px;min-width:150px;cursor:pointer;">
        <option value="">All Divisions (${divisions.length})</option>
        ${divisions.map(d=>`<option value="${d}">${d}</option>`).join("")}
      </select>
      <select id="districtFilter" onchange="filterTable()"
        style="padding:7px 12px;border:2px solid #ddd;border-radius:7px;font-size:13px;min-width:150px;cursor:pointer;">
        <option value="">All Districts (${districts.length})</option>
        ${districts.map(d=>`<option value="${d}">${d}</option>`).join("")}
      </select>
      <span id="filterCount" style="color:#888;font-size:12px;font-weight:600;">All ${list.length}</span>
    </div>
    <!-- Color key -->
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;font-size:11px;">
      <span style="background:#27ae60;color:white;padding:2px 8px;border-radius:10px;">🟢 Report Done</span>
      <span style="background:#2980b9;color:white;padding:2px 8px;border-radius:10px;">🔵 Revision Done</span>
      <span style="background:#8e44ad;color:white;padding:2px 8px;border-radius:10px;">🟣 Workshop Done</span>
      <span style="background:#f39c12;color:white;padding:2px 8px;border-radius:10px;">🟡 Ongoing</span>
      <span style="background:#95a5a6;color:white;padding:2px 8px;border-radius:10px;">⚫ ToDo</span>
    </div>
    <div style="overflow:auto;max-height:58vh;border-radius:8px;border:1px solid #eee;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:560px;">
        <thead>
          <tr style="background:#2c3e50;color:white;position:sticky;top:0;z-index:1;">
            <th style="padding:11px 10px;text-align:left;">Division</th>
            <th style="padding:11px 10px;text-align:left;">District</th>
            <th style="padding:11px 10px;text-align:left;">Upazila</th>
            <th style="padding:11px 10px;text-align:left;">📋 Report</th>
            <th style="padding:11px 10px;text-align:left;">🔄 Revision</th>
            <th style="padding:11px 10px;text-align:left;">🏛 Workshop</th>
          </tr>
        </thead>
        <tbody id="tableBody">${rows}</tbody>
      </table>
    </div>`;

  window.toggleTable();
};

// ── LEGEND HTML ───────────────────────────────────────────────────
function layerRow(key, label, colorDot, idSuffix) {
  const opPct = Math.round(layerOpacity[key] * 100);
  const sid   = idSuffix || "";
  return `
    <div style="margin-bottom:3px;">
      <div style="display:flex;align-items:center;gap:6px;">
        <input type="checkbox" data-layer="${key}" ${layerVisible[key] ? "checked" : ""}
          onchange="toggleLayer('${key}')"
          style="width:14px;height:14px;cursor:pointer;accent-color:${colorDot};flex-shrink:0;" />
        <span style="display:inline-block;width:12px;height:12px;background:${colorDot};
          border-radius:3px;flex-shrink:0;"></span>
        <span style="flex:1;font-size:12px;color:#2c3e50;font-weight:600;">${label}</span>
        <span id="opval${sid}-${key}" style="font-size:10px;color:#aaa;min-width:26px;text-align:right;">${opPct}%</span>
      </div>
      <div style="padding-left:20px;margin-top:2px;margin-bottom:5px;">
        <input type="range" min="0" max="1" step="0.05" value="${layerOpacity[key]}"
          oninput="setLayerOpacity('${key}',this.value);document.getElementById('opval${sid}-${key}').textContent=Math.round(this.value*100)+'%'"
          style="width:100%;height:3px;accent-color:${colorDot};cursor:pointer;" />
      </div>
    </div>`;
}

function legendInnerHTML(stats) {
  const pct      = ((stats.done + stats.ongoing) / 495 * 100).toFixed(1);
  const donePct  = (stats.done / 495 * 100).toFixed(2);
  const ongoPct  = (stats.ongoing / 495 * 100).toFixed(2);

  return `
    <!-- PROGRESS HEADER -->
    <div style="text-align:center;padding-bottom:10px;border-bottom:2px solid #ecf0f1;margin-bottom:10px;">
      <div style="font-size:11px;font-weight:700;color:#7f8c8d;letter-spacing:0.5px;
        text-transform:uppercase;margin-bottom:3px;">Zoning Report Progress</div>
      <div style="font-size:30px;font-weight:900;color:#27ae60;line-height:1.1;">${pct}%</div>
      <div style="font-size:10px;color:#aaa;margin-bottom:6px;">${stats.total} / 495 UZ + 12 CP</div>
      <div style="height:7px;background:#ecf0f1;border-radius:4px;overflow:hidden;display:flex;">
        <div style="width:${donePct}%;background:#27ae60;"></div>
        <div style="width:${ongoPct}%;background:#f39c12;"></div>
      </div>
    </div>
    <!-- STATUS CARDS -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:10px;">
      <div onclick="showStatusTable('done')" style="cursor:pointer;text-align:center;
        background:#eafaf1;border:1px solid #a9dfbf;border-radius:7px;padding:5px 2px;
        transition:transform .1s;" onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'">
        <div style="font-size:17px;font-weight:800;color:#27ae60;">${stats.done}</div>
        <div style="font-size:9px;color:#555;font-weight:600;">Done ↗</div>
      </div>
      <div onclick="showStatusTable('ongoing')" style="cursor:pointer;text-align:center;
        background:#fef9e7;border:1px solid #f9ca7a;border-radius:7px;padding:5px 2px;
        transition:transform .1s;" onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'">
        <div style="font-size:17px;font-weight:800;color:#f39c12;">${stats.ongoing}</div>
        <div style="font-size:9px;color:#555;font-weight:600;">Ongoing ↗</div>
      </div>
      <div onclick="showStatusTable('todo')" style="cursor:pointer;text-align:center;
        background:#f8f9fa;border:1px solid #ccc;border-radius:7px;padding:5px 2px;
        transition:transform .1s;" onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'">
        <div style="font-size:17px;font-weight:800;color:#95a5a6;">${stats.todo}</div>
        <div style="font-size:9px;color:#555;font-weight:600;">ToDo ↗</div>
      </div>
    </div>
    <!-- VIEW BUTTONS -->
    <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px;">
      <button onclick="showStatusTable('done')"
        style="background:linear-gradient(135deg,#27ae60,#2ecc71);color:white;border:none;
          padding:8px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;
          box-shadow:0 2px 8px rgba(39,174,96,.3);">📋 View Done (${stats.done})</button>
      <button onclick="showStatusTable('ongoing')"
        style="background:linear-gradient(135deg,#e67e22,#f39c12);color:white;border:none;
          padding:8px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;
          box-shadow:0 2px 8px rgba(243,156,18,.3);">📋 View Ongoing (${stats.ongoing})</button>
      <button onclick="showStatusTable('todo')"
        style="background:linear-gradient(135deg,#7f8c8d,#95a5a6);color:white;border:none;
          padding:8px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;
          box-shadow:0 2px 8px rgba(149,165,166,.3);">📋 View ToDo (${stats.todo})</button>
    </div>
    <!-- LAYER CONTROLS -->
    <div style="border-top:2px solid #ecf0f1;padding-top:10px;">
      <div style="font-size:10px;font-weight:700;color:#95a5a6;letter-spacing:0.8px;
        text-transform:uppercase;margin-bottom:8px;">🗂 Layer Controls</div>
      ${layerRow("report",   "🟢 Zoning Report", "#27ae60")}
      ${layerRow("revision", "🔵 Revision",      "#2980b9")}
      ${layerRow("workshop", "🟣 Workshop",       "#8e44ad")}
      ${layerRow("district", "⬛ Districts",      "#2c3e50")}
    </div>
    <!-- COLOR LEGEND -->
    <div style="border-top:1px solid #ecf0f1;padding-top:8px;margin-top:4px;font-size:10px;">
      <div style="color:#95a5a6;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">Map Colors</div>
      <div style="display:flex;flex-direction:column;gap:3px;">
        <div style="display:flex;align-items:center;gap:5px;">
          <span style="width:34px;height:10px;background:linear-gradient(90deg,#27ae60,#2980b9,#8e44ad);border-radius:2px;display:inline-block;"></span>
          Done (Report / Revision / Workshop)
        </div>
        <div style="display:flex;align-items:center;gap:5px;">
          <span style="width:34px;height:10px;background:#f39c12;border-radius:2px;display:inline-block;"></span> Ongoing
        </div>
        <div style="display:flex;align-items:center;gap:5px;">
          <span style="width:34px;height:10px;background:#95a5a6;border-radius:2px;display:inline-block;"></span> ToDo
        </div>
      </div>
    </div>
    <!-- TIMESTAMP -->
    <div style="font-size:10px;color:#bbb;text-align:right;padding-top:6px;margin-top:4px;
      border-top:1px solid #f5f5f5;">
      🔄 ${new Date().toLocaleTimeString()}
    </div>`;
}

function updateStatsDisplay(stats) {
  lastStats = stats;
  if (window.legendDiv) window.legendDiv.innerHTML = legendInnerHTML(stats);
  const mc = document.getElementById("mobileLegendContent");
  if (mc && mc.innerHTML !== "") mc.innerHTML = legendInnerHTML(stats);
}

// ── GOOGLE SHEET LOADER ───────────────────────────────────────────
async function loadSheetData() {
  try {
    const res  = await fetch(SHEET_URL);
    const text = await res.text();
    const json = JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));
    const rows = json.table.rows || [];

    const statusMap = new Map();
    const stats = { done: 0, ongoing: 0, todo: 0, total: 0, nodata: 0 };
    doneList = []; ongoingList = []; todoList = [];

    rows.forEach(row => {
      const upcode   = row.c[COL_UPCODE]?.v;
      const upazila  = row.c[COL_UPAZILA]?.v;
      const district = row.c[COL_DISTRICT]?.v;
      const division = row.c[COL_DIVISION]?.v;
      const report   = row.c[COL_REPORT]?.v   || "";
      const revision = row.c[COL_REVISION]?.v  || "";
      const workshop = row.c[COL_WORKSHOP]?.v  || "";
      const comment  = row.c[COL_COMMENT]?.v   || "";
      if (!upcode || !upazila) return;

      stats.total++;
      const entry = { upcode, upazila, district, division, report, revision, workshop, comment,
                      status: report }; // 'status' alias kept for compat
      statusMap.set(String(upcode), entry);

      const s = norm(report);
      if      (s.includes("done") || s.includes("complete"))                       { stats.done++;    doneList.push(entry); }
      else if (s.includes("ongoing") || s.includes("progress"))                    { stats.ongoing++; ongoingList.push(entry); }
      else if (s.includes("todo") || s.includes("pending") || s.includes("to do")) { stats.todo++;    todoList.push(entry); }
      else                                                                          { stats.nodata++; }
    });

    updateStatsDisplay(stats);
    console.log(`✅ Sheet loaded: ${statusMap.size} upazilas`, stats);
    return statusMap;
  } catch (err) {
    console.error("❌ Sheet error:", err);
    updateStatsDisplay({ done: 0, ongoing: 0, todo: 0, total: 0, nodata: 0 });
    return new Map();
  }
}

// ── LAYER STYLE FACTORIES ─────────────────────────────────────────
function makeReportStyle(f, sm) {
  const rec = sm.get(String(f.properties[GEO_UPCODE]));
  return { color: "#666", weight: 0.6, fillColor: statusColor(rec?.report, "report"), fillOpacity: layerOpacity.report };
}
function makeRevisionStyle(f, sm) {
  const rec = sm.get(String(f.properties[GEO_UPCODE]));
  return { color: "#666", weight: 0.6, fillColor: statusColor(rec?.revision, "revision"), fillOpacity: layerOpacity.revision };
}
function makeWorkshopStyle(f, sm) {
  const rec = sm.get(String(f.properties[GEO_UPCODE]));
  return { color: "#666", weight: 0.6, fillColor: statusColor(rec?.workshop, "workshop"), fillOpacity: layerOpacity.workshop };
}

// ── POPUP BUILDER ─────────────────────────────────────────────────
function buildPopup(props, rec) {
  const name     = props[GEO_UPAZILA]  || "—";
  const district = props[GEO_DISTRICT] || rec?.district || "—";
  const division = props[GEO_DIVISION] || rec?.division || "—";
  const area     = props.area_sqkm?.toFixed(1) ?? "—";
  const report   = rec?.report   || "No data";
  const revision = rec?.revision || "None";
  const workshop = rec?.workshop || "No data";
  const comment  = (rec?.comment || "").toString().trim();
  const rColor   = statusColor(report, "report");

  return `
    <div style="min-width:240px;max-width:290px;font-family:'Segoe UI',Arial,sans-serif;line-height:1.55;">
      <h3 style="margin:0 0 10px;color:${rColor};font-size:16px;font-weight:800;
        border-bottom:3px solid ${rColor};padding-bottom:8px;">${name}</h3>

      <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 12px;
        font-size:13px;margin-bottom:11px;">
        <span style="color:#999;white-space:nowrap;">District</span>
        <strong style="color:#2c3e50;">${district}</strong>
        <span style="color:#999;white-space:nowrap;">Division</span>
        <strong style="color:#2c3e50;">${division}</strong>
        <span style="color:#999;white-space:nowrap;">Area</span>
        <span style="color:#555;">${area} km²</span>
      </div>

      <div style="background:#f8fafc;border-radius:9px;padding:9px 11px;
        border:1px solid #e8ecef;margin-bottom:${comment ? "9px" : "0"};">
        <div style="font-size:9.5px;font-weight:700;color:#95a5a6;letter-spacing:.6px;
          text-transform:uppercase;margin-bottom:7px;">Status Summary</div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:5px 10px;font-size:12px;">
          <span style="color:#888;white-space:nowrap;">📋 Zoning Report</span>
          ${statusBadge(report,  "report")}
          <span style="color:#888;white-space:nowrap;">🔄 Revision</span>
          ${statusBadge(revision, "revision")}
          <span style="color:#888;white-space:nowrap;">🏛 Workshop</span>
          ${statusBadge(workshop, "workshop")}
        </div>
      </div>

      ${comment ? `
      <div style="background:#fffbf0;border-radius:9px;padding:9px 11px;
        border-left:3px solid #f39c12;border:1px solid #fce5a0;">
        <div style="font-size:9.5px;font-weight:700;color:#e67e22;letter-spacing:.6px;
          text-transform:uppercase;margin-bottom:5px;">💬 Comment</div>
        <div style="font-size:12px;color:#34495e;line-height:1.5;">${comment}</div>
      </div>` : ""}
    </div>`;
}

// ── MAIN MAP INIT ─────────────────────────────────────────────────
async function initMap() {
  const map = L.map("map", { zoomControl: true }).setView([23.7, 90.4], 7);
  window._map = map;

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> | Land Zoning Dashboard'
  }).addTo(map);

  // Desktop legend (bottom-right)
  const legendCtrl = L.control({ position: "bottomright" });
  legendCtrl.onAdd = function() {
    const div = L.DomUtil.create("div", "info legend");
    div.style.cssText = `background:white;padding:16px 16px 12px;border-radius:14px;
      box-shadow:0 6px 28px rgba(0,0,0,.22);width:222px;font-family:'Segoe UI',Arial,sans-serif;
      font-size:13px;max-height:92vh;overflow-y:auto;`;
    window.legendDiv = div;
    L.DomEvent.disableScrollPropagation(div);
    L.DomEvent.disableClickPropagation(div);
    return div;
  };
  legendCtrl.addTo(map);
  updateStatsDisplay({ done: 0, ongoing: 0, todo: 0, total: 0, nodata: 0 });

  // Load sheet data
  const statusMap = await loadSheetData();

  // Load upazila GeoJSON
  const geoRes  = await fetch("./public/bdupazila.json");
  const geojson = await geoRes.json();

  // Build search index
  upazilaIndex = geojson.features.map(f => ({
    name:     f.properties[GEO_UPAZILA],
    district: f.properties[GEO_DISTRICT],
    division: f.properties[GEO_DIVISION],
    bounds:   L.geoJSON(f).getBounds(),
    mapRef:   map
  })).filter(u => u.name);

  // Desktop search control
  const searchCtrl = L.control({ position: "topleft" });
  searchCtrl.onAdd = function() {
    const wrap = L.DomUtil.create("div");
    wrap.innerHTML = `
      <div style="background:white;padding:7px 12px;border-radius:10px;
        box-shadow:0 2px 14px rgba(0,0,0,.22);border:2px solid rgba(0,0,0,.12);
        display:flex;align-items:center;gap:7px;min-width:235px;">
        <span style="font-size:15px;">🔍</span>
        <input id="upazilaSearch" type="text" placeholder="Search upazila…"
          style="border:none;outline:none;flex:1;font-size:13px;background:transparent;color:#2c3e50;" />
        <span id="srchClear" style="cursor:pointer;color:#bbb;font-size:16px;user-select:none;">✕</span>
      </div>
      <div id="searchDropdown" style="background:white;max-height:220px;overflow-y:auto;display:none;
        box-shadow:0 6px 18px rgba(0,0,0,.18);border-radius:0 0 10px 10px;
        border:2px solid rgba(0,0,0,.1);border-top:none;"></div>`;
    L.DomEvent.disableClickPropagation(wrap);
    L.DomEvent.disableScrollPropagation(wrap);
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
        dropdown.style.display = "block"; return;
      }
      hits.forEach(u => {
        const item = document.createElement("div");
        item.style.cssText = "padding:9px 14px;cursor:pointer;border-bottom:1px solid #f5f5f5;font-size:13px;";
        item.innerHTML = `<strong>${u.name}</strong>
          <span style="color:#aaa;font-size:11px;margin-left:6px;">${u.district}, ${u.division}</span>`;
        item.onmouseover = () => item.style.background = "#f0f8ff";
        item.onmouseout  = () => item.style.background = "white";
        item.onclick     = () => {
          map.fitBounds(u.bounds, { padding:[50,50], maxZoom:12 });
          input.value = u.name; dropdown.style.display = "none";
        };
        dropdown.appendChild(item);
      });
      dropdown.style.display = "block";
    });
    document.addEventListener("click", e => { if (!wrap.contains(e.target)) dropdown.style.display = "none"; });
    return wrap;
  };
  searchCtrl.addTo(map);
  initMobileSearch();

  // ── BUILD THREE UPAZILA OVERLAY LAYERS ───────────────────────────
  function buildLayer(styleFn, layerKey) {
    return L.geoJSON(geojson, {
      style: f => styleFn(f, statusMap),
      onEachFeature: (f, layer) => {
        const rec = statusMap.get(String(f.properties[GEO_UPCODE]));
        layer.bindPopup(buildPopup(f.properties, rec), { maxWidth: 310, className: "zoning-popup" });
        layer.on("mouseover", function() {
          this.setStyle({ weight: 2.5, color: "#2c3e50",
            fillOpacity: Math.min(layerOpacity[layerKey] + 0.12, 1) });
          this.bringToFront();
        });
        layer.on("mouseout", function() {
          window.layers[layerKey]?.resetStyle(this);
          if (layerVisible.district && window.layers.district)
            window.layers.district.bringToFront();
        });
      }
    });
  }

  window.layers.report   = buildLayer(makeReportStyle,   "report");
  window.layers.revision = buildLayer(makeRevisionStyle,  "revision");
  window.layers.workshop = buildLayer(makeWorkshopStyle,  "workshop");

  if (layerVisible.report)   window.layers.report.addTo(map);
  if (layerVisible.revision) window.layers.revision.addTo(map);
  if (layerVisible.workshop) window.layers.workshop.addTo(map);

  // ── DISTRICT BOUNDARY LAYER ───────────────────────────────────────
  try {
    const dRes = await fetch("./public/bd-districts.json");
    const dJson = await dRes.json();
    window.layers.district = L.geoJSON(dJson, {
      style: { color: "#1a252f", weight: 2.2, opacity: layerOpacity.district, fill: false, dashArray: "5,4" },
      onEachFeature: (f, l) =>
        l.bindPopup(`<strong style="font-size:14px;">${f.properties.adm2_name}</strong>`)
    });
    if (layerVisible.district) window.layers.district.addTo(map).bringToFront();
  } catch (e) {
    console.warn("bd-districts.json not available — district overlay skipped");
  }

  map.fitBounds(window.layers.report.getBounds());

  // Hide mobile sheet on load
  const sheet = document.getElementById("mobileLegendSheet");
  if (sheet) sheet.style.transform = "translateY(105%)";

  // ── AUTO-REFRESH every 3 min ──────────────────────────────────────
  setInterval(async () => {
    const newMap = await loadSheetData();
    // Restyle and rebind popups for all three layers
    const layerKeys = ["report", "revision", "workshop"];
    const styleFns  = [makeReportStyle, makeRevisionStyle, makeWorkshopStyle];
    layerKeys.forEach((key, i) => {
      const layer = window.layers[key];
      if (!layer) return;
      layer.setStyle(f => styleFns[i](f, newMap));
      layer.eachLayer(l => {
        const rec = newMap.get(String(l.feature?.properties[GEO_UPCODE]));
        if (l.getPopup()) l.setPopupContent(buildPopup(l.feature.properties, rec));
      });
    });
  }, 3 * 60 * 1000);
}

// ── BOOT ─────────────────────────────────────────────────────────
initMap().catch(err => {
  console.error("Map init error:", err);
  document.body.innerHTML += `<p style="color:red;padding:24px;font-size:16px;">⚠️ ${err.message}</p>`;
});
