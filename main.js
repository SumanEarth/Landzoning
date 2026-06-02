// ================================================================
//  Bangladesh Land Zoning Dashboard v3 — SumanEarth
//  FIX 1: toggleLayer uses explicit checked (no blind toggle)
//  FIX 2: Tab click auto-switches the matching map layer
//  FIX 3: Mobile sheet has ▼ minimize; state NEVER resets
// ================================================================
const SHEET_ID  = "1xRA1Padw-hKv-ZprqqWH6KCtCE-PvtJtZeWfwfeihYw";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/"+SHEET_ID+"/gviz/tq?tqx=out:json&sheet=upazilas";
const COL_DIVISION=2,COL_DISTRICT=3,COL_UPAZILA=4,COL_REPORT=5,COL_REVISION=6,COL_WORKSHOP=7,COL_COMMENT=8,COL_UPCODE=9;
const GEO_UPCODE="adm3_pcode",GEO_UPAZILA="adm3_name",GEO_DISTRICT="adm2_name",GEO_DIVISION="adm1_name";

// ── LAYER STATE — source of truth, never reset ─────────────────
const layerVis={report:true,revision:false,workshop:false,district:true};
const layerOpa={report:0.82,revision:0.78,workshop:0.78,district:0.9};

// ── APP STATE ──────────────────────────────────────────────────
window._map=null;
window.gLayers={report:null,revision:null,workshop:null,district:null};
window.legendDiv=null;
let upazilaIndex=[];
let allData={report:{done:[],ongoing:[],todo:[]},revision:{done:[],ongoing:[],todo:[]},workshop:{done:[],ongoing:[],todo:[]}};
let allStats={report:{done:0,ongoing:0,todo:0,total:0},revision:{done:0,ongoing:0,todo:0,total:0},workshop:{done:0,ongoing:0,todo:0,total:0}};
let activeLegendTab="report";
let mobileLegendOpen=false;

function norm(s){return(s||"").toString().trim().toLowerCase();}

function statusColor(v,type){
  var s=norm(v);
  if(!s||s==="none"||s==="-"||s==="n/a") return "#dfe6e9";
  if(s.includes("done")||s.includes("complete"))
    return type==="revision"?"#2980b9":type==="workshop"?"#8e44ad":"#27ae60";
  if(s.includes("ongoing")||s.includes("progress")) return "#f39c12";
  if(s.includes("todo")||s.includes("pending")||s.includes("to do")) return "#95a5a6";
  return "#dfe6e9";
}

function badge(v,type){
  if(!v||norm(v)==="none"||norm(v)==="-") return '<span style="color:#bbb;font-size:11px;">— None</span>';
  var s=norm(v),c=statusColor(v,type);
  var ico=(s.includes("done")||s.includes("complete"))?"✅":(s.includes("ongoing")||s.includes("progress"))?"⏳":"🔲";
  return '<span style="color:'+c+';font-weight:700;">'+ico+' '+v+'</span>';
}

// ── FIX 1: explicit checked, never blind toggle ─────────────────
window.toggleLayer=function(name,checked){
  layerVis[name]=!!checked;
  document.querySelectorAll('[data-layer="'+name+'"]').forEach(function(cb){cb.checked=!!checked;});
  var layer=window.gLayers[name];
  if(!layer||!window._map) return;
  if(checked){
    layer.addTo(window._map);
    if(name!=="district"&&layerVis.district&&window.gLayers.district)
      window.gLayers.district.bringToFront();
  } else {
    window._map.removeLayer(layer);
  }
};

window.setLayerOpacity=function(name,val){
  layerOpa[name]=parseFloat(val);
  var pct=Math.round(val*100)+"%";
  document.querySelectorAll('[data-opval="'+name+'"]').forEach(function(el){el.textContent=pct;});
  document.querySelectorAll('[data-opslider="'+name+'"]').forEach(function(el){el.value=val;});
  var layer=window.gLayers[name];
  if(!layer) return;
  layer.setStyle(name==="district"?{opacity:parseFloat(val)}:{fillOpacity:parseFloat(val)});
};

