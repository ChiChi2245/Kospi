const stocksOriginal = window.KOSPI_STOCKS || [];
let stocks = [...stocksOriginal];
let currentQuery = "";

const heatmap = document.getElementById("heatmap");
const tooltip = document.getElementById("tooltip");
const searchInput = document.getElementById("searchInput");
const dataStatus = document.getElementById("dataStatus");

const sectorOrder = [
  "TECHNOLOGY",
  "COMMUNICATION SERVICES",
  "CONSUMER CYCLICAL",
  "CONSUMER DEFENSIVE",
  "BATTERY & MATERIALS",
  "BASIC MATERIALS",
  "INDUSTRIALS",
  "FINANCIAL",
  "HEALTHCARE",
  "ENERGY",
  "UTILITIES",
  "HOLDING COMPANIES",
  "REAL ESTATE",
  "OTHER",
];

function formatKRW(value){ return Number(value || 0).toLocaleString("ko-KR"); }
function formatCap(value){ const jo = Number(value || 0) / 1000000000000; return jo >= 1 ? `${jo.toFixed(1)}조` : `${Math.round(value / 100000000).toLocaleString("ko-KR")}억`; }
function getColor(change){
  const abs = Math.min(Math.abs(Number(change || 0)), 8);
  const i = abs / 8;
  if(change > 0){ return `rgb(${Math.round(41-i*20)}, ${Math.round(78+i*150)}, ${Math.round(70+i*15)})`; }
  if(change < 0){ return `rgb(${Math.round(93+i*150)}, ${Math.round(56-i*22)}, ${Math.round(65-i*18)})`; }
  return "rgb(58,68,79)";
}

function buildGroups(items){
  const sectorMap = new Map();
  for(const stock of items){
    if(!sectorMap.has(stock.sector)) sectorMap.set(stock.sector, new Map());
    const industryMap = sectorMap.get(stock.sector);
    if(!industryMap.has(stock.industry)) industryMap.set(stock.industry, []);
    industryMap.get(stock.industry).push(stock);
  }
  return sectorOrder.filter(s => sectorMap.has(s)).map(sector => {
    const industries = Array.from(sectorMap.get(sector).entries()).map(([industry, list]) => ({
      name: industry,
      value: list.reduce((a,b)=>a+b.marketCap,0),
      stocks: list.sort((a,b)=>b.marketCap-a.marketCap)
    })).sort((a,b)=>b.value-a.value);
    return { name: sector, value: industries.reduce((a,b)=>a+b.value,0), industries };
  }).sort((a,b)=>b.value-a.value);
}

function splitRects(items, rect, getValue){
  const total = items.reduce((sum,item)=>sum+getValue(item),0) || 1;
  let cursor = 0;
  const horizontal = rect.w >= rect.h;
  return items.map(item => {
    const share = getValue(item) / total;
    if(horizontal){
      const w = item === items[items.length-1] ? rect.w - cursor : Math.round(rect.w * share);
      const out = { x: rect.x + cursor, y: rect.y, w, h: rect.h };
      cursor += w;
      return out;
    } else {
      const h = item === items[items.length-1] ? rect.h - cursor : Math.round(rect.h * share);
      const out = { x: rect.x, y: rect.y + cursor, w: rect.w, h };
      cursor += h;
      return out;
    }
  });
}

function renderIndices(){
  const strip = document.getElementById("indexStrip");
  strip.innerHTML = "";
  for(const item of window.MARKET_INDICES || []){
    const card = document.createElement("div");
    card.className = "index-card";
    const color = item.direction === "up" ? "#ff5c70" : "#4c9bff";
    const svg = sparkline(item.points, color);
    card.innerHTML = `${svg}<div><div class="index-title">${item.name}</div><div class="index-row"><span class="index-value">${item.value}</span><span class="index-change ${item.direction === "up" ? "up" : "down"}">${item.changeText}</span></div></div>`;
    strip.appendChild(card);
  }
}

