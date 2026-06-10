(function () {
  if (window.__sabLoaded) return;
  window.__sabLoaded = true;

  const API = "https://shopeeaffiliate-production-c3ea.up.railway.app";
  let basket = [];
  let panelOpen = false;
  let scanning = false;

  // ─── ตรวจว่าอยู่หน้าไหน ───────────────────────────────────
  function isListingPage() {
    return /affiliate\.shopee\.co\.th\/(offer|product)/.test(location.href);
  }

  // ─── Keyword ปัจจุบัน (เซตเมื่อกดปุ่มหมวด) ───────────────
  let currentKeyword  = "";  // manual input
  let currentKeywords = [];  // batch จากปุ่มหมวด

  // ─── SORT TYPE constants ───────────────────────────────────
  const SORT = {
    RELEVANCE:   1,
    BEST_SELLING: 2,
    PRICE_ASC:   3,
    PRICE_DESC:  4,
    COMMISSION:  5,
  };

  // ─── แปลง commission string "2%" → number 2 ──────────────
  function parseCommRate(val) {
    if (!val) return 0;
    return parseFloat(String(val).replace("%", "").trim()) || 0;
  }

  // ─── ลบ Unicode surrogate chars ที่ Python encode ไม่ได้ ──
  // เช่น 𝗔𝗕𝗖 (mathematical bold) ใน product name ของ Shopee
  function sanitize(str) {
    return String(str ?? "")
      .replace(/[\uD800-\uDFFF]/g, "") // lone surrogates
      .trim();
  }

  // ─── แปลง API product → schema ภายใน ──────────────────────
  // field จริงจาก /api/v3/offer/product/list (verified 2026-06-05)
  function mapProduct(raw) {
    const card = raw.batch_item_for_item_card_full ?? {};

    // ID — อยู่ทั้ง 2 ที่
    const id = raw.item_id ?? card.itemid ?? String(Date.now());

    // ชื่อ / รูป / ราคา อยู่ใน card
    const name  = card.name  ?? "";
    const image = card.image ?? card.images?.[0] ?? "";
    // ราคาเป็น cent (÷100000) เช่น 26900000 → 269
    const price = Number(card.price_min ?? card.price ?? 0) / 100000;

    // commission — string "2%" อยู่ที่ top-level
    const commRate = parseCommRate(
      raw.default_commission_rate ?? raw.seller_commission_rate ?? raw.max_commission_rate
    );

    // rating อยู่ใน object { rating_star, rating_count, ... }
    const rating = Number(card.item_rating?.rating_star ?? 4.5);

    // ยอดขาย
    const sold = Number(card.sold ?? card.historical_sold ?? 0);

    // affiliate link — สร้าง URL แบบ affiliate portal ถ้ามี offer_id
    const offerId = raw.offer_id ?? raw.id ?? null;
    const affiliateUrl = offerId
      ? `https://affiliate.shopee.co.th/offer/product_offer/${offerId}`
      : (raw.long_link ?? raw.product_link ?? location.href);

    // shop flags
    const isMall        = !!card.is_official_shop || !!card.shopee_verified;
    const isRecommended = !!card.is_preferred_plus_seller;
    // offer_card_type: 1 = EXTRA COMM (verified จาก API จริง 2026-06-05)
    const isExtraComm = (raw.offer_card_type ?? 0) === 1;

    return {
      id: String(id),
      name: sanitize(name).slice(0, 120),
      price,
      commission_rate: commRate,
      rating,
      sales_volume: sold,
      image_url: image.startsWith("http")
        ? image
        : `https://cf.shopee.co.th/file/${image}`,
      affiliate_url: sanitize(affiliateUrl),
      category: "ไม่ระบุหมวด",
      brand: sanitize(card.shop_name ?? card.brand ?? "Shopee"),
      in_stock: true,
      source: "api",
      _isMall: isMall,
      _isRecommended: isRecommended,
      _isExtraComm: isExtraComm,
    };
  }

  // ─── เรียก fetch ผ่าน page world (page-fetcher.js ใน MAIN world) ─
  // page-fetcher.js ลงทะเบียนเป็น content script world:"MAIN" ใน manifest
  // จึงรันด้วย fetch ของ Shopee ที่มี anti-bot SDK hooks โดยไม่โดน CSP
  // สื่อสารผ่าน window.postMessage (ทะลุ isolated ↔ main world ได้)
  function pageWorldFetch(url) {
    return new Promise((resolve, reject) => {
      const reqId = Math.random().toString(36).slice(2);

      function onMessage(e) {
        if (!e.data || e.data.__sab !== "res" || e.data.reqId !== reqId) return;
        window.removeEventListener("message", onMessage);
        if (e.data.ok) resolve(e.data.data);
        else reject(new Error(e.data.error ?? "fetch failed"));
      }

      window.addEventListener("message", onMessage);
      window.postMessage({ __sab: "req", url, reqId }, "*");

      setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("timeout — page-fetcher ไม่ตอบกลับ"));
      }, 15000);
    });
  }

  // ─── เรียก API 1 หน้า ─────────────────────────────────────
  async function fetchProductsAPI({ keyword = "", page = 1, sortType = SORT.BEST_SELLING, pageSize = 50, extraCommOnly = false } = {}) {
    const params = new URLSearchParams({
      keyword,
      list_type:   0,
      page_offset: (page - 1) * pageSize,
      page_limit:  pageSize,
      sort_type:   sortType,
      client_type: 1,
    });
    // filter_types=2 คือ EXTRA COMM (verified จาก Network tab 2026-06-05)
    if (extraCommOnly) params.set("filter_types", "2");

    const json = await pageWorldFetch(`/api/v3/offer/product/list?${params}`);

    if (json.code !== 0) throw new Error(`API code ${json.code}: ${json.msg ?? ""}`);

    // structure: { data: { list: [...], total_count, page_offset, page_limit } }
    const data       = json.data ?? {};
    const products   = data.list ?? [];
    const totalCount = data.total_count ?? 0;
    const pageLimit  = data.page_limit  ?? pageSize;
    const pageOffset = data.page_offset ?? 0;
    const hasMore    = (pageOffset + pageLimit) < totalCount;

    return {
      products: products.map(mapProduct),
      total:    totalCount,
      hasMore,
      currentPage: page,
    };
  }

  // ─── ดึงสินค้าทุกหน้าผ่าน API ────────────────────────────
  async function fetchAllProductsAPI(keyword, sortType = SORT.BEST_SELLING, onProgress, extraCommOnly = false) {
    const PAGE_SIZE = 50;
    const MAX_PAGES = 100; // กันลูปไม่รู้จบ (~5000 สินค้า)
    const all = [];
    const seenIds = new Set();
    let page = 1;

    while (page <= MAX_PAGES) {
      if (onProgress) onProgress(`📡 API หน้า ${page} — พบแล้ว ${all.length} ชิ้น`);

      const { products, hasMore } = await fetchProductsAPI({
        keyword, page, sortType, pageSize: PAGE_SIZE, extraCommOnly,
      });

      if (products.length === 0) break;

      for (const p of products) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          // ถ้า fetch ด้วย filter_types=2 แปลว่าทุกตัวคือ EXTRA COMM แน่นอน
          if (extraCommOnly) p._isExtraComm = true;
          all.push(p);
        }
      }

      if (!hasMore) break; // API บอกว่าหมดแล้ว

      page++;
      await new Promise(r => setTimeout(r, 200)); // throttle เบาๆ
    }

    return { products: all, total: all.length };
  }

  // ─── กรองตาม checkbox ที่ผู้ใช้ติ๊ก ──────────────────────
  function applyFilters(products) {
    const fMall  = document.getElementById("sab-f-mall")?.checked;
    const fRec   = document.getElementById("sab-f-rec")?.checked;
    const fExtra = document.getElementById("sab-f-extra")?.checked;

    return products.filter(p => {
      if (fMall  && !p._isMall)        return false;
      if (fRec   && !p._isRecommended) return false;
      if (fExtra && !p._isExtraComm)   return false;
      return true;
    });
  }

  // ─── Sort type ที่เลือกอยู่ ────────────────────────────────
  function getSelectedSort() {
    const val = document.getElementById("sab-sort-select")?.value;
    return Number(val) || SORT.BEST_SELLING;
  }

  // ─── Keyword batch ต่อหมวด (500 ชิ้น/keyword × N = ได้มากขึ้น) ─
  const CATEGORY_KEYWORDS = {
    "ความงาม":   ["ครีมกันแดด", "เซรั่มหน้าใส", "มอยเจอร์ไรเซอร์", "แป้งพัฟ", "ลิปสติก"],
    "แฟชั่น":    ["เสื้อผ้าผู้หญิง", "กางเกงยีนส์", "เดรสแฟชั่น", "แจ็คเก็ต", "เสื้อยืดผู้ชาย"],
    "สุขภาพ":    ["อาหารเสริม", "วิตามิน", "คอลลาเจน", "โปรตีน", "น้ำมันปลา"],
    "มือถือ":    ["เคสมือถือ", "สายชาร์จ", "หูฟังบลูทูธ", "แบตสำรอง", "ฟิล์มกระจก"],
    "ของใช้บ้าน":["ของใช้ในบ้าน", "เครื่องใช้ไฟฟ้า", "ผ้าม่าน", "หมอน", "กระทะ"],
    "แม่และเด็ก":["ของเล่นเด็ก", "ผ้าอ้อม", "นมผง", "รถเข็นเด็ก", "เสื้อผ้าเด็ก"],
    "สัตว์เลี้ยง":["อาหารสุนัข", "อาหารแมว", "ของเล่นสัตว์เลี้ยง", "ที่นอนสัตว์", "แชมพูสุนัข"],
    "กีฬา":      ["อุปกรณ์กีฬา", "รองเท้าวิ่ง", "เสื้อกีฬา", "ดัมเบล", "โยคะ"],
  };

  // ─── กดปุ่มหมวด → เซต keyword batch ─────────────────────
  function handleCategoryClick(catName, btnEl) {
    const batch = CATEGORY_KEYWORDS[catName] ?? [catName];
    currentKeywords = batch;
    currentKeyword  = ""; // clear manual input

    // ล้าง input field ด้วย
    const kwInput = document.getElementById("sab-kw-input");
    if (kwInput) kwInput.value = "";

    document.querySelectorAll(".sab-cat-btn").forEach(b => b.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");

    const result = document.getElementById("sab-scan-result");
    if (result) result.textContent =
      `✅ "${catName}" → ${batch.length} keywords: ${batch.join(", ")}`;
  }

  // ─── ส่งไป Backend ────────────────────────────────────────
  async function sendAllToBackend(products, affiliateId = "") {
    // ลบ field ที่ขึ้นต้นด้วย _ ออกก่อนส่ง (เป็น metadata ภายใน)
    const clean = products.map(({ _isMall, _isRecommended, _isExtraComm, ...rest }) => rest);
    const res = await fetch(`${API}/api/extension/basket`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        products: clean,
        affiliate_id: affiliateId,
        content_type: "แก้ปัญหา",
      }),
    });
    return res.json();
  }

  // ─── DOM helpers สำหรับหน้าสินค้าเดี่ยวเท่านั้น ────────────
  function _domPrice(el) {
    const m = el.textContent.match(/฿\s*([\d,]+)/g) || el.textContent.match(/([\d,]+)\s*บาท/g);
    if (m) {
      const nums = m.map(s => parseInt(s.replace(/[^0-9]/g, ""))).filter(n => n > 0 && n < 1_000_000);
      if (nums.length) return Math.min(...nums);
    }
    return 0;
  }
  function _domCommission(el) {
    const m = el.textContent.match(/(\d+\.?\d*)\s*%/g);
    if (m) for (const s of m) { const n = parseFloat(s); if (n > 0 && n <= 50) return n; }
    return 0;
  }
  function _domRating(el) {
    const m = el.textContent.match(/([4-5]\.\d)/);
    return m ? parseFloat(m[1]) : 4.5;
  }
  function _domSales(el) {
    const m = el.textContent.match(/ขาย\s*([\d,k]+)/i) || el.textContent.match(/([\d,]+)\s*ขาย/i);
    return m ? (parseInt(m[1].replace(/[^0-9]/g, "")) || 0) : 0;
  }

  // ─── UI ───────────────────────────────────────────────────
  function createUI() {
    document.getElementById("sab-root")?.remove();

    const root = document.createElement("div");
    root.id = "sab-root";
    root.innerHTML = `
      <style>
        .sab-cat-btn {
          font-size: 11px; padding: 5px 10px; border-radius: 14px;
          border: 1px solid #ddd; background: #fff; color: #333;
          cursor: pointer; transition: all .15s;
        }
        .sab-cat-btn:hover { border-color: #ee4d2d; color: #ee4d2d; }
        .sab-cat-btn.active { background: #ee4d2d; color: #fff; border-color: #ee4d2d; }
      </style>
      <div id="sab-tab">
        <span>🛒</span>
        <span id="sab-count" class="sab-count">0</span>
      </div>
      <div id="sab-panel" style="display:none;flex-direction:column">
        <div class="sab-header">
          <span>🛒 Shopee Affiliate Basket</span>
          <button id="sab-close">✕</button>
        </div>

        ${isListingPage() ? `
        <div class="sab-detected" id="sab-autoscan-zone">
          <div class="sab-detected-title">📡 ดึงสินค้าจาก API</div>
          <div style="font-size:11px;color:#555;margin-bottom:8px">
            1) เลือกหมวด / พิมพ์ keyword → 2) เลือก sort → 3) กดดึงสินค้า
          </div>

          <div style="font-size:11px;font-weight:600;color:#333;margin-bottom:5px">📂 หมวดด่วน</div>
          <div class="sab-cats" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">
            <button class="sab-cat-btn" data-cat="ความงาม">ความงาม</button>
            <button class="sab-cat-btn" data-cat="แฟชั่น">แฟชั่น</button>
            <button class="sab-cat-btn" data-cat="สุขภาพ">สุขภาพ</button>
            <button class="sab-cat-btn" data-cat="มือถือ">มือถือ</button>
            <button class="sab-cat-btn" data-cat="ของใช้บ้าน">ของใช้บ้าน</button>
            <button class="sab-cat-btn" data-cat="แม่และเด็ก">แม่และเด็ก</button>
            <button class="sab-cat-btn" data-cat="สัตว์เลี้ยง">สัตว์เลี้ยง</button>
            <button class="sab-cat-btn" data-cat="กีฬา">กีฬา</button>
          </div>

          <div style="display:flex;gap:6px;margin-bottom:8px">
            <input id="sab-kw-input" type="text" placeholder="หรือพิมพ์ keyword เอง..."
              style="flex:1;font-size:11px;padding:5px 8px;border:1px solid #ddd;border-radius:8px;outline:none"/>
          </div>

          <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;font-size:11px">
            <label style="color:#555;white-space:nowrap">เรียงโดย:</label>
            <select id="sab-sort-select" style="flex:1;font-size:11px;padding:4px 6px;border:1px solid #ddd;border-radius:8px">
              <option value="2" selected>ขายดี</option>
              <option value="5">คอมมิชชันสูง</option>
              <option value="1">ความเกี่ยวข้อง</option>
              <option value="3">ราคาต่ำ → สูง</option>
              <option value="4">ราคาสูง → ต่ำ</option>
            </select>
          </div>

          <div class="sab-filters" style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px;font-size:12px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="sab-f-extra"> เฉพาะ EXTRA COMM (ค่าคอมพิเศษ)
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="sab-f-mall"> เฉพาะร้าน Mall
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="sab-f-rec"> เฉพาะร้านแนะนำ
            </label>
          </div>
          <button class="sab-btn-add" id="sab-scan-btn">📡 ดึงสินค้าจาก API</button>
          <div id="sab-scan-result" style="font-size:11px;margin-top:6px;color:#666;line-height:1.5"></div>
        </div>
        ` : `
        <div class="sab-detected" id="sab-single-zone">
          <div class="sab-detected-title" id="sab-det-label">🔍 ตรวจพบสินค้า</div>
          <div class="sab-detected-name" id="sab-det-name">กำลังตรวจสอบ...</div>
          <div class="sab-detected-meta">
            <span id="sab-det-price">—</span>
            <span id="sab-det-com">—</span>
          </div>
          <button class="sab-btn-add" id="sab-btn-add">➕ เพิ่มสินค้านี้</button>
        </div>
        `}

        <div class="sab-items" id="sab-items">
          <div class="sab-empty">ยังไม่มีสินค้า</div>
        </div>

        <div class="sab-footer">
          <button class="sab-btn-primary" id="sab-send-btn">⚡ ส่งไปวิเคราะห์ที่แอป</button>
          <button class="sab-btn-secondary" id="sab-clear-btn">🗑 ล้างตะกร้า</button>
        </div>
      </div>
    `;

    document.body.appendChild(root);
    bindEvents();
    refreshCount();
  }

  function bindEvents() {
    document.getElementById("sab-tab").addEventListener("click", togglePanel);
    document.getElementById("sab-close").addEventListener("click", togglePanel);
    document.getElementById("sab-send-btn").addEventListener("click", handleSendToApp);
    document.getElementById("sab-clear-btn").addEventListener("click", handleClear);

    if (isListingPage()) {
      document.getElementById("sab-scan-btn").addEventListener("click", handleAutoScan);
      document.querySelectorAll(".sab-cat-btn").forEach(btn => {
        btn.addEventListener("click", () => handleCategoryClick(btn.dataset.kw, btn));
      });
      // keyword input ด้วยมือ — sync กับ currentKeyword
      const kwInput = document.getElementById("sab-kw-input");
      if (kwInput) {
        kwInput.addEventListener("input", () => {
          currentKeyword  = kwInput.value;
          currentKeywords = []; // พิมพ์เอง = ใช้ keyword เดี่ยว ไม่ใช้ batch
          if (kwInput.value) {
            document.querySelectorAll(".sab-cat-btn").forEach(b => b.classList.remove("active"));
          }
        });
        kwInput.addEventListener("keydown", e => {
          if (e.key === "Enter") handleAutoScan();
        });
      }
    } else {
      document.getElementById("sab-btn-add")?.addEventListener("click", handleAddSingle);
      detectSingleProduct();
    }
  }

  function togglePanel() {
    panelOpen = !panelOpen;
    document.getElementById("sab-panel").style.display = panelOpen ? "flex" : "none";
    document.getElementById("sab-tab").style.display = panelOpen ? "none" : "flex";
  }

  // ─── ดึงสินค้าจาก API ทุกหน้า ────────────────────────────
  async function handleAutoScan() {
    if (scanning) return;
    scanning = true;

    const btn    = document.getElementById("sab-scan-btn");
    const result = document.getElementById("sab-scan-result");
    btn.textContent = "⏳ กำลังดึงข้อมูล...";
    btn.disabled    = true;

    // รวม keywords: batch จากหมวด หรือ keyword ที่พิมพ์เอง
    const manualKw = currentKeyword.trim();
    const keywords = currentKeywords.length > 0
      ? currentKeywords
      : (manualKw ? [manualKw] : []);

    if (keywords.length === 0) {
      result.textContent = "⚠️ กรุณาเลือกหมวดหรือพิมพ์ keyword ก่อนดึงข้อมูล";
      btn.disabled    = false;
      btn.textContent = "📡 ดึงสินค้าจาก API";
      scanning = false;
      return;
    }

    const sortType      = getSelectedSort();
    const extraCommOnly = document.getElementById("sab-f-extra")?.checked ?? false;
    const seenIds   = new Set();
    let allProducts = [];

    try {
      for (let i = 0; i < keywords.length; i++) {
        const kw = keywords[i];
        const { products, total } = await fetchAllProductsAPI(
          kw,
          sortType,
          msg => { result.textContent = `[${i+1}/${keywords.length}] ${kw} — ${msg}`; },
          extraCommOnly
        );
        // dedup ข้าม keyword
        for (const p of products) {
          if (!seenIds.has(p.id)) { seenIds.add(p.id); allProducts.push(p); }
        }
        result.textContent =
          `[${i+1}/${keywords.length}] "${kw}" — สะสม ${allProducts.length} ชิ้น`;
      }
      result.textContent = `✅ รวมทั้งหมด ${allProducts.length} ชิ้น (${keywords.length} keyword) — กำลังกรอง...`;
    } catch (e) {
      result.innerHTML =
        `❌ เรียก API ไม่ได้: <b>${e.message}</b><br>` +
        `ตรวจสอบว่า login อยู่ใน affiliate.shopee.co.th แล้ว`;
      btn.disabled    = false;
      btn.textContent = "📡 ลองใหม่";
      scanning = false;
      return;
    }

    // กรองตาม checkbox
    const filtered = applyFilters(allProducts);

    if (filtered.length === 0) {
      result.textContent = allProducts.length === 0
        ? "❌ API ไม่คืนสินค้า — ลองเปลี่ยน keyword"
        : `⚠️ พบ ${allProducts.length} ชิ้น แต่ไม่มีตัวไหนตรงเงื่อนไขที่เลือก`;
      btn.disabled    = false;
      btn.textContent = "📡 ดึงสินค้าจาก API";
      scanning = false;
      return;
    }

    result.textContent = `✅ พบ ${filtered.length} ชิ้น (ทั้งหมด ${allProducts.length}) — กำลังส่ง...`;

    const { affiliate_id = "" } = await chrome.storage.local.get("affiliate_id");
    try {
      const data = await sendAllToBackend(filtered, affiliate_id);
      // เก็บเฉพาะ raw products (ไม่เก็บ scored basket ที่ใหญ่มาก)
      basket = filtered;
      await chrome.runtime.sendMessage({ type: "SET_BASKET", basket: filtered }).catch(() => {});
      result.textContent = `🎉 วิเคราะห์แล้ว ${data.total ?? filtered.length} ชิ้น! กำลังเปิดแอป...`;
      refreshCount();
      refreshItems();
      setTimeout(() => window.open("http://shopee-affiliate-self.vercel.app/results", "_blank"), 1200);
    } catch (e) {
      // แสดง error จริงเพื่อ debug
      result.innerHTML = `❌ ส่งไป Backend ไม่ได้: <b>${e.message}</b>`;
    }

    btn.disabled    = false;
    btn.textContent = "📡 ดึงสินค้าจาก API";
    scanning = false;
  }

  // ─── สินค้าเดี่ยว ─────────────────────────────────────────
  let currentProduct = null;
  function detectSingleProduct() {
    currentProduct = readSingleProduct();
    if (!currentProduct) return;
    const nameEl = document.getElementById("sab-det-name");
    const priceEl = document.getElementById("sab-det-price");
    const comEl = document.getElementById("sab-det-com");
    if (nameEl) nameEl.textContent = currentProduct.name.slice(0, 55) + "...";
    if (priceEl) priceEl.textContent = `฿${currentProduct.price.toLocaleString()}`;
    if (comEl) comEl.textContent = currentProduct.commission_rate ? `คอม ${currentProduct.commission_rate}%` : "⚠️ ไม่พบคอม";
  }
  function readSingleProduct() {
    const getMeta = p => document.querySelector(`meta[property="${p}"]`)?.content;
    const name = getMeta("og:title") || document.querySelector("h1")?.textContent?.trim();
    if (!name) return null;
    const breadcrumb = document.querySelector("[class*='breadcrumb'], [class*='category']");
    const catFromUrl = location.href.match(/category[=\/]([^&\/]+)/);
    return {
      id: `single-${Date.now()}`,
      name,
      price: _domPrice(document.body),
      commission_rate: _domCommission(document.body),
      rating: _domRating(document.body),
      sales_volume: _domSales(document.body),
      image_url: getMeta("og:image") || "",
      affiliate_url: location.href,
      category: breadcrumb?.textContent.trim().slice(0, 30)
             ?? (catFromUrl ? decodeURIComponent(catFromUrl[1]) : "ไม่ระบุหมวด"),
      brand: "จาก Shopee",
      in_stock: true,
      source: "single",
    };
  }
  async function handleAddSingle() {
    if (!currentProduct) return;
    if (!currentProduct.commission_rate) {
      const c = prompt("กรอก % คอมมิชชันที่เห็นในหน้านี้:");
      if (c) currentProduct.commission_rate = parseFloat(c) || 0;
    }
    const res = await chrome.runtime.sendMessage({ type: "ADD_PRODUCT", product: currentProduct });
    if (res.success) {
      basket = await chrome.runtime.sendMessage({ type: "GET_BASKET" });
      refreshCount(); refreshItems();
      showToast("✅ เพิ่มแล้ว " + basket.length + " ชิ้น", "success");
      document.getElementById("sab-btn-add").textContent = "✅ เพิ่มแล้ว";
    } else {
      showToast(res.message, "error");
    }
  }

  async function handleSendToApp() {
    if (basket.length === 0) { showToast("ตะกร้าว่างอยู่", "error"); return; }
    const { affiliate_id = "" } = await chrome.storage.local.get("affiliate_id");
    const btn = document.getElementById("sab-send-btn");
    btn.textContent = "⏳ กำลังส่ง..."; btn.disabled = true;
    try {
      const data = await sendAllToBackend(basket, affiliate_id);
      await chrome.storage.local.set({ extension_basket: data.basket || [] });
      showToast("✅ ส่งแล้ว! เปิดแอปดูได้เลย", "success");
      btn.textContent = "✅ ส่งแล้ว";
      setTimeout(() => window.open("http://shopee-affiliate-self.vercel.app/results", "_blank"), 1000);
    } catch {
      showToast("❌ เชื่อมต่อแอปไม่ได้", "error");
      btn.disabled = false; btn.textContent = "⚡ ส่งไปวิเคราะห์ที่แอป";
    }
  }

  async function handleClear() {
    if (!confirm("ล้างตะกร้าทั้งหมด?")) return;
    await chrome.runtime.sendMessage({ type: "CLEAR_BASKET" });
    basket = []; refreshCount(); refreshItems();
    showToast("ล้างตะกร้าแล้ว");
  }

  function refreshCount() {
    const el = document.getElementById("sab-count");
    if (el) el.textContent = basket.length;
  }
  function refreshItems() {
    const el = document.getElementById("sab-items");
    if (!el) return;
    if (basket.length === 0) { el.innerHTML = `<div class="sab-empty">ยังไม่มีสินค้า</div>`; return; }
    el.innerHTML = basket.slice(0, 8).map(p => `
      <div class="sab-item">
        <img src="${p.image_url}" onerror="this.src='https://picsum.photos/40'" style="width:36px;height:36px;border-radius:6px;object-fit:cover">
        <div class="sab-item-info">
          <div class="sab-item-name">${(p.name || "").slice(0, 35)}</div>
          <div class="sab-item-price">฿${(p.price || 0).toLocaleString()} · ${p.commission_rate || "?"}%</div>
        </div>
      </div>
    `).join("") + (basket.length > 8 ? `<div style="text-align:center;font-size:10px;color:#999;padding:4px">+${basket.length - 8} รายการ</div>` : "");
  }
  function showToast(msg, type = "") {
    document.querySelector(".sab-toast")?.remove();
    const t = document.createElement("div");
    t.className = `sab-toast ${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // ─── Init ──────────────────────────────────────────────────
  async function init() {
    basket = await chrome.runtime.sendMessage({ type: "GET_BASKET" }).catch(() => []);
    createUI();
    let lastUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(createUI, 1500);
      }
    }).observe(document.body, { subtree: true, childList: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    setTimeout(init, 500);
  }
})();