// ── FIX 2: Tab click auto-enables that layer, hides others ──────
window.switchLegendTab=function(tab,prefix){
  activeLegendTab=tab;
  ["report","revision","workshop"].forEach(function(t){
    var on=(t===tab);
    if(layerVis[t]!==on){
      layerVis[t]=on;
      var layer=window.gLayers[t];
      if(layer&&window._map){
        if(on) layer.addTo(window._map);
        else window._map.removeLayer(layer);
      }
    }
  });
  if(layerVis.district&&window.gLayers.district) window.gLayers.district.bringToFront();
  if(prefix==="m") renderMobileLegend();
  else if(window.legendDiv) window.legendDiv.innerHTML=buildLegendBody("d");
};

// ── FIX 3: separate minimize (▼) from close — no re-render ─────
window.minimizeMobileLegend=function(){
  mobileLegendOpen=false;
  document.getElementById("mobileLegendSheet").style.transform="translateY(105%)";
  document.getElementById("mobileLegendToggle").innerHTML="📊";
};

window.toggleMobileLegend=function(){
  if(mobileLegendOpen){minimizeMobileLegend();return;}
  mobileLegendOpen=true;
  document.getElementById("mobileLegendSheet").style.transform="translateY(0)";
  document.getElementById("mobileLegendToggle").innerHTML="▼";
  renderMobileLegend();
};

function renderMobileLegend(){
  var mc=document.getElementById("mobileLegendContent");
  if(mc) mc.innerHTML=buildLegendBody("m");
}

