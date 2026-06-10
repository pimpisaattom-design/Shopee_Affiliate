"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://shopeeaffiliate-production-c3ea.up.railway.app";

type Dims = Record<string, number>;
type Score6D = { dimensions: Dims; total: number };
type Explanation = { recommend: boolean; good_reasons: string[]; bad_reasons: string[]; summary: string };
type ContentIdeas = { hook: string; pov: string; script: string; camera_angle: string; selling_line: string; caption: string; hashtags: string[] };
type Product = { id: string; name: string; category: string; price: number; commission_rate: number; rating: number; sales_volume?: number; image_url: string; brand: string };
type BasketItem = { product: Product; role: string; score_6d: Score6D; explanation: Explanation; content_ideas: ContentIdeas; affiliate_url: string };

const ROLE_COLOR: Record<string, string> = {
  "ดึงคนเข้า":   "bg-blue-100 text-blue-700",
  "คอมดี":       "bg-green-100 text-green-700",
  "ทำคลิปง่าย":  "bg-purple-100 text-purple-700",
  "ขายซ้ำ":      "bg-yellow-100 text-yellow-700",
  "เสริมตะกร้า": "bg-gray-100 text-gray-600",
};

const DIM_ICON: Record<string, string> = {
  "ขายง่าย": "💰", "คอมดี": "💎", "ทำคอนเทนต์ง่าย": "🎬",
  "คนดูเข้าใจเร็ว": "⚡", "ความเสี่ยงต่ำ": "🛡️", "คู่แข่งไม่แน่น": "🎯",
};

type SortKey = "score" | "commission" | "price";

