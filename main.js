// CONFIG
const SHEET_ID = "1xRA1Padw-hKv-ZprqqWH6KCtCE-PvtJtZeWfwfeihYw";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=upazilas`;

// Column indices
const COL_UPCODE = 6, COL_STATUS = 5, COL_UPAZILA = 4, COL_DISTRICT = 3, COL_DIVISION = 2;

// GeoJSON keys
const GEO_UPCODE_KEY = "adm3_pcode", GEO_UPAZILA_KEY = "adm3_name", GEO_DISTRICT_KEY = "adm2_name", GEO_DIVISION_KEY = "adm1_name";

// Color function (ToDo = calm gray)
function statusColor(status) {
  if (!status) return "#e8ecef";
  const s = status.toString().trim().toLowerCase();
  if (s.includes("done") || s.includes("complete")) return "#2ecc71";
  if (s.includes("ongoing") || s.includes("progress")) return "#f1c40f";
  if (s.includes("todo") || s.includes("pending") || s.includes("to do")) return "#bdc3c7";
  return "#e8ecef";
}

function norm(str) {
  return (str || "").toString().trim().toLowerCase();
}

// Global lists for table
let doneList = [], ongoingList = [], todoList = [];

// Toggle table modal
function toggleTable() {
  document.getElementById('dataTableContainer').style.display = 
    document.getElementById('dataTableContainer').style.display === 'none' ? 'block' : 'none';
}

// Show filtered table
function showStatusTable(statusType) {
  let list = [], title = '';
  if (statusType === 'done') { list = doneList; title = `Done Upazilas (${list.length})`; }
  else if (statusType === 'ongoing') { list = ongoingList; title = `Ongoing Upazilas (${list.length})`; }
  else if (statusType === 'todo') { list = todoList; title = `ToDo Upazilas (${list.length})`; }
  
  document.getElementById('tableTitle').textContent = title;
  
  const divisions = [...new Set(list.map(item => item.division))].sort();
  
  document.getElementById('statusTable').innerHTML = `
    <div style="margin-bottom:15px;">
      <label style="font-weight:bold; margin-right:10px;">Filter Division:</label>
      <select id="divisionFilter" onchange="filterTableByDivision()" style="padding:8px 12px; border:1px solid #ddd; border-radius:5px; min-width:200px;">
        <option value="">All (${divisions.length})</option>
        ${divisions.map(div => `<option value="${div}">${div}</option>`).join('')}
      </select>
      <span id="filterCount" style="margin-left:15px; font-weight:bold; color:#666;"></span>
    </div>
    <div style="max-height:60vh; overflow:auto;">
      <table id="statusTableInner" style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead><tr style="background:#f8f9fa;">
          <th style="padding:12px 8px; border:1px solid #ddd;">Division</th>
          <th style="padding:12px 8px; border:1px solid #ddd;">District</th>
          <th style="padding:12px 8px; border:1px solid #ddd;">Upazila</th>
          <th style="padding:12px 8px; border:1px solid #ddd;">Status</th>
        </tr></thead>
        <tbody id="tableBody">${list.map(item => `<tr data-division="${item.division}" style="background:${
          statusType === 'done' ? '#d4edda' : statusType === 'ongoing' ? '#fff3cd' : '#f8f9fa'
        };">
          <td style="padding:8px; border:1px solid #ddd;">${item.division}</td>
          <td style="padding:8px; border:1px solid #ddd;">${item.district}</td>
          <td style="padding:8px; border:1px solid #ddd; font-weight:500;">${item.upazila}</td>
          <td style="padding:8px; border:1px solid #ddd; color:${statusColor(item.status)};">${item.status}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
  `;
  toggleTable();
  filterTableByDivision();
}

function filterTableByDivision() {
  const filter = document.getElementById('divisionFilter')?.value || '';
  const rows = document.querySelectorAll('#tableBody tr');
  let count = 0;
  rows.forEach(row => {
    const div = row.getAttribute('data-division') || '';
    row.style.display = (!filter || div.toLowerCase().includes(filter.toLowerCase())) ? '' : 'none';
    if (row.style.display !== 'none') count++;
  });
  document.getElementById('filterCount').textContent = filter ? `Showing ${count}` : `Showing all ${rows.length}`;
}

// Load Google Sheet + build lists
async function loadSheetData() {
  try {
    const res = await fetch(SHEET_URL);
    const text = await res.text();
    const jsonStr = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const data = JSON.parse(jsonStr);
    const table = data.table.rows || [];
    
    const statusMap = new Map();
    const stats = {done:0, ongoing:0, todo:0, total:0, nodata:0};
    doneList = []; ongoingList = []; todoList = [];
    
    table.forEach((row, idx) => {
      if (idx === 0) return;
      const upcode = row.c[COL_UPCODE]?.v;
      const status = row.c[COL_STATUS]?.v;
      const division = row.c[COL_DIVISION]?.v;
      const district = row.c[COL_DISTRICT]?.v;
      const upazila = row.c[COL_UPAZILA]?.v;
      
      if (upcode && upazila) {
        stats.total++;
        const entry = {division, district, upazila, status, upcode};
        statusMap.set(upcode, entry);
        
        const s = norm(status);
        if (s.includes("done") || s.includes("complete")) {
          stats.done++; doneList.push(entry);
        } else if (s.includes("ongoing") || s.includes("progress")) {
          stats.ongoing++; ongoingList.push(entry);
        } else if (s.includes("todo") || s.includes("pending")) {
          stats.todo++; todoList.push(entry);
        } else stats.nodata++;
      }
    });
    
    updateStatsDisplay(stats, statusMap.size);
    console.log(`Loaded ${statusMap.size} upazilas:`, stats);
    return statusMap;
  } catch (err) {
    console.error("Sheet error:", err);
    return new Map();
  }
}

// Update legend with stats + buttons
function updateStatsDisplay(stats, mapSize) {
  const totalUpazilas = 495;
  const progress = ((stats.done + stats.ongoing) / totalUpazilas * 100).toFixed(1);
  
  if (window.legendDiv) {
    window.legendDiv.innerHTML = `
      <div style="font-weight:bold; font-size:14px; margin-bottom:12px; text-align:center; color:#2c3e50; padding-bottom:8px; border-bottom:1px solid #eee;">
        📊 Zoning Progress<br><span style="font-size:20px;">${progress}%</span>
      </div>
      <div style="margin-bottom:8px;">
        <span style="display:inline-block;width:16px;height:16px;background:#2ecc71;margin-right:8px;border:1px solid #ddd;"></span>
        ✅ Done: <strong>${stats.done}</strong>
      </div>
      <div style="margin-bottom:8px;">
        <span style="display:inline-block;width:16px;height:16px;background:#f1c40f;margin-right:8px;border:1px solid #ddd;"></span>
        ⏳ Ongoing: <strong>${stats.ongoing}</strong>
      </div>
      <div style="margin-bottom:12px;">
        <span style="display:inline-block;width:16px;height:16px;background:#bdc3c7;margin-right:8px;border:1px solid #ddd;"></span>
        🔄 ToDo: <strong>${stats.todo}</strong>
      </div>
      <div style="margin-bottom:12px; text-align:center; font-size:12px; color:#666;">
        Total: ${stats.total} upazilas
      </div>
      <div style="text-align:center;">
        <button onclick="showStatusTable('done')" style="background:#2ecc71;color:white;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;margin:2px;font-size:12px;">📋 View Done</button>
        <button onclick="showStatusTable('ongoing')" style="background:#f1c40f;color:#333;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;margin:2px;font-size:12px;">📋 View Ongoing</button>
        <button onclick="showStatusTable('todo')" style="background:#bdc3c7;color:#333;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;margin:2px;font-size:12px;">📋 View ToDo</button>
      </div>
      <div style="font-size:11px; color:#888; text-align:center; padding-top:8px; border-top:1px solid #eee;">
        Updated: ${new Date().toLocaleTimeString()}
      </div>
    `;
  }
}

// Main map
async function initMap() {
  const map = L.map("map").setView([23.7, 90.4], 7);
  
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 13, attribution: "© OpenStreetMap | Land Zoning Dashboard"
  }).addTo(map);
  
  // SEARCH BAR
	// CUSTOM UPAZILA SEARCH (replaces broken GeoSearch)
	const upazilaNames = [];
	geojson.features.forEach(f => {
		upazilaNames.push({
			name: f.properties[GEO_UPAZILA_KEY],
			bounds: L.geoJSON(f).getBounds(),
			feature: f
		});
	});

	const customSearch = L.control({position: 'topleft'});
	customSearch.onAdd = function(map) {
		const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
		div.innerHTML = `
			<div style="background:white; padding:8px; border-radius:4px 4px 0 0; border:1px solid #ccc;">
				<input id="upazilaSearch" placeholder="🔍 Search upazila..." style="border:none; outline:none; width:160px; font-size:13px;" />
			</div>
			<div id="searchResults" style="background:white; max-height:120px; overflow:auto; display:none; border:1px solid #ccc; border-top:none; border-radius:0 0 4px 4px;"></div>
		`;
		
		const input = div.querySelector('#upazilaSearch');
		const results = div.querySelector('#searchResults');
		
		input.addEventListener('input', (e) => {
			const term = e.target.value.toLowerCase();
			results.innerHTML = '';
			results.style.display = 'none';
			
			if (term.length < 2) return;
			
			const matches = upazilaNames.filter(u => 
				u.name.toLowerCase().includes(term)
			).slice(0, 8);
			
			if (matches.length) {
				matches.forEach(u => {
					const btn = document.createElement('div');
					btn.textContent = u.name;
					btn.style.padding = '6px 8px';
					btn.style.cursor = 'pointer';
					btn.style.borderBottom = '1px solid #eee';
					btn.style.fontSize = '13px';
					btn.onmouseover = () => btn.style.background = '#f0f0f0';
					btn.onmouseout = () => btn.style.background = 'white';
					btn.onclick = () => {
						map.fitBounds(u.bounds, {padding: [30,30], maxZoom: 12});
						results.style.display = 'none';
						input.value = u.name;
					};
					results.appendChild(btn);
				});
				results.style.display = 'block';
			}
		});
		
		return div;
	};
	map.addControl(customSearch);

  const statusMap = await loadSheetData();
  
  // UPAZILA LAYER
  const geoRes = await fetch("./public/bdupazila.json");
  const geojson = await geoRes.json();
  const upazilaLayer = L.geoJSON(geojson, {
    style: f => {
      const upcode = f.properties[GEO_UPCODE_KEY];
      const rec = statusMap.get(upcode);
      return {color:"#444", weight:0.6, fillColor:statusColor(rec?.status), fillOpacity:0.75};
    },
    onEachFeature: (f, layer) => {
      const props = f.properties;
      const upcode = props[GEO_UPCODE_KEY];
      const rec = statusMap.get(upcode);
      const status = rec?.status || "No data";
      layer.bindPopup(`
        <div style="min-width:220px;">
          <h3 style="margin:0 0 8px 0; color:${statusColor(status)};">${props[GEO_UPAZILA_KEY]}</h3>
          <strong>District:</strong> ${props[GEO_DISTRICT_KEY]}<br/>
          <strong>Division:</strong> ${props[GEO_DIVISION_KEY]}<br/>
          <strong>Status:</strong> <span style="color:${statusColor(status)}; font-weight:bold;">${status}</span><br/>
          <strong>Area:</strong> ${props.area_sqkm?.toFixed(1)} km²
        </div>
      `);
    }
  }).addTo(map);
  
  // DISTRICT BOUNDARIES
  try {
    const districtRes = await fetch("./public/bd-districts.json");
    const districts = await districtRes.json();
    L.geoJSON(districts, {
      style: {color:"#2c3e50", weight:2.5, opacity:0.9, fill:false, dashArray:"4,4"},
      onEachFeature: (f, l) => l.bindPopup(`<h3>${f.properties.adm2_name}</h3>`)
    }).addTo(map).bringToFront();
  } catch(e) { console.warn("No district file:", e); }
  
  map.fitBounds(upazilaLayer.getBounds());
  
  // LEGEND WITH STATS
	// LEGEND WITH LIVE STATS
	const legend = L.control({position: "bottomright"});
	legend.onAdd = function(map) {
		const div = L.DomUtil.create('div', 'info legend');
		window.legendDiv = div;  // Global reference
		div.style.background = 'white';
		div.style.padding = '16px';
		div.style.borderRadius = '8px';
		div.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
		div.style.minWidth = '200px';
		div.style.fontFamily = 'Arial, sans-serif';
		div.style.zIndex = 1000;
		return div;
	};
	legend.addTo(map);

	// Force initial update
	setTimeout(() => updateStatsDisplay({done:0,ongoing:0,todo:0,total:0},0), 100);

  // Auto-refresh
  setInterval(loadSheetData, 3*60*1000);
}

initMap().catch(console.error);