// ── LEGEND HTML ────────────────────────────────────────────────
function buildLegendBody(prefix){
  var tab=activeLegendTab;
  var stats=allStats[tab]||{done:0,ongoing:0,todo:0,total:0};
  var typeColor=tab==="revision"?"#2980b9":tab==="workshop"?"#8e44ad":"#27ae60";
  var typeLabel=tab==="revision"?"🔄 Revision":tab==="workshop"?"🏛 Workshop":"📋 Zoning Report";
  var pct=(stats.done/495*100).toFixed(1);

  var layerDefs=[
    {key:"report",  label:"📋 Zoning Report",color:"#27ae60"},
    {key:"revision",label:"🔄 Revision",      color:"#2980b9"},
    {key:"workshop",label:"🏛 Workshop",       color:"#8e44ad"},
    {key:"district",label:"⬛ Districts",      color:"#2c3e50"}
  ];

  var layerRows=layerDefs.map(function(l){
    return '<div style="margin-bottom:7px;">'
      +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:2px;">'
      +'<input type="checkbox" data-layer="'+l.key+'" '+(layerVis[l.key]?"checked":"")
      +' onchange="toggleLayer(\''+l.key+'\',this.checked)"'
      +' style="width:16px;height:16px;cursor:pointer;accent-color:'+l.color+';flex-shrink:0;" />'
      +'<span style="width:13px;height:13px;background:'+l.color+';border-radius:3px;display:inline-block;flex-shrink:0;"></span>'
      +'<span style="flex:1;font-size:12px;font-weight:600;color:#2c3e50;">'+l.label+'</span>'
      +'<span data-opval="'+l.key+'" style="font-size:10px;color:#aaa;min-width:28px;text-align:right;">'+Math.round(layerOpa[l.key]*100)+'%</span>'
      +'</div>'
      +'<div style="padding-left:23px;">'
      +'<input type="range" min="0" max="1" step="0.05" value="'+layerOpa[l.key]+'" data-opslider="'+l.key+'"'
      +' oninput="setLayerOpacity(\''+l.key+'\',this.value)"'
      +' style="width:100%;height:3px;accent-color:'+l.color+';cursor:pointer;" />'
      +'</div></div>';
  }).join("");

  var tabBtns=["report","revision","workshop"].map(function(t){
    var active=t===tab;
    var tc=t==="revision"?"#2980b9":t==="workshop"?"#8e44ad":"#27ae60";
    var lbl=t==="revision"?"🔄":t==="workshop"?"🏛":"📋";
    var tlabel=t.charAt(0).toUpperCase()+t.slice(1);
    return '<button onclick="switchLegendTab(\''+t+'\',\''+prefix+'\')"'
      +' style="flex:1;border:2px solid '+(active?tc:"#e0e0e0")+';border-radius:7px;'
      +'background:'+(active?tc:"white")+';color:'+(active?"white":"#999")+';'
      +'font-size:10.5px;font-weight:700;padding:6px 2px;cursor:pointer;transition:all .15s;"'
      +' title="Show '+tlabel+' layer">'+lbl+' '+tlabel+'</button>';
  }).join("");

  var donePct=(stats.done/495*100).toFixed(2);
  var ongoPct=(stats.ongoing/495*100).toFixed(2);

  return '<div style="display:flex;gap:4px;margin-bottom:8px;">'+tabBtns+'</div>'
    +'<div style="font-size:9px;color:#bbb;text-align:center;margin:-4px 0 8px;font-style:italic;">↑ Tap tab to switch map view</div>'

    +'<div style="text-align:center;padding-bottom:10px;border-bottom:2px solid #ecf0f1;margin-bottom:10px;">'
    +'<div style="font-size:10px;font-weight:700;color:#7f8c8d;letter-spacing:.5px;text-transform:uppercase;margin-bottom:2px;">'+typeLabel+' Progress</div>'
    +'<div style="font-size:28px;font-weight:900;color:'+typeColor+';line-height:1.1;">'+pct+'%</div>'
    +'<div style="font-size:10px;color:#aaa;margin-bottom:6px;">'+stats.total+' / 495 UZ</div>'
    +'<div style="height:7px;background:#ecf0f1;border-radius:4px;overflow:hidden;display:flex;">'
    +'<div style="width:'+donePct+'%;background:'+typeColor+';transition:width .5s;"></div>'
    +'<div style="width:'+ongoPct+'%;background:#f39c12;transition:width .5s;"></div>'
    +'</div></div>'

    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:10px;">'
    +'<div onclick="showStatusTable(\''+tab+'\',\'done\')" style="cursor:pointer;text-align:center;background:#eafaf1;border:1px solid #a9dfbf;border-radius:7px;padding:6px 2px;transition:transform .12s;" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'">'
    +'<div style="font-size:18px;font-weight:900;color:#27ae60;">'+stats.done+'</div>'
    +'<div style="font-size:9px;color:#555;font-weight:600;">Done ↗</div></div>'
    +'<div onclick="showStatusTable(\''+tab+'\',\'ongoing\')" style="cursor:pointer;text-align:center;background:#fef9e7;border:1px solid #f9ca7a;border-radius:7px;padding:6px 2px;transition:transform .12s;" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'">'
    +'<div style="font-size:18px;font-weight:900;color:#f39c12;">'+stats.ongoing+'</div>'
    +'<div style="font-size:9px;color:#555;font-weight:600;">Ongoing ↗</div></div>'
    +'<div onclick="showStatusTable(\''+tab+'\',\'todo\')" style="cursor:pointer;text-align:center;background:#f8f9fa;border:1px solid #ccc;border-radius:7px;padding:6px 2px;transition:transform .12s;" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'">'
    +'<div style="font-size:18px;font-weight:900;color:#95a5a6;">'+stats.todo+'</div>'
    +'<div style="font-size:9px;color:#555;font-weight:600;">ToDo ↗</div></div>'
    +'</div>'

    +'<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:12px;">'
    +'<button onclick="showStatusTable(\''+tab+'\',\'done\')" style="background:linear-gradient(135deg,#27ae60,#2ecc71);color:white;border:none;padding:8px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;box-shadow:0 2px 8px rgba(39,174,96,.3);">📋 View Done ('+stats.done+')</button>'
    +'<button onclick="showStatusTable(\''+tab+'\',\'ongoing\')" style="background:linear-gradient(135deg,#e67e22,#f39c12);color:white;border:none;padding:8px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;box-shadow:0 2px 8px rgba(243,156,18,.3);">📋 View Ongoing ('+stats.ongoing+')</button>'
    +'<button onclick="showStatusTable(\''+tab+'\',\'todo\')" style="background:linear-gradient(135deg,#7f8c8d,#95a5a6);color:white;border:none;padding:8px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;box-shadow:0 2px 8px rgba(149,165,166,.3);">📋 View ToDo ('+stats.todo+')</button>'
    +'</div>'

    +'<div style="border-top:2px solid #ecf0f1;padding-top:10px;">'
    +'<div style="font-size:10px;font-weight:700;color:#95a5a6;letter-spacing:.8px;text-transform:uppercase;margin-bottom:5px;">🗂 Layer Controls</div>'
    +'<div style="font-size:9px;color:#bbb;margin-bottom:8px;font-style:italic;">✅ Check/uncheck → tap ▼ FAB to see map</div>'
    +layerRows
    +'</div>'

    +'<div style="border-top:1px solid #ecf0f1;margin-top:8px;padding-top:8px;text-align:center;">'
    +'<a href="./update.html" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#3498db,#2980b9);color:white;text-decoration:none;padding:8px 18px;border-radius:8px;font-size:11px;font-weight:700;box-shadow:0 2px 8px rgba(52,152,219,.35);">📝 Update Status (PWA)</a>'
    +'</div>'
    +'<div style="font-size:10px;color:#bbb;text-align:right;padding-top:6px;">🔄 '+new Date().toLocaleTimeString()+'</div>';
}