export default function ResultsPage() {
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [exporting, setExporting] = useState(false);

  // ─── Filter states ─────────────────────────────────────
  const [minComm,    setMinComm]    = useState(0);
  const [minScore,   setMinScore]   = useState(0);
  const [minRating,  setMinRating]  = useState(0);
  const [minSales,   setMinSales]   = useState(0);
  const [minPrice,   setMinPrice]   = useState(0);
  const [maxPrice,   setMaxPrice]   = useState(99999);
  const [exportCount, setExportCount] = useState<number | "">(50);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(`${API}/api/extension/latest`, { signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) {
          const data = await res.json();
          if (data.basket && data.basket.length > 0) {
            setBasket(data.basket);
            setLoading(false);
            return;
          }
        }
      } catch (e) {}

      const raw = localStorage.getItem("basket_result");
      if (raw) {
        try {
          const data = JSON.parse(raw);
          if (data.basket && data.basket.length > 0) {
            setBasket(data.basket);
            setLoading(false);
            return;
          }
        } catch {}
      }
      setErrorMsg("ยังไม่มีผลสแกน — กดสแกนสินค้าจาก Extension บนหน้า Shopee ก่อน");
      setLoading(false);
    }
    loadData();
  }, []);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  // ─── กรองตามเงื่อนไข ──────────────────────────────────
  const filtered = basket.filter(item => {
    const p = item.product;
    if (p.commission_rate < minComm)   return false;
    if (item.score_6d.total < minScore) return false;
    if (p.rating < minRating)          return false;
    if ((p.sales_volume ?? 0) < minSales) return false;
    if (p.price < minPrice)            return false;
    if (maxPrice < 99999 && p.price > maxPrice) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "score") return b.score_6d.total - a.score_6d.total;
    if (sortKey === "commission") return b.product.commission_rate - a.product.commission_rate;
    return b.product.price - a.product.price;
  });

  // จำกัดจำนวนที่แสดง/export
  const limit = exportCount === "" ? sorted.length : Math.min(Number(exportCount), sorted.length);
  const displayed = sorted.slice(0, limit);

  async function handleExport() {
    if (displayed.length === 0) return;
    setExporting(true);
    try {
      const items = displayed.map((item) => ({
        name: item.product.name,
        category: item.product.category,
        price: item.product.price,
        commission_rate: item.product.commission_rate,
        score: item.score_6d.total,
        recommend: item.explanation.recommend,
        summary: item.explanation.summary,
        hook: item.content_ideas.hook,
        script: item.content_ideas.script,
        caption: item.content_ideas.caption,
        hashtags: (item.content_ideas.hashtags || []).join(" "),
        affiliate_url: item.affiliate_url,
        role: item.role,
      }));

      const res = await fetch(`${API}/api/export/excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basket_name: "ตะกร้าสินค้า Affiliate", items }),
      });
      if (!res.ok) throw new Error("export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "affiliate_basket.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Export ไม่สำเร็จ — ตรวจสอบว่า Backend รันอยู่");
    }
    setExporting(false);
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">กำลังโหลดผลลัพธ์...</p>
    </div>
  );

  if (!basket.length) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
      <p className="text-5xl mb-4">🛒</p>
      <p className="text-gray-600 font-medium mb-2">{errorMsg || "ยังไม่มีสินค้า"}</p>
      <p className="text-sm text-gray-400 mb-6">เปิดหน้า Shopee Affiliate แล้วกดปุ่มสแกนใน Extension</p>
      <button onClick={() => window.location.reload()} className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-medium text-sm">
        🔄 โหลดผลสแกนอีกครั้ง
      </button>
    </div>
  );

  const avgScore = Math.round(basket.reduce((s, i) => s + i.score_6d.total, 0) / basket.length);
  const recommendCount = filtered.filter(i => i.explanation.recommend).length;
  const avgCom = filtered.length > 0
    ? (filtered.reduce((s, i) => s + i.product.commission_rate, 0) / filtered.length).toFixed(1)
    : "0";

  return (
    <div className="min-h-screen bg-gray-50 pb-28">

      {/* Top Bar */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-5 py-3 flex justify-between items-center">
          <h1 className="font-bold text-gray-800 text-lg">🛒 ตะกร้าของคุณ</h1>
          <button onClick={() => window.location.reload()} className="text-orange-500 text-sm font-medium hover:text-orange-600">
            🔄 โหลดใหม่
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 py-5">

        {/* Metric Cards */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <MetricCard label="ทั้งหมด→กรองแล้ว" value={`${basket.length}→${filtered.length}`} />
          <MetricCard label="คะแนนเฉลี่ย" value={avgScore.toString()} accent="green" />
          <MetricCard label="น่าทำ" value={recommendCount.toString()} accent="orange" />
          <MetricCard label="คอมเฉลี่ย" value={avgCom + "%"} />
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-gray-100 rounded-2xl mb-4 overflow-hidden">
          <button
            onClick={() => setShowFilters(f => !f)}
            className="w-full flex justify-between items-center px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <span>🎯 กรองคุณภาพ <span className="text-orange-500 font-bold ml-1">({filtered.length} ชิ้น)</span></span>
            <span>{showFilters ? "▲ ซ่อน" : "▼ ตั้งค่า"}</span>
          </button>

          {showFilters && (
            <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-gray-50 pt-3">
              <FilterInput label="คอมขั้นต่ำ (%)" value={minComm} onChange={setMinComm} min={0} max={50} step={1} />
              <FilterInput label="คะแนนขั้นต่ำ" value={minScore} onChange={setMinScore} min={0} max={100} step={5} />
              <FilterInput label="Rating ขั้นต่ำ" value={minRating} onChange={setMinRating} min={0} max={5} step={0.1} />
              <FilterInput label="ยอดขายขั้นต่ำ" value={minSales} onChange={setMinSales} min={0} max={10000} step={10} />
              <FilterInput label="ราคาต่ำสุด (฿)" value={minPrice} onChange={setMinPrice} min={0} max={99999} step={10} />
              <FilterInput label="ราคาสูงสุด (฿)" value={maxPrice} onChange={v => setMaxPrice(v === 0 ? 99999 : v)} min={0} max={99999} step={10} placeholder="ไม่จำกัด" />
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">Export กี่ชิ้น</label>
                <div className="flex gap-1 flex-wrap">
                  {[10, 20, 50, 100].map(n => (
                    <button key={n} onClick={() => setExportCount(n)}
                      className={`text-xs px-2 py-1 rounded-lg border transition ${exportCount === n ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"}`}>
                      {n}
                    </button>
                  ))}
                  <button onClick={() => setExportCount("")}
                    className={`text-xs px-2 py-1 rounded-lg border transition ${exportCount === "" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"}`}>
                    ทั้งหมด
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">จะ export <b className="text-orange-500">{limit}</b> ชิ้น</p>
              </div>

              <div className="col-span-full flex gap-2">
                <button onClick={() => { setMinComm(0); setMinScore(0); setMinRating(0); setMinSales(0); setMinPrice(0); setMaxPrice(99999); setExportCount(50); }}
                  className="text-xs text-gray-500 underline hover:text-gray-700">
                  รีเซ็ตทั้งหมด
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Toolbar: Sort + Export */}
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <div className="flex gap-2 text-sm">
            <span className="text-gray-400 self-center">เรียงตาม:</span>
            <SortBtn active={sortKey === "score"} onClick={() => setSortKey("score")}>คะแนน</SortBtn>
            <SortBtn active={sortKey === "commission"} onClick={() => setSortKey("commission")}>คอมสูง</SortBtn>
            <SortBtn active={sortKey === "price"} onClick={() => setSortKey("price")}>ราคา</SortBtn>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5 disabled:opacity-60"
          >
            {exporting ? "⏳ กำลังสร้างไฟล์..." : `📥 Export ${limit} ชิ้น`}
          </button>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map((item) => {
            const p = item.product;
            const isOpen = expanded === p.id;
            const scoreColor = item.score_6d.total >= 70 ? "text-green-600 bg-green-500" : item.score_6d.total >= 55 ? "text-yellow-600 bg-yellow-500" : "text-gray-400 bg-gray-400";
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition flex flex-col">

                {/* Image */}
                <div className="relative h-32 bg-gray-50">
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[item.role] || "bg-gray-100 text-gray-600"}`}>
                    {item.role}
                  </span>
                </div>

                {/* Body */}
                <div className="p-3 flex flex-col flex-1">
                  <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug min-h-[2.5rem]">{p.name}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-orange-500 font-bold text-sm">฿{p.price.toLocaleString()}</span>
                    <span className="text-xs text-gray-500">คอม {p.commission_rate}%</span>
                    <span className="text-xs text-gray-400">⭐{p.rating}</span>
                    {p.sales_volume != null && <span className="text-xs text-gray-400">🛒{p.sales_volume.toLocaleString()}</span>}
                  </div>

                  {/* Score bar */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-lg font-bold ${scoreColor.split(" ")[0]}`}>{item.score_6d.total}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${scoreColor.split(" ")[1]}`} style={{ width: `${item.score_6d.total}%` }} />
                    </div>
                  </div>

                  {/* Reason */}
                  <p className={`text-xs mt-2 px-2 py-1.5 rounded-lg leading-relaxed ${item.explanation.recommend ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"}`}>
                    {item.explanation.recommend ? "✅" : "⚠️"} {item.explanation.summary}
                  </p>

                  <button
                    onClick={() => setExpanded(isOpen ? null : p.id)}
                    className="mt-3 w-full text-xs font-medium text-orange-600 border border-orange-200 rounded-lg py-2 hover:bg-orange-50 transition"
                  >
                    {isOpen ? "▲ ซ่อนคอนเทนต์" : "💡 ดูไอเดียคอนเทนต์"}
                  </button>

                  {/* Content Pack */}
                  {isOpen && (
                    <div className="mt-3 space-y-2">
                      <ContentRow label="🎬 Hook" text={item.content_ideas.hook} onCopy={() => copyText(item.content_ideas.hook, `hook-${p.id}`)} copied={copied === `hook-${p.id}`} />
                      <ContentRow label="📝 Script" text={item.content_ideas.script} onCopy={() => copyText(item.content_ideas.script, `script-${p.id}`)} copied={copied === `script-${p.id}`} />
                      <ContentRow label="✍️ Caption" text={item.content_ideas.caption} onCopy={() => copyText(item.content_ideas.caption, `cap-${p.id}`)} copied={copied === `cap-${p.id}`} />
                      <div className="flex flex-wrap gap-1">
                        {item.content_ideas.hashtags.map((h) => (
                          <span key={h} className="bg-orange-100 text-orange-600 text-xs px-1.5 py-0.5 rounded">{h}</span>
                        ))}
                      </div>
                      <a href={item.affiliate_url} target="_blank" rel="noreferrer"
                        className="block w-full text-center bg-orange-500 text-white text-xs py-2 rounded-lg font-medium hover:bg-orange-600 transition">
                        🛍 เปิดลิงก์ Shopee
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixed Bottom Export Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-5 py-3 shadow-lg">
        <div className="max-w-6xl mx-auto flex gap-3 items-center">
          <span className="text-sm text-gray-500 hidden sm:block">{filtered.length} ชิ้น (กรองแล้ว) · export {limit} ชิ้น</span>
          <div className="flex-1" />
          <button
            onClick={() => copyText(displayed.map((item, i) => `${i + 1}. ${item.product.name}\n${item.content_ideas.caption}\n${item.affiliate_url}`).join("\n\n"), "all")}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl transition"
          >
            {copied === "all" ? "✅ คัดลอกแล้ว" : "📋 Copy Caption"}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-60"
          >
            {exporting ? "⏳ กำลังสร้าง..." : `📥 Export ${limit} ชิ้น`}
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const color = accent === "green" ? "text-green-600" : accent === "orange" ? "text-orange-500" : "text-gray-800";
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function SortBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg border text-sm transition ${active ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"}`}
    >
      {children}
    </button>
  );
}

function FilterInput({ label, value, onChange, min, max, step, placeholder }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 font-medium">{label}</label>
      <input
        type="number" min={min} max={max} step={step}
        value={value === 0 && placeholder ? "" : value}
        placeholder={placeholder ?? "0"}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-400 w-full"
      />
    </div>
  );
}

function ContentRow({ label, text, onCopy, copied }: { label: string; text: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2">
      <div className="flex justify-between items-center mb-0.5">
        <p className="text-xs font-semibold text-gray-600">{label}</p>
        <button onClick={onCopy} className="text-xs text-orange-500 hover:text-orange-700">
          {copied ? "✅" : "คัดลอก"}
        </button>
      </div>
      <p className="text-xs text-gray-700 leading-relaxed">{text}</p>
    </div>
  );
}
