const API_URL = "http://localhost:8000";

async function getBasket() {
  return await chrome.runtime.sendMessage({ type: "GET_BASKET" });
}

async function init() {
  const basket = await getBasket();
  const { affiliate_id = "" } = await chrome.storage.local.get("affiliate_id");

  document.getElementById("af-id").value = affiliate_id;
  renderStats(basket);
  renderItems(basket);

  if (basket.length === 0) {
    document.getElementById("tip").style.display = "block";
  }
}

function renderStats(basket) {
  document.getElementById("count").textContent = basket.length;

  if (basket.length === 0) {
    document.getElementById("avg-com").textContent = "—";
    document.getElementById("avg-price").textContent = "—";
    return;
  }

  const avgCom = (basket.reduce((s, p) => s + (p.commission_rate || 0), 0) / basket.length).toFixed(1);
  const avgPrice = Math.round(basket.reduce((s, p) => s + (p.price || 0), 0) / basket.length);
  document.getElementById("avg-com").textContent = avgCom + "%";
  document.getElementById("avg-price").textContent = "฿" + avgPrice.toLocaleString();
}

function renderItems(basket) {
  const el = document.getElementById("items");

  if (basket.length === 0) {
    el.innerHTML = `<div class="empty">ยังไม่มีสินค้า<br>เปิดหน้าสินค้า Shopee แล้วกดปุ่ม 🛒 ที่ขวามือ</div>`;
    return;
  }

  el.innerHTML = basket.map(p => `
    <div class="item">
      <img src="${p.image_url}" alt="" onerror="this.src='https://picsum.photos/36/36'">
      <div style="flex:1;min-width:0">
        <div class="item-name">${p.name}</div>
        <div class="item-meta">฿${(p.price || 0).toLocaleString()} · คอม ${p.commission_rate || "?"}%</div>
      </div>
      <button class="item-remove" data-id="${p.id}">✕</button>
    </div>
  `).join("");

  el.querySelectorAll(".item-remove").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      await chrome.runtime.sendMessage({ type: "REMOVE_PRODUCT", productId: id });
      const updated = await getBasket();
      renderStats(updated);
      renderItems(updated);
    });
  });
}

// บันทึก Affiliate ID
document.getElementById("save-af").addEventListener("click", async () => {
  const id = document.getElementById("af-id").value.trim();
  await chrome.storage.local.set({ affiliate_id: id });
  const status = document.getElementById("af-status");
  status.textContent = id ? "✅ บันทึกแล้ว" : "ลบ ID แล้ว";
  status.className = "status success";
  setTimeout(() => { status.textContent = ""; }, 2000);
});

// ส่งไปแอปหลัก
document.getElementById("send-btn").addEventListener("click", async () => {
  const basket = await getBasket();
  if (basket.length === 0) {
    setStatus("send-status", "ตะกร้าว่างอยู่ครับ", "error"); return;
  }

  const { affiliate_id = "" } = await chrome.storage.local.get("affiliate_id");
  const btn = document.getElementById("send-btn");
  btn.textContent = "⏳ กำลังส่ง...";
  btn.disabled = true;

  const res = await chrome.runtime.sendMessage({ type: "SEND_TO_APP", basket, affiliateId: affiliate_id });

  btn.disabled = false;
  if (res.success) {
    btn.textContent = "✅ ส่งแล้ว!";
    setStatus("send-status", "เปิดแอปดูผลได้เลย", "success");
    setTimeout(() => chrome.tabs.create({ url: "http://localhost:3000" }), 800);
  } else {
    btn.textContent = "⚡ ส่งไปวิเคราะห์ที่แอปหลัก";
    setStatus("send-status", res.message, "error");
  }
});

// เปิดแอปหลัก
document.getElementById("open-app").addEventListener("click", () => {
  chrome.tabs.create({ url: "http://localhost:3000" });
});

// ล้างตะกร้า
document.getElementById("clear-btn").addEventListener("click", async () => {
  if (!confirm("ล้างตะกร้าทั้งหมด?")) return;
  await chrome.runtime.sendMessage({ type: "CLEAR_BASKET" });
  renderStats([]);
  renderItems([]);
  document.getElementById("tip").style.display = "block";
});

function setStatus(id, msg, type = "") {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = "status " + type;
  setTimeout(() => { el.textContent = ""; el.className = "status"; }, 3000);
}

init();