function sparkline(points, color){
  const w=92,h=46,max=Math.max(...points),min=Math.min(...points),range=Math.max(1,max-min);
  const d=points.map((p,i)=>`${i===0?'M':'L'}${((i/(points.length-1))*w).toFixed(1)},${(h-((p-min)/range)*h).toFixed(1)}`).join(' ');
  return `<svg width="92" height="46" viewBox="0 0 92 46"><path d="M 0 36 H 92" stroke="rgba(255,255,255,.25)" stroke-width="1" stroke-dasharray="4 5" fill="none"/><path d="${d}" stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function renderSummary(items){
  const up = items.filter(s=>s.change>0).length;
  const down = items.filter(s=>s.change<0).length;
  const flat = items.filter(s=>s.change===0).length;
  const avg = items.reduce((a,b)=>a+b.change,0)/items.length;
  const totalCap = items.reduce((a,b)=>a+b.marketCap,0);
  document.getElementById("summary").innerHTML = `
    <div class="summary-card"><small>상승</small><strong class="up">${up}</strong></div>
    <div class="summary-card"><small>하락</small><strong class="down">${down}</strong></div>
    <div class="summary-card"><small>보합</small><strong>${flat}</strong></div>
    <div class="summary-card"><small>평균 등락률</small><strong class="${avg>=0?'up':'down'}">${avg>0?'+':''}${avg.toFixed(2)}%</strong></div>
    <div class="summary-card"><small>총 시가총액</small><strong>${formatCap(totalCap)}</strong></div>`;
  document.getElementById("topFive").textContent = "Top 5: " + items.slice(0,5).map(s=>`${s.name} ${formatCap(s.marketCap)}`).join(" · ");
}

function renderHeatmap(){
  const query = currentQuery.trim().toLowerCase();
  const filtered = query ? stocks.filter(s => s.name.toLowerCase().includes(query) || s.code.toLowerCase().includes(query)) : stocks;
  renderSummary(stocks);
  heatmap.innerHTML = "";
  const width = heatmap.clientWidth;
  const height = heatmap.clientHeight;
  const sectors = buildGroups(filtered.length ? filtered : stocks);
  const sectorRects = splitRects(sectors, {x:0,y:0,w:width,h:height}, s=>s.value);

  sectors.forEach((sector, si) => {
    const r = sectorRects[si];
    const sectorEl = document.createElement("div");
    sectorEl.className = "sector";
    setRect(sectorEl, r);
    sectorEl.innerHTML = `<div class="sector-title">${sector.name}</div>`;
    heatmap.appendChild(sectorEl);

    const inner = {x:2, y:20, w:Math.max(0,r.w-4), h:Math.max(0,r.h-22)};
    const industryRects = splitRects(sector.industries, inner, i=>i.value);
    sector.industries.forEach((industry, ii) => {
      const ir = industryRects[ii];
      if(ir.w < 8 || ir.h < 8) return;
      const indEl = document.createElement("div");
      indEl.className = "industry";
      setRect(indEl, ir);
      if(ir.w > 50 && ir.h > 25) indEl.innerHTML = `<div class="industry-title">${industry.name}</div>`;
      sectorEl.appendChild(indEl);

      const stockArea = {x:1, y: ir.h > 25 ? 14 : 1, w:Math.max(0,ir.w-2), h:Math.max(0,ir.h-(ir.h>25?15:2))};
      layoutStocks(industry.stocks, stockArea, indEl, query);
    });
  });
}

function layoutStocks(list, rect, parent, query){
  const rows = Math.max(1, Math.round(Math.sqrt(list.length * rect.h / Math.max(rect.w,1))));
  const total = list.reduce((a,b)=>a+b.marketCap,0) || 1;
  let cursorY = rect.y;
  let start = 0;
  for(let row=0; row<rows && start<list.length; row++){
    const remainRows = rows - row;
    const remainValue = list.slice(start).reduce((a,b)=>a+b.marketCap,0);
    const target = remainValue / remainRows;
    let rowItems=[], value=0;
    while(start < list.length && (value < target || rowItems.length===0)){
      rowItems.push(list[start]); value += list[start].marketCap; start++;
    }
    const rowH = row === rows-1 ? rect.y + rect.h - cursorY : Math.max(12, Math.round(rect.h * (value / total)));
    let cursorX = rect.x;
    rowItems.forEach((stock, idx)=>{
      const w = idx === rowItems.length-1 ? rect.x + rect.w - cursorX : Math.max(8, Math.round(rect.w * (stock.marketCap / value)));
      createTile(stock, {x:cursorX,y:cursorY,w,h:rowH}, parent, query);
      cursorX += w;
    });
    cursorY += rowH;
  }
}

function createTile(stock, r, parent, query){
  if(r.w <= 3 || r.h <= 3) return;
  const tile = document.createElement("div");
  tile.className = "tile";
  const matched = query && (stock.name.toLowerCase().includes(query) || stock.code.toLowerCase().includes(query));
  if(query && !matched) tile.classList.add("muted");
  tile.style.background = getColor(stock.change);
  setRect(tile, r);
  const area = r.w * r.h;
  if(area > 700){
    const nameSize = area > 24000 ? 34 : area > 12000 ? 25 : area > 5200 ? 18 : area > 2200 ? 12 : 9;
    const label = area > 7600 ? stock.name : stock.name.slice(0,5);
    tile.innerHTML = `<div class="tile-name" style="font-size:${nameSize}px">${label}</div>${area>1800 ? `<div class="tile-change" style="font-size:${Math.max(9,Math.round(nameSize*.55))}px">${stock.change>0?'+':''}${stock.change.toFixed(2)}%</div>` : ''}`;
  }
  tile.addEventListener("mousemove", e => showTooltip(e, stock));
  tile.addEventListener("mouseleave", hideTooltip);
  parent.appendChild(tile);
}

function setRect(el, r){
  el.style.left = `${r.x}px`; el.style.top = `${r.y}px`; el.style.width = `${Math.max(0,r.w)}px`; el.style.height = `${Math.max(0,r.h)}px`;
}

function showTooltip(e, stock){
  tooltip.classList.remove("hidden");
  tooltip.innerHTML = `<div class="tooltip-title">${stock.name}</div><div class="tooltip-sub">${stock.code} · ${stock.sector}</div><div class="tooltip-grid"><div class="tooltip-box"><small>현재가</small><strong>${formatKRW(stock.price)}원</strong></div><div class="tooltip-box"><small>등락률</small><strong class="${stock.change>=0?'up':'down'}">${stock.change>0?'+':''}${stock.change.toFixed(2)}%</strong></div></div><div class="tooltip-cap"><small>시가총액</small><br><strong>${formatCap(stock.marketCap)}</strong></div>`;
  const x = Math.min(window.innerWidth - 255, e.clientX + 14);
  const y = Math.min(window.innerHeight - 190, e.clientY + 14);
  tooltip.style.left = `${x}px`; tooltip.style.top = `${y}px`;
}
function hideTooltip(){ tooltip.classList.add("hidden"); }

async function testKisApi(){
  const codes = stocks.slice(0,20).map(s=>s.code).join(',');
  dataStatus.textContent = "한투 API 테스트 중...";
  try{
    const res = await fetch(`/api/kis/quotes?codes=${codes}`);
    if(!res.ok) throw new Error('backend not ready');
    const quotes = await res.json();
    const map = new Map(quotes.map(q=>[q.code,q]));
    stocks = stocks.map(s => map.has(s.code) ? {...s, price:Number(map.get(s.code).price ?? s.price), change:Number(map.get(s.code).changeRate ?? s.change)} : s);
    dataStatus.textContent = `한투 API 반영 완료 · ${quotes.length}개 종목`;
    renderHeatmap();
  }catch(err){
    dataStatus.textContent = "백엔드 연결 전이라 CSV 데이터만 표시 중";
  }
}

searchInput.addEventListener("input", e => { currentQuery = e.target.value; renderHeatmap(); });
document.getElementById("resetBtn").addEventListener("click", () => { currentQuery=""; searchInput.value=""; renderHeatmap(); });
document.getElementById("kisBtn").addEventListener("click", testKisApi);
window.addEventListener("resize", () => renderHeatmap());

renderIndices();
renderHeatmap();