function updateLegendDisplays(){
  if(window.legendDiv) window.legendDiv.innerHTML=buildLegendBody("d");
  if(mobileLegendOpen) renderMobileLegend();
}

// ── SHEET LOADER ───────────────────────────────────────────────
async function loadSheetData(){
  try{
    var res=await fetch(SHEET_URL);
    var text=await res.text();
    var json=JSON.parse(text.substring(text.indexOf("{"),text.lastIndexOf("}")+1));
    var rows=json.table.rows||[];
    var sm=new Map();
    ["report","revision","workshop"].forEach(function(t){
      allData[t]={done:[],ongoing:[],todo:[]};
      allStats[t]={done:0,ongoing:0,todo:0,total:0};
    });
    rows.forEach(function(row){
      var upcode=(row.c[COL_UPCODE]||{}).v;
      var upazila=(row.c[COL_UPAZILA]||{}).v;
      var district=(row.c[COL_DISTRICT]||{}).v;
      var division=(row.c[COL_DIVISION]||{}).v;
      var report=((row.c[COL_REPORT]||{}).v||"").toString();
      var revision=((row.c[COL_REVISION]||{}).v||"").toString();
      var workshop=((row.c[COL_WORKSHOP]||{}).v||"").toString();
      var comment=((row.c[COL_COMMENT]||{}).v||"").toString();
      if(!upcode||!upazila) return;
      var entry={upcode:upcode,upazila:upazila,district:district,division:division,
        report:report,revision:revision,workshop:workshop,comment:comment};
      sm.set(String(upcode),entry);
      function classify(val,type){
        var s=norm(val);
        allStats[type].total++;
        if(s.includes("done")||s.includes("complete")){allStats[type].done++;allData[type].done.push(entry);}
        else if(s.includes("ongoing")||s.includes("progress")){allStats[type].ongoing++;allData[type].ongoing.push(entry);}
        else if(s.includes("todo")||s.includes("pending")||s.includes("to do")){allStats[type].todo++;allData[type].todo.push(entry);}
      }
      classify(report,"report");classify(revision,"revision");classify(workshop,"workshop");
    });
    updateLegendDisplays();
    console.log("Sheet loaded:",sm.size);
    return sm;
  }catch(err){
    console.error("Sheet error:",err);
    updateLegendDisplays();
    return new Map();
  }
}

// ── TABLE MODAL ────────────────────────────────────────────────
window.toggleTable=function(){
  var el=document.getElementById("dataTableContainer");
  el.style.display=el.style.display==="none"?"block":"none";
};

