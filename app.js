const state = {
  stocks: [...window.KOSPI_STOCKS],
  query: "",
};

const indices = [
  { name: "달러 환율", value: "1,510.85", change: "+7.05 (0.46%)", dir: "up", points: [15, 76, 68, 22, 52, 48, 57, 63, 70] },
  { name: "코스피", value: "7,129.45", change: "-142.21 (1.95%)", dir: "down", points: [55, 18, 41, 25, 78, 88, 12, 20, 16, 30] },
  { name: "코스닥", value: "1,050.60", change: "-33.76 (3.11%)", dir: "down", points: [42, 36, 53, 58, 31, 28, 24, 33, 31] },
  { name: "나스닥", value: "25,870.71", change: "-220.02 (0.84%)", dir: "down", points: [70, 38, 24, 21, 30, 58, 74, 70, 63, 52, 44] },
];

const heatmap = document.getElementById("heatmap");
const tooltip = document.getElementById("tooltip");
const searchInput = document.getElementById("searchInput");
const kisButton = document.getElementById("kisButton");
const apiStatus = document.getElementById("apiStatus");

function formatKRW(value) {
  return Number(value).toLocaleString("ko-KR");
}

function formatMarketCap(value) {
  const jo = value / 1_0000_0000_0000;
  if (jo >= 1) return `${jo.toFixed(1)}조`;
  return `${Math.round(value / 100_000_000).toLocaleString("ko-KR")}억`;
}

function colorByChange(change) {
  const abs = Math.min(Math.abs(change), 8);
  const t = abs / 8;

  if (change > 0) {
    const r = Math.round(32 - t * 12);
    const g = Math.round(88 + t * 140);
    const b = Math.round(74 + t * 10);
    return `rgb(${r}, ${g}, ${b})`;
  }

  if (change < 0) {
    const r = Math.round(92 + t * 150);
    const g = Math.round(55 - t * 18);
    const b = Math.round(67 - t * 18);
    return `rgb(${r}, ${g}, ${b})`;
  }

  return "rgb(78, 88, 102)";
}

