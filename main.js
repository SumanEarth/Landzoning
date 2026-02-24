// CONFIG - UPDATE THESE TWO LINES
const SHEET_ID = "1xRA1Padw-hKv-ZprqqWH6KCtCE-PvtJtZeWfwfeihYw"; // From your bdupazila Google Sheet URL
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=upazilas`; // Added sheet=upazilas

// Column indices for your Sheet: FID, Country, Division, District, Upazila, Status, upazila_pcode
const COL_UPCODE = 6;    // upazila_pcode
const COL_STATUS = 5;    // Status
const COL_UPAZILA = 4;   // Upazila (for popup)
const COL_DISTRICT = 3;  // District
const COL_DIVISION = 2;  // Division

// GeoJSON property keys (your exact headers)
const GEO_UPCODE_KEY = "adm3_pcode";
const GEO_UPAZILA_KEY = "adm3_name";
const GEO_DISTRICT_KEY = "adm2_name";
const GEO_DIVISION_KEY = "adm1_name";

// Color function for Status
function statusColor(status) {
  if (!status) return "#cccccc"; // grey for no data
  
  const s = status.trim().toLowerCase();
  if (s.includes("done") || s.includes("complete")) return "#2ecc71";   // green
  if (s.includes("ongoing") || s.includes("progress")) return "#f1c40f"; // yellow
  if (s.includes("todo") || s.includes("pending") || s.includes("to do")) return "#e74c3c"; // red
  return "#cccccc"; // unknown
}

// Normalize for matching (handles extra spaces, case)
function norm(str) {
  return (str || "").toString().trim().toLowerCase();
}

// Load Google Sheet data and create upazila_pcode -> status map
async function loadSheetData() {
  try {
    const res = await fetch(SHEET_URL);
    const text = await res.text();
    
    // Extract JSON from Google's gviz wrapper
    const jsonStr = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const data = JSON.parse(jsonStr);
    
    const table = data.table.rows || [];
    const statusMap = new Map();
    
    table.forEach((row, idx) => {
      // Skip header row
      if (idx === 0) return;
      
      const upcode = row.c[COL_UPCODE]?.v;
      const status = row.c[COL_STATUS]?.v;
      
      if (upcode && status) {
        statusMap.set(upcode, {
          status,
          upazila: row.c[COL_UPAZILA]?.v,
          district: row.c[COL_DISTRICT]?.v,
          division: row.c[COL_DIVISION]?.v
        });
      }
    });
    
    console.log(`Loaded ${statusMap.size} upazilas from Google Sheet`);
    return statusMap;
  } catch (err) {
    console.error("Sheet load error:", err);
    return new Map();
  }
}

// Main map initialization
async function initMap() {
  const map = L.map("map").setView([23.7, 90.4], 7); // Bangladesh center
  
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 12,
    attribution: "© OpenStreetMap contributors"
  }).addTo(map);
  
  // Load status data first
  const statusMap = await loadSheetData();
  
  // Load your GeoJSON
  const geoRes = await fetch("./public/bdupazila.json");
  const geojson = await geoRes.json();
  
  // Create choropleth layer
  const layer = L.geoJSON(geojson, {
    style: feature => {
      const props = feature.properties;
      const upcode = props[GEO_UPCODE_KEY];
      const rec = statusMap.get(upcode);
      const color = statusColor(rec?.status);
      
      return {
        color: "#444",
        weight: 0.8,
        fillColor: color,
        fillOpacity: 0.8,
        opacity: 0.9
      };
    },
    onEachFeature: (feature, layer) => {
      const props = feature.properties;
      const upcode = props[GEO_UPCODE_KEY];
      const rec = statusMap.get(upcode);
      
      const status = rec?.status || "No data";
      const color = statusColor(status);
      
      const popupHtml = `
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; color: ${color};">${props[GEO_UPAZILA_KEY]}</h3>
          <strong>District:</strong> ${props[GEO_DISTRICT_KEY]}<br/>
          <strong>Division:</strong> ${props[GEO_DIVISION_KEY]}<br/>
          <strong>Status:</strong> <span style="color: ${color}; font-weight: bold;">${status}</span><br/>
          <strong>Area:</strong> ${props.area_sqkm?.toFixed(1)} km²<br/>
          <strong>PCode:</strong> ${upcode}
        </div>
      `;
      
      layer.bindPopup(popupHtml);
    }
  }).addTo(map);
  
  // Auto-fit to Bangladesh
  map.fitBounds(layer.getBounds());
  
  // Status legend
  const legend = L.control({ position: "bottomright" });
  legend.onAdd = function () {
    const div = L.DomUtil.create("div", "legend");
    div.style.background = "white";
    div.style.padding = "10px";
    div.style.border = "1px solid #ccc";
    div.style.fontSize = "13px";
    div.innerHTML = `
      <div style="margin-bottom: 5px;"><span style="display:inline-block;width:14px;height:14px;background:#2ecc71;margin-right:6px;"></span>Done</div>
      <div style="margin-bottom: 5px;"><span style="display:inline-block;width:14px;height:14px;background:#f1c40f;margin-right:6px;"></span>Ongoing</div>
      <div style="margin-bottom: 5px;"><span style="display:inline-block;width:14px;height:14px;background:#e74c3c;margin-right:6px;"></span>ToDo/Pending</div>
      <div><span style="display:inline-block;width:14px;height:14px;background:#cccccc;margin-right:6px;"></span>No data</div>
    `;
    return div;
  };
  legend.addTo(map);
  
  // Auto-refresh every 5 minutes (optional)
  setInterval(async () => {
    console.log("Refreshing Sheet data...");
    const newStatusMap = await loadSheetData();
    layer.clearLayers();
    layer.addData(geojson);
  }, 5 * 60 * 1000);
}

// Initialize when page loads
initMap().catch(err => {
  console.error("Map init error:", err);
  document.body.innerHTML += "<p style='color:red;'>Error loading map. Check console.</p>";
});