var _currentTableList=[];
window.showStatusTable=function(statusType,bucket){
  var list=(allData[statusType]||{})[bucket]||[];
  _currentTableList=list;
  var typeLabel=statusType==="revision"?"Revision":statusType==="workshop"?"Workshop":"Zoning Report";
  var bucketLabel=bucket==="done"?"✅ Done":bucket==="ongoing"?"⏳ Ongoing":"🔲 ToDo";
  var typeColor=statusType==="revision"?"#2980b9":statusType==="workshop"?"#8e44ad":"#27ae60";
  var bgRow=bucket==="done"?"#eafaf1":bucket==="ongoing"?"#fef9e7":"#f8f9fa";
  document.getElementById("tableTitle").innerHTML=bucketLabel
    +' <span style="color:'+typeColor+'">'+typeLabel+'</span>'
    +' <span style="font-size:12px;font-weight:400;color:#aaa;">('+list.length+' upazilas)</span>';
  var divs=[...new Set(list.map(function(i){return i.division;}).filter(Boolean))].sort();
  var dists=[...new Set(list.map(function(i){return i.district;}).filter(Boolean))].sort();
  var rows=list.map(function(item,idx){
    return '<tr data-division="'+(item.division||"")+'" data-district="'+(item.district||"")+'" style="background:'+(idx%2===0?bgRow:"white")+'">'
      +'<td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;">'+(item.division||"")+'</td>'
      +'<td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;">'+(item.district||"")+'</td>'
      +'<td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;font-weight:600;">'+(item.upazila||"")+'</td>'
      +'<td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;">'+badge(item.report,"report")+'</td>'
      +'<td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;">'+badge(item.revision,"revision")+'</td>'
      +'<td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;">'+badge(item.workshop,"workshop")+'</td>'
      +'<td style="padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#555;max-width:160px;">'+(item.comment||"")+'</td>'
      +'</tr>';
  }).join("");
  var dropStyle='padding:7px 12px;border:2px solid #ddd;border-radius:7px;font-size:13px;cursor:pointer;';
  document.getElementById("statusTable").innerHTML=
    '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">'
    +'<label style="font-weight:700;color:#2c3e50;font-size:13px;">Filter:</label>'
    +'<select id="divisionFilter" onchange="filterTable()" style="'+dropStyle+'">'
    +'<option value="">All Divisions ('+divs.length+')</option>'
    +divs.map(function(d){return'<option value="'+d+'">'+d+'</option>';}).join("")
    +'</select>'
    +'<select id="districtFilter" onchange="filterTable()" style="'+dropStyle+'">'
    +'<option value="">All Districts ('+dists.length+')</option>'
    +dists.map(function(d){return'<option value="'+d+'">'+d+'</option>';}).join("")
    +'</select>'
    +'<span id="filterCount" style="color:#888;font-size:12px;font-weight:600;">All '+list.length+'</span>'
    +'</div>'
    +'<div style="overflow:auto;max-height:60vh;border-radius:8px;border:1px solid #eee;">'
    +'<table style="width:100%;border-collapse:collapse;font-size:12px;min-width:700px;">'
    +'<thead><tr style="background:#2c3e50;color:white;position:sticky;top:0;z-index:1;">'
    +'<th style="padding:10px;text-align:left;">Division</th>'
    +'<th style="padding:10px;text-align:left;">District</th>'
    +'<th style="padding:10px;text-align:left;">Upazila</th>'
    +'<th style="padding:10px;text-align:left;">📋 Report</th>'
    +'<th style="padding:10px;text-align:left;">🔄 Revision</th>'
    +'<th style="padding:10px;text-align:left;">🏛 Workshop</th>'
    +'<th style="padding:10px;text-align:left;">💬 Comment</th>'
    +'</tr></thead>'
    +'<tbody id="tableBody">'+rows+'</tbody></table></div>';
  window.toggleTable();
};