function makeSparkline(points, dir) {
  const width = 92;
  const height = 46;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = Math.max(1, max - min);
  const d = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p - min) / range) * height;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const color = dir === "up" ? "#ff4d64" : "#2f8cff";

  return `
    <svg class="sparkline" viewBox="0 0 ${width} ${height}">
      <path d="M 0 36 H 92" stroke="rgba(255,255,255,.25)" stroke-width="1" stroke-dasharray="4 5" fill="none"></path>
      <path d="${d}" stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
}

function renderIndices() {
  document.getElementById("indexStrip").innerHTML = indices.map(item => `
    <article class="index-card">
      ${makeSparkline(item.points, item.dir)}
      <div>
        <div class="index-title">${item.name}</div>
        <div class="index-value-row">
          <span class="index-value">${item.value}</span>
          <span class="index-change ${item.dir}">${item.change}</span>
        </div>
      </div>
    </article>
  `).join("");
}

function splitTreemap(items, rect, depth = 0) {
  if (!items.length) return [];
  if (items.length === 1) return [{ item: items[0], rect }];

  const total = items.reduce((sum, item) => sum + item.marketCap, 0);
  const half = total / 2;
  let sum = 0;
  let index = 0;

  for (; index < items.length - 1; index++) {
    if (sum + items[index].marketCap > half && index > 0) break;
    sum += items[index].marketCap;
  }

  const left = items.slice(0, index + 1);
  const right = items.slice(index + 1);
  const leftValue = left.reduce((s, item) => s + item.marketCap, 0);
  const ratio = leftValue / total;

  if (rect.w >= rect.h) {
    const w1 = rect.w * ratio;
    return [
      ...splitTreemap(left, { x: rect.x, y: rect.y, w: w1, h: rect.h }, depth + 1),
      ...splitTreemap(right, { x: rect.x + w1, y: rect.y, w: rect.w - w1, h: rect.h }, depth + 1),
    ];
  }

  const h1 = rect.h * ratio;
  return [
    ...splitTreemap(left, { x: rect.x, y: rect.y, w: rect.w, h: h1 }, depth + 1),
    ...splitTreemap(right, { x: rect.x, y: rect.y + h1, w: rect.w, h: rect.h - h1 }, depth + 1),
  ];
}

function getVisibleStocks() {
  const q = state.query.trim().toLowerCase();
  if (!q) return state.stocks;
  return state.stocks.filter(stock =>
    stock.name.toLowerCase().includes(q) ||
    stock.code.toLowerCase().includes(q)
  );
}

function renderSummary() {
  const stocks = state.stocks;
  const up = stocks.filter(s => s.change > 0).length;
  const down = stocks.filter(s => s.change < 0).length;
  const avg = stocks.reduce((sum, s) => sum + s.change, 0) / stocks.length;
  const totalCap = stocks.reduce((sum, s) => sum + s.marketCap, 0);

  document.getElementById("upCount").textContent = up;
  document.getElementById("downCount").textContent = down;
  document.getElementById("avgChange").textContent = `${avg > 0 ? "+" : ""}${avg.toFixed(2)}%`;
  document.getElementById("avgChange").style.color = avg >= 0 ? "#30c66b" : "#ff4d64";
  document.getElementById("totalCap").textContent = formatMarketCap(totalCap);

  const top5 = [...stocks].sort((a, b) => b.marketCap - a.marketCap).slice(0, 5);
  document.getElementById("top5").textContent =
    `Top 5: ${top5.map(s => `${s.name} ${formatMarketCap(s.marketCap)}`).join(" · ")}`;
}

function renderHeatmap() {
  const stocks = getVisibleStocks().sort((a, b) => b.marketCap - a.marketCap);
  const width = heatmap.clientWidth;
  const height = heatmap.clientHeight;

  heatmap.innerHTML = "";

  if (!stocks.length) {
    heatmap.innerHTML = `<div style="padding:24px;color:white;">검색 결과가 없습니다.</div>`;
    return;
  }

  const rects = splitTreemap(stocks, { x: 0, y: 0, w: width, h: height });

  rects.forEach(({ item, rect }) => {
    const tile = document.createElement("div");
    const pad = 1;
    const w = Math.max(0, rect.w - pad * 2);
    const h = Math.max(0, rect.h - pad * 2);
    const area = w * h;

    tile.className = "tile";
    tile.style.left = `${rect.x + pad}px`;
    tile.style.top = `${rect.y + pad}px`;
    tile.style.width = `${w}px`;
    tile.style.height = `${h}px`;
    tile.style.background = colorByChange(item.change);

    const fontSize = area > 26000 ? 34 : area > 14000 ? 24 : area > 7000 ? 17 : area > 2600 ? 12 : 9;
    const showName = area > 850;
    const showChange = area > 2300;
    const shortName = item.name.length > 6 ? item.name.slice(0, 6) : item.name;

    tile.innerHTML = `
      ${area > 11000 ? `<div class="sector-label">${item.sector}</div>` : ""}
      ${showName ? `
        <div class="tile-text" style="font-size:${fontSize}px">
          <span class="tile-name">${area > 9000 ? item.name : shortName}</span>
          ${showChange ? `<span class="tile-change">${item.change > 0 ? "+" : ""}${item.change.toFixed(2)}%</span>` : ""}
        </div>
      ` : ""}
    `;

    tile.addEventListener("mouseenter", () => showTooltip(item));
    tile.addEventListener("mousemove", moveTooltip);
    tile.addEventListener("mouseleave", hideTooltip);

    heatmap.appendChild(tile);
  });
}

function showTooltip(stock) {
  tooltip.classList.remove("hidden");
  tooltip.innerHTML = `
    <h3>${stock.name}</h3>
    <div class="sub">${stock.code} · ${stock.sector} · ${stock.industry}</div>
    <div class="tooltip-grid">
      <div class="tooltip-box">
        <span>현재가</span>
        <b>${formatKRW(stock.price)}원</b>
      </div>
      <div class="tooltip-box">
        <span>등락률</span>
        <b style="color:${stock.change >= 0 ? "#30c66b" : "#ff4d64"}">${stock.change > 0 ? "+" : ""}${stock.change.toFixed(2)}%</b>
      </div>
    </div>
    <div class="tooltip-box" style="margin-top:8px">
      <span>시가총액</span>
      <b>${formatMarketCap(stock.marketCap)}</b>
    </div>
  `;
}

function moveTooltip(event) {
  tooltip.style.left = `${Math.min(event.clientX + 16, window.innerWidth - 250)}px`;
  tooltip.style.top = `${Math.min(event.clientY + 16, window.innerHeight - 190)}px`;
}

function hideTooltip() {
  tooltip.classList.add("hidden");
}

async function testKisApi() {
  apiStatus.textContent = "한투 API 테스트 중...";

  try {
    const codes = state.stocks.slice(0, 20).map(s => s.code).join(",");
    const response = await fetch(`/api/kis/quotes?codes=${codes}`);

    if (!response.ok) {
      throw new Error("백엔드 연결 실패");
    }

    const quotes = await response.json();
    const quoteMap = new Map(quotes.map(q => [q.code, q]));

    state.stocks = state.stocks.map(stock => {
      const quote = quoteMap.get(stock.code);
      if (!quote) return stock;

      return {
        ...stock,
        price: Number(quote.price ?? stock.price),
        change: Number(quote.changeRate ?? stock.change),
      };
    });

    apiStatus.textContent = `한투 API 반영 완료 · ${quotes.length}개`;
    render();
  } catch (error) {
    apiStatus.textContent = "백엔드가 아직 없어서 CSV 데이터만 표시 중";
  }
}

function render() {
  renderSummary();
  renderHeatmap();
}

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderHeatmap();
});

kisButton.addEventListener("click", testKisApi);
window.addEventListener("resize", () => renderHeatmap());

renderIndices();
render();