window.filterTable=function(){
  var divF=norm((document.getElementById("divisionFilter")||{}).value||"");
  var distF=norm((document.getElementById("districtFilter")||{}).value||"");
  var count=0;
  document.querySelectorAll("#tableBody tr").forEach(function(row){
    var rd=norm(row.getAttribute("data-division")||"");
    var rt=norm(row.getAttribute("data-district")||"");
    var show=(!divF||rd.includes(divF))&&(!distF||rt.includes(distF));
    row.style.display=show?"":"none";
    if(show) count++;
  });
  var el=document.getElementById("filterCount");
  if(el) el.textContent="Showing "+count;
  var sel=document.getElementById("districtFilter");
  if(sel){
    var curDist=norm(sel.value);
    var dists=[...new Set(_currentTableList.filter(function(i){return !divF||norm(i.division).includes(divF);}).map(function(i){return i.district;}).filter(Boolean))].sort();
    sel.innerHTML='<option value="">All Districts ('+dists.length+')</option>'
      +dists.map(function(d){return'<option value="'+d+'" '+(norm(d)===curDist?"selected":"")+'>'+d+'</option>';}).join("");
  }
};

// ── MOBILE SEARCH ──────────────────────────────────────────────
window.toggleMobileSearch=function(){
  var panel=document.getElementById("mobileSearchPanel");
  var isOpen=panel.style.display==="block";
  panel.style.display=isOpen?"none":"block";
  if(!isOpen) setTimeout(function(){var i=document.getElementById("mobileSearchInput");if(i)i.focus();},80);
};

function initMobileSearch(){
  var input=document.getElementById("mobileSearchInput");
  var results=document.getElementById("mobileSearchResults");
  if(!input) return;
  input.addEventListener("input",function(e){
    var term=e.target.value.trim().toLowerCase();
    results.innerHTML="";
    if(term.length<2) return;
    upazilaIndex.filter(function(u){return u.name.toLowerCase().includes(term);}).slice(0,10).forEach(function(u){
      var div=document.createElement("div");
      div.innerHTML='<strong>'+u.name+'</strong><span style="color:#aaa;font-size:11px;margin-left:6px;">'+u.district+', '+u.division+'</span>';
      div.onclick=function(){
        u.mapRef.fitBounds(u.bounds,{padding:[50,50],maxZoom:12});
        input.value=u.name;results.innerHTML="";
        document.getElementById("mobileSearchPanel").style.display="none";
      };
      results.appendChild(div);
    });
  });
}

// ── POPUP ──────────────────────────────────────────────────────
function buildPopup(props,rec){
  var name=props[GEO_UPAZILA]||"—";
  var district=props[GEO_DISTRICT]||(rec&&rec.district)||"—";
  var division=props[GEO_DIVISION]||(rec&&rec.division)||"—";
  var area=props.area_sqkm?props.area_sqkm.toFixed(1):"—";
  var report=(rec&&rec.report)||"No data";
  var revision=(rec&&rec.revision)||"None";
  var workshop=(rec&&rec.workshop)||"No data";
  var comment=((rec&&rec.comment)||"").toString().trim();
  var rColor=statusColor(report,"report");
  return '<div style="min-width:240px;max-width:290px;font-family:\'Segoe UI\',Arial,sans-serif;line-height:1.55;">'
    +'<h3 style="margin:0 0 10px;color:'+rColor+';font-size:16px;font-weight:800;border-bottom:3px solid '+rColor+';padding-bottom:8px;">'+name+'</h3>'
    +'<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:13px;margin-bottom:10px;">'
    +'<span style="color:#999;">District</span><strong style="color:#2c3e50;">'+district+'</strong>'
    +'<span style="color:#999;">Division</span><strong style="color:#2c3e50;">'+division+'</strong>'
    +'<span style="color:#999;">Area</span><span style="color:#555;">'+area+' km²</span>'
    +'</div>'
    +'<div style="background:#f8fafc;border-radius:9px;padding:9px 11px;border:1px solid #e8ecef;">'
    +'<div style="font-size:9px;font-weight:700;color:#95a5a6;letter-spacing:.6px;text-transform:uppercase;margin-bottom:7px;">Status Summary</div>'
    +'<div style="display:grid;grid-template-columns:auto 1fr;gap:5px 10px;font-size:12px;">'
    +'<span style="color:#888;white-space:nowrap;">📋 Zoning Report</span>'+badge(report,"report")
    +'<span style="color:#888;white-space:nowrap;">🔄 Revision</span>'+badge(revision,"revision")
    +'<span style="color:#888;white-space:nowrap;">🏛 Workshop</span>'+badge(workshop,"workshop")
    +'</div></div>'
    +(comment?'<div style="background:#fffbf0;border-radius:9px;padding:9px 11px;border:1px solid #fce5a0;margin-top:8px;">'
      +'<div style="font-size:9px;font-weight:700;color:#e67e22;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">💬 Comment</div>'
      +'<div style="font-size:12px;color:#34495e;">'+comment+'</div></div>':"")
    +'</div>';
}

// ── MAP INIT ───────────────────────────────────────────────────
async function initMap(){
  var map=L.map("map",{zoomControl:true}).setView([23.7,90.4],7);
  window._map=map;
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
    maxZoom:18,attribution:'© <a href="https://openstreetmap.org">OpenStreetMap</a> | Land Zoning Dashboard'
  }).addTo(map);

  var legendCtrl=L.control({position:"bottomright"});
  legendCtrl.onAdd=function(){
    var div=L.DomUtil.create("div","info legend");
    div.style.cssText="background:white;padding:16px 16px 12px;border-radius:14px;box-shadow:0 6px 28px rgba(0,0,0,.22);width:232px;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;max-height:92vh;overflow-y:auto;";
    div.innerHTML='<div style="text-align:center;padding:20px 0;color:#aaa;">Loading…</div>';
    window.legendDiv=div;
    L.DomEvent.disableScrollPropagation(div);
    L.DomEvent.disableClickPropagation(div);
    return div;
  };
  legendCtrl.addTo(map);

  var statusMap=await loadSheetData();

  var searchCtrl=L.control({position:"topleft"});
  searchCtrl.onAdd=function(){
    var wrap=L.DomUtil.create("div");
    wrap.innerHTML='<div style="background:white;padding:7px 12px;border-radius:10px;box-shadow:0 2px 14px rgba(0,0,0,.22);border:2px solid rgba(0,0,0,.12);display:flex;align-items:center;gap:7px;min-width:235px;">'
      +'<span style="font-size:15px;">🔍</span>'
      +'<input id="upazilaSearch" type="text" placeholder="Search upazila…" style="border:none;outline:none;flex:1;font-size:13px;background:transparent;color:#2c3e50;" />'
      +'<span id="srchClear" style="cursor:pointer;color:#bbb;font-size:16px;">✕</span>'
      +'</div>'
      +'<div id="searchDropdown" style="background:white;max-height:220px;overflow-y:auto;display:none;box-shadow:0 6px 18px rgba(0,0,0,.18);border-radius:0 0 10px 10px;border:2px solid rgba(0,0,0,.1);border-top:none;"></div>';
    L.DomEvent.disableClickPropagation(wrap);
    L.DomEvent.disableScrollPropagation(wrap);
    var input=wrap.querySelector("#upazilaSearch");
    var dropdown=wrap.querySelector("#searchDropdown");
    wrap.querySelector("#srchClear").onclick=function(){input.value="";dropdown.style.display="none";};
    input.addEventListener("input",function(e){
      var term=e.target.value.trim().toLowerCase();
      dropdown.innerHTML="";dropdown.style.display="none";
      if(term.length<2) return;
      var hits=upazilaIndex.filter(function(u){return u.name.toLowerCase().includes(term);}).slice(0,10);
      if(!hits.length){dropdown.innerHTML='<div style="padding:10px 14px;color:#999;font-size:12px;">No upazila found</div>';dropdown.style.display="block";return;}
      hits.forEach(function(u){
        var item=document.createElement("div");
        item.style.cssText="padding:9px 14px;cursor:pointer;border-bottom:1px solid #f5f5f5;font-size:13px;";
        item.innerHTML='<strong>'+u.name+'</strong><span style="color:#aaa;font-size:11px;margin-left:6px;">'+u.district+', '+u.division+'</span>';
        item.onmouseover=function(){item.style.background="#f0f8ff";};
        item.onmouseout=function(){item.style.background="white";};
        item.onclick=function(){map.fitBounds(u.bounds,{padding:[50,50],maxZoom:12});input.value=u.name;dropdown.style.display="none";};
        dropdown.appendChild(item);
      });
      dropdown.style.display="block";
    });
    document.addEventListener("click",function(e){if(!wrap.contains(e.target))dropdown.style.display="none";});
    return wrap;
  };
  searchCtrl.addTo(map);

  var geoRes=await fetch("./public/bdupazila.json");
  var geojson=await geoRes.json();

  upazilaIndex=geojson.features.map(function(f){
    return{name:f.properties[GEO_UPAZILA],district:f.properties[GEO_DISTRICT],
      division:f.properties[GEO_DIVISION],bounds:L.geoJSON(f).getBounds(),mapRef:map};
  }).filter(function(u){return u.name;});
  initMobileSearch();

  function makeLayer(fieldKey,type){
    return L.geoJSON(geojson,{
      style:function(f){
        var rec=statusMap.get(String(f.properties[GEO_UPCODE]));
        return{color:"#666",weight:0.6,fillColor:statusColor(rec&&rec[fieldKey],type),fillOpacity:layerOpa[type]};
      },
      onEachFeature:function(f,layer){
        var rec=statusMap.get(String(f.properties[GEO_UPCODE]));
        layer.bindPopup(buildPopup(f.properties,rec),{maxWidth:310,className:"zoning-popup"});
        layer.on("mouseover",function(){
          this.setStyle({weight:2.5,color:"#2c3e50",fillOpacity:Math.min(layerOpa[type]+0.15,1)});
          this.bringToFront();
        });
        layer.on("mouseout",function(){
          if(window.gLayers[type]) window.gLayers[type].resetStyle(this);
          if(layerVis.district&&window.gLayers.district) window.gLayers.district.bringToFront();
        });
      }
    });
  }

  window.gLayers.report  =makeLayer("report",  "report");
  window.gLayers.revision=makeLayer("revision","revision");
  window.gLayers.workshop=makeLayer("workshop","workshop");
  if(layerVis.report)   window.gLayers.report.addTo(map);
  if(layerVis.revision) window.gLayers.revision.addTo(map);
  if(layerVis.workshop) window.gLayers.workshop.addTo(map);

  try{
    var dRes=await fetch("./public/bd-districts.json");
    var dJson=await dRes.json();
    window.gLayers.district=L.geoJSON(dJson,{
      style:{color:"#1a252f",weight:2.2,opacity:layerOpa.district,fill:false,dashArray:"5,4"},
      onEachFeature:function(f,l){l.bindPopup('<strong style="font-size:14px;">'+f.properties.adm2_name+'</strong>');}
    });
    if(layerVis.district) window.gLayers.district.addTo(map).bringToFront();
  }catch(e){console.warn("District JSON not found");}

  map.fitBounds(window.gLayers.report.getBounds());
  var sheet=document.getElementById("mobileLegendSheet");
  if(sheet) sheet.style.transform="translateY(105%)";

  setInterval(async function(){
    var nm=await loadSheetData();
    ["report","revision","workshop"].forEach(function(type){
      var layer=window.gLayers[type];
      if(!layer) return;
      layer.setStyle(function(f){
        var rec=nm.get(String(f.properties[GEO_UPCODE]));
        return{color:"#666",weight:0.6,fillColor:statusColor(rec&&rec[type],type),fillOpacity:layerOpa[type]};
      });
      layer.eachLayer(function(l){
        var rec=nm.get(String(l.feature&&l.feature.properties[GEO_UPCODE]));
        if(l.getPopup()) l.setPopupContent(buildPopup(l.feature.properties,rec));
      });
    });
  },3*60*1000);
}

initMap().catch(function(err){
  console.error(err);
  document.body.innerHTML+='<p style="color:red;padding:24px;font-size:16px;">⚠️ '+err.message+'</p>';
});
