"use client";
import { useEffect, useState, useCallback } from "react";
import { fetchTrending, curateBasket, exportExcel } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────
type Product = { id: string; name: string; category: string; price: number; commission_rate: number; rating: number; image_url: string; brand: string; trending?: boolean; score?: number };
type Score6D = { dimensions: Record<string, number>; total: number };
type Explanation = { recommend: boolean; good_reasons: string[]; bad_reasons: string[]; summary: string };
type ContentIdeas = { hook: string; pov: string; script: string; camera_angle: string; selling_line: string; caption: string; hashtags: string[] };
type BasketItem = { product: Product; role: string; score_6d: Score6D; explanation: Explanation; content_ideas: ContentIdeas; affiliate_url: string };

// ─── Constants ───────────────────────────────────────────
const CATS = [
  { label: "ของใช้ในบ้าน", icon: "🏠" }, { label: "สัตว์เลี้ยง", icon: "🐾" },
  { label: "แฟชั่น", icon: "👗" },       { label: "ความงาม", icon: "💄" },
  { label: "แม่และเด็ก", icon: "👶" },   { label: "มือถืออุปกรณ์", icon: "📱" },
  { label: "กีฬา", icon: "🏋️" },         { label: "เครื่องใช้ไฟฟ้า", icon: "⚡" },
  { label: "ยานยนต์", icon: "🚗" },
];
const SUGGESTED = ["ออฟฟิศซินโดรม", "สุขภาพ", "ของใช้ส่วนตัว", "อาหารและเครื่องดื่ม"];
const PRICES = [{ l: "ไม่เกิน 200฿", v: 200 }, { l: "ไม่เกิน 500฿", v: 500 }, { l: "ไม่เกิน 1,000฿", v: 1000 }, { l: "ไม่จำกัด", v: null }];
const COMS = [{ l: "5%", s: "เริ่มต้น", v: 5 }, { l: "10%", s: "แนะนำ", v: 10 }, { l: "15%", s: "ดี", v: 15, hot: true }, { l: "20%+", s: "พรีเมียม", v: 20 }];
const CONTENTS = [
  { l: "รีวิวก่อน-หลัง", s: "Before/After", icon: "▶️", v: "รีวิวก่อน-หลัง" },
  { l: "แก้ปัญหา", s: "Pain Point", icon: "🎯", v: "แก้ปัญหา" },
  { l: "Unboxing", s: "เปิดกล่อง", icon: "📦", v: "Unboxing" },
  { l: "TikTok สั้น", s: "15-30 วิ", icon: "🎵", v: "TikTok สั้น" },
  { l: "เปรียบเทียบ", s: "A vs B", icon: "⚖️", v: "เปรียบเทียบ" },
  { l: "สอนใช้งาน", s: "How-to", icon: "📚", v: "สอนใช้งาน" },
  { l: "Day in Life", s: "ชีวิตประจำวัน", icon: "☀️", v: "Day in Life" },
  { l: "ทดสอบ 30 วัน", s: "Long-term", icon: "📅", v: "ทดสอบ 30 วัน" },
];
const COUNTS = [{ l: "10", s: "ทดลองก่อน", v: 10 }, { l: "20", s: "แนะนำ", v: 20, hot: true }, { l: "50", s: "ตะกร้าใหญ่", v: 50 }];
const ROLE_COLOR: Record<string, string> = { "ดึงคนเข้า": "bg-blue-100 text-blue-700", "คอมดี": "bg-green-100 text-green-700", "ทำคลิปง่าย": "bg-purple-100 text-purple-700", "ขายซ้ำ": "bg-yellow-100 text-yellow-700", "เสริมตะกร้า": "bg-gray-100 text-gray-600" };
const DIM_ICON: Record<string, string> = { "ขายง่าย": "💰", "คอมดี": "💎", "ทำคอนเทนต์ง่าย": "🎬", "คนดูเข้าใจเร็ว": "⚡", "ความเสี่ยงต่ำ": "🛡️", "คู่แข่งไม่แน่น": "🎯" };

// ─── Main Component ───────────────────────────────────────
export default function Home() {
  // Form state
  const [cat, setCat] = useState("");
  const [customCat, setCustomCat] = useState("");
  const [maxPrice, setMaxPrice] = useState<number | null>(500);
  const [minCom, setMinCom] = useState(10);
  const [contentType, setContentType] = useState("แก้ปัญหา");
  const [count, setCount] = useState(20);
  const [showMoreContent, setShowMoreContent] = useState(false);

  // Results state
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");

  // Affiliate ID
  const [afId, setAfId] = useState("");
  const [showAfPopup, setShowAfPopup] = useState(false);
  const [afInput, setAfInput] = useState("");
  const [showAfBanner, setShowAfBanner] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("affiliate_id") || "";
    setAfId(saved);
    setAfInput(saved);
    setShowAfBanner(!saved);
    fetchTrending().then(d => setTrending(d.trending || []));
  }, []);

  const saveAfId = () => {
    localStorage.setItem("affiliate_id", afInput.trim());
    setAfId(afInput.trim());
    setShowAfPopup(false);
    setShowAfBanner(!afInput.trim());
  };

  const selectedCat = customCat.trim() || cat;

  const handleSearch = async () => {
    if (!selectedCat) { setError("เลือกหมวดสินค้าก่อนนะคะ"); return; }
    setError(""); setLoading(true);
    try {
      const data = await curateBasket({ category: selectedCat, max_price: maxPrice, min_commission: minCom, content_type: contentType, count, affiliate_id: afId });
      setBasket(data.basket || []);
    } catch { setError("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง"); }
    finally { setLoading(false); }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const copyAllCaptions = () => {
    const text = basket.map((item, i) => `${i + 1}. ${item.product.name}\n${item.content_ideas.caption}\n${item.affiliate_url}`).join("\n\n");
    copy(text, "all");
  };

  const handleExcelExport = async () => {
    const items = basket.map(item => ({
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
      hashtags: item.content_ideas.hashtags.join(" "),
      affiliate_url: item.affiliate_url,
      role: item.role,
    }));
    await exportExcel(items, `ตะกร้า ${selectedCat}`);
  };

  const avgScore = basket.length ? Math.round(basket.reduce((s, i) => s + i.score_6d.total, 0) / basket.length) : 0;
  const visibleContents = showMoreContent ? CONTENTS : CONTENTS.slice(0, 4);

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col">

      {/* ─── Header ─── */}
      <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛒</span>
          <span className="font-bold text-gray-800">Shopee <span className="text-orange-500">Affiliate</span> Basket</span>
        </div>
        <div className="flex items-center gap-2">
          {afId && <span className="text-xs text-gray-400 hidden sm:block">ID: {afId}</span>}
          <button onClick={() => { setShowAfPopup(v => !v); setShowAfBanner(false); }} className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-full px-3 py-1.5 hover:border-orange-300 hover:text-orange-500 transition">
            ⚙️ {afId ? "เปลี่ยน ID" : "ตั้งค่า Affiliate ID"}
          </button>
        </div>
      </header>

      {/* ─── Affiliate ID Popup ─── */}
      {showAfPopup && (
        <div className="fixed top-14 right-4 bg-white border border-orange-200 rounded-2xl shadow-xl p-4 w-72 z-50">
          <p className="text-sm font-bold text-gray-700 mb-1">🔑 Shopee Affiliate ID</p>
          <p className="text-xs text-gray-400 mb-3">ใส่เพื่อให้ลิงก์สินค้าเป็นลิงก์ Affiliate ของคุณโดยอัตโนมัติ</p>
          <input className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" placeholder="เช่น atom_creator_123" value={afInput} onChange={e => setAfInput(e.target.value)} onKeyDown={e => e.key === "Enter" && saveAfId()} />
          <button onClick={saveAfId} className="mt-2 w-full bg-orange-500 text-white text-sm py-2 rounded-xl hover:bg-orange-600 transition">บันทึก</button>
          <p className="text-xs text-gray-400 text-center mt-2">ข้อมูลเก็บในเครื่องคุณเท่านั้น</p>
        </div>
      )}

      {/* ─── Affiliate ID Banner ─── */}
      {showAfBanner && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex justify-between items-center text-xs">
          <span className="text-yellow-700">⚠️ ยังไม่ได้ตั้ง Affiliate ID — ลิงก์ที่ได้จะยังไม่ใช่ของคุณ</span>
          <button onClick={() => { setShowAfPopup(true); setShowAfBanner(false); }} className="text-orange-500 font-bold ml-2">ตั้งค่าเลย →</button>
        </div>
      )}

      {/* ─── Main Layout ─── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ══ LEFT: Form ══ */}
        <aside className="w-72 bg-white border-r overflow-y-auto flex-shrink-0 p-4 space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">เงื่อนไขสินค้า</p>

          {/* 1. หมวดสินค้า */}
          <FormSection num={1} title="หมวดสินค้า">
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {CATS.map(c => (
                <button key={c.label} onClick={() => { setCat(c.label); setCustomCat(""); setError(""); }}
                  className={`flex flex-col items-center py-2 rounded-xl border-2 text-xs transition ${cat === c.label && !customCat ? "border-orange-400 bg-orange-50 text-orange-600 font-semibold" : "border-gray-100 text-gray-500 hover:border-orange-200"}`}>
                  <span className="text-lg mb-0.5">{c.icon}</span>{c.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {SUGGESTED.map(s => (
                <button key={s} onClick={() => { setCat(s); setCustomCat(""); setError(""); }}
                  className={`px-2.5 py-1 rounded-full text-xs border-2 transition ${cat === s && !customCat ? "border-orange-400 bg-orange-50 text-orange-600" : "border-gray-200 text-gray-500 hover:border-orange-200"}`}>
                  {s}
                </button>
              ))}
            </div>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-orange-400"
              placeholder="พิมพ์เองเลย เช่น กล่องเก็บของ" value={customCat}
              onChange={e => { setCustomCat(e.target.value); setCat(""); setError(""); }} />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </FormSection>

          {/* 2. ราคา */}
          <FormSection num={2} title="ราคาไม่เกิน">
            <div className="flex flex-wrap gap-1.5">
              {PRICES.map(p => (
                <button key={p.l} onClick={() => setMaxPrice(p.v)}
                  className={`px-3 py-1.5 rounded-full text-xs border-2 transition ${maxPrice === p.v ? "border-orange-400 bg-orange-50 text-orange-600 font-semibold" : "border-gray-200 text-gray-500 hover:border-orange-200"}`}>
                  {p.l}
                </button>
              ))}
            </div>
          </FormSection>

          {/* 3. คอมมิชชัน */}
          <FormSection num={3} title="คอมขั้นต่ำ">
            <div className="grid grid-cols-4 gap-1">
              {COMS.map(c => (
                <button key={c.v} onClick={() => setMinCom(c.v)}
                  className={`relative py-2.5 rounded-xl border-2 text-center transition ${minCom === c.v ? "border-orange-400 bg-orange-50" : "border-gray-200 hover:border-orange-200"}`}>
                  {c.hot && <span className="absolute -top-1.5 -right-1 bg-orange-500 text-white text-[9px] px-1 rounded-full">ดี!</span>}
                  <p className={`text-sm font-bold ${minCom === c.v ? "text-orange-500" : "text-gray-700"}`}>{c.l}</p>
                  <p className="text-[10px] text-gray-400">{c.s}</p>
                </button>
              ))}
            </div>
          </FormSection>

          {/* 4. แนวคอนเทนต์ */}
          <FormSection num={4} title="แนวคอนเทนต์">
            <div className="grid grid-cols-2 gap-1.5">
              {visibleContents.map(c => (
                <button key={c.v} onClick={() => setContentType(c.v)}
                  className={`flex items-center gap-2 p-2 rounded-xl border-2 text-left transition ${contentType === c.v ? "border-orange-400 bg-orange-50" : "border-gray-100 hover:border-orange-200"}`}>
                  <span className="text-lg">{c.icon}</span>
                  <div>
                    <p className={`text-xs font-semibold ${contentType === c.v ? "text-orange-600" : "text-gray-700"}`}>{c.l}</p>
                    <p className="text-[10px] text-gray-400">{c.s}</p>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowMoreContent(v => !v)} className="mt-1.5 w-full text-xs text-orange-500 hover:text-orange-700">
              {showMoreContent ? "▲ ซ่อน" : "▼ เพิ่มเติม"}
            </button>
          </FormSection>

          {/* 5. จำนวน */}
          <FormSection num={5} title="จำนวนสินค้า">
            <div className="grid grid-cols-3 gap-1.5">
              {COUNTS.map(c => (
                <button key={c.v} onClick={() => setCount(c.v)}
                  className={`relative py-3 rounded-xl border-2 text-center transition ${count === c.v ? "border-orange-400 bg-orange-50" : "border-gray-200 hover:border-orange-200"}`}>
                  {c.hot && <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[9px] px-1.5 rounded-full">แนะนำ</span>}
                  <p className={`text-xl font-bold ${count === c.v ? "text-orange-500" : "text-gray-700"}`}>{c.l}</p>
                  <p className="text-[10px] text-gray-400">{c.s}</p>
                </button>
              ))}
            </div>
          </FormSection>

          {/* CTA */}
          <button onClick={handleSearch} disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold py-3 rounded-xl text-sm transition sticky bottom-4">
            {loading ? "⏳ กำลังวิเคราะห์..." : "🔍 หาสินค้าให้ฉัน →"}
          </button>
        </aside>

        {/* ══ RIGHT: Results ══ */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">

          {/* Empty state */}
          {basket.length === 0 && !loading && (
            <div className="space-y-5">
              {/* Call to action banner */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-400 rounded-2xl p-5 text-white flex justify-between items-center">
                <div>
                  <p className="text-lg font-bold">👈 เลือกเงื่อนไขด้านซ้าย</p>
                  <p className="text-sm opacity-90 mt-1">แล้วกด "หาสินค้าให้ฉัน" ระบบจะคัดให้อัตโนมัติ</p>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {["ความงาม", "ออฟฟิศซินโดรม", "สัตว์เลี้ยง", "กีฬา"].map(s => (
                      <button key={s} onClick={() => { setCat(s); setCustomCat(""); }}
                        className="px-3 py-1 bg-white text-orange-500 rounded-full text-xs font-semibold hover:bg-orange-50 transition">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="text-6xl opacity-30">🛒</span>
              </div>

              {/* Trending grid */}
              {trending.length > 0 && (
                <div>
                  <p className="font-bold text-gray-700 mb-3">🔥 สินค้ากำลังเทรนด์ตอนนี้</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {trending.map(p => (
                      <div key={p.id} className="bg-white rounded-2xl border border-orange-100 overflow-hidden shadow-sm hover:shadow transition cursor-pointer"
                        onClick={() => { setCat(p.category); setCustomCat(""); }}>
                        <div className="relative">
                          <img src={p.image_url} alt={p.name} className="w-full h-28 object-cover" />
                          <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">🔥 HOT</span>
                        </div>
                        <div className="p-3">
                          <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-relaxed">{p.name}</p>
                          <p className="text-orange-500 font-bold text-sm mt-1">฿{p.price.toLocaleString()}</p>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-[10px] text-gray-400">คอม {p.commission_rate}%</span>
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                              คะแนน {p.score?.toFixed(0)}
                            </span>
                          </div>
                          <p className="text-[10px] text-orange-400 mt-1.5 font-medium">กดเพื่อค้นหมวดนี้ →</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tips */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: "💎", title: "คอม 15%+ = ดีมาก", desc: "เลือกคอมสูงได้เงินต่อคลิปเยอะ" },
                  { icon: "💰", title: "ราคา ≤ 500฿ = ขายง่าย", desc: "คนตัดสินใจซื้อได้เร็ว" },
                  { icon: "🎬", title: "หมวดความงาม = คอนเทนต์ง่าย", desc: "มี Pain Point ชัด ทำ Before/After ได้" },
                ].map(t => (
                  <div key={t.title} className="bg-white rounded-xl p-3 shadow-sm">
                    <p className="text-xl mb-1">{t.icon}</p>
                    <p className="text-xs font-bold text-gray-700">{t.title}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {basket.length > 0 && (
            <>
              {/* Summary */}
              <div className="bg-orange-500 text-white rounded-2xl px-5 py-3 flex justify-around text-center">
                <div><p className="text-2xl font-bold">{basket.length}</p><p className="text-xs opacity-80">สินค้าในตะกร้า</p></div>
                <div><p className="text-2xl font-bold">{avgScore}</p><p className="text-xs opacity-80">คะแนนเฉลี่ย</p></div>
                <div><p className="text-2xl font-bold">{basket.filter(i => i.explanation.recommend).length}</p><p className="text-xs opacity-80">น่าทำ</p></div>
              </div>

              {/* Trending strip */}
              {trending.length > 0 && (
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="font-bold text-gray-700 mb-3 text-sm">🔥 สินค้ากำลังเทรนด์ตอนนี้</p>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {trending.map(p => (
                      <div key={p.id} className="flex-shrink-0 w-32 bg-orange-50 border border-orange-100 rounded-xl p-2">
                        <div className="relative">
                          <img src={p.image_url} alt={p.name} className="w-full h-16 object-cover rounded-lg" />
                          <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] px-1 py-0.5 rounded-full">🔥</span>
                        </div>
                        <p className="text-[10px] font-semibold text-gray-800 mt-1 line-clamp-2">{p.name}</p>
                        <p className="text-orange-500 text-[10px] font-bold">฿{p.price.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Product Cards */}
              {basket.map((item) => {
                const p = item.product;
                const isOpen = expanded === p.id;
                const scoreColor = item.score_6d.total >= 70 ? "text-green-600" : item.score_6d.total >= 55 ? "text-yellow-600" : "text-gray-400";
                const barColor = item.score_6d.total >= 70 ? "bg-green-500" : item.score_6d.total >= 55 ? "bg-yellow-500" : "bg-gray-400";

                return (
                  <div key={p.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4">
                      <div className="flex gap-3">
                        <div className="relative flex-shrink-0">
                          <img src={p.image_url} alt={p.name} className="w-16 h-16 rounded-xl object-cover" />
                          {p.trending && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1 py-0.5 rounded-full">🔥</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <p className="text-sm font-semibold text-gray-800 flex-1 line-clamp-2">{p.name}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${ROLE_COLOR[item.role] || "bg-gray-100 text-gray-600"}`}>{item.role}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{p.brand} · {p.category}</p>
                          <div className="flex gap-3 mt-1">
                            <span className="text-orange-500 font-bold text-sm">฿{p.price.toLocaleString()}</span>
                            <span className="text-xs text-gray-500">คอม {p.commission_rate}%</span>
                            <span className="text-xs text-gray-500">⭐ {p.rating}</span>
                          </div>
                        </div>
                      </div>

                      {/* Score bar */}
                      <div className="mt-3 flex items-center gap-3">
                        <span className={`text-2xl font-bold ${scoreColor}`}>{item.score_6d.total}</span>
                        <div className="flex-1">
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${item.score_6d.total}%` }} />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">คะแนนน่าทำ</p>
                        </div>
                      </div>

                      {/* Explanation */}
                      <div className={`mt-2 p-2.5 rounded-xl text-xs ${item.explanation.recommend ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                        {item.explanation.recommend ? "✅" : "⚠️"} {item.explanation.summary}
                      </div>

                      {/* 6D scores */}
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {Object.entries(item.score_6d.dimensions).map(([k, v]) => (
                          <div key={k} className="text-center">
                            <p className="text-[10px] text-gray-400">{DIM_ICON[k]} {k}</p>
                            <div className="h-1.5 bg-gray-100 rounded-full mt-0.5 overflow-hidden">
                              <div className="h-full bg-orange-400 rounded-full" style={{ width: `${v}%` }} />
                            </div>
                            <p className="text-xs font-semibold text-gray-700">{Math.round(v)}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Content toggle */}
                    <button onClick={() => setExpanded(isOpen ? null : p.id)}
                      className="w-full px-4 py-2.5 border-t text-sm text-orange-600 font-medium flex justify-between hover:bg-orange-50 transition">
                      <span>💡 ไอเดียคอนเทนต์ ({contentType})</span>
                      <span>{isOpen ? "▲ ซ่อน" : "▼ ดู"}</span>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 space-y-2 bg-orange-50">
                        {[
                          { label: "🎬 Hook เปิดคลิป", text: item.content_ideas.hook, key: `hook-${p.id}` },
                          { label: "📝 Script พูดในคลิป", text: item.content_ideas.script, key: `script-${p.id}` },
                          { label: "✍️ Caption โพสต์", text: item.content_ideas.caption, key: `cap-${p.id}` },
                          { label: "📷 มุมถ่ายสินค้า", text: item.content_ideas.camera_angle, key: `cam-${p.id}` },
                        ].map(row => (
                          <div key={row.key} className="bg-white rounded-xl p-3">
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-xs font-bold text-gray-600">{row.label}</p>
                              <button onClick={() => copy(row.text, row.key)} className="text-xs text-orange-500 hover:text-orange-700">
                                {copied === row.key ? "✅ คัดลอกแล้ว" : "คัดลอก"}
                              </button>
                            </div>
                            <p className="text-xs text-gray-700 leading-relaxed">{row.text}</p>
                          </div>
                        ))}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {item.content_ideas.hashtags.map(h => (
                            <span key={h} className="bg-orange-100 text-orange-600 text-[10px] px-2 py-0.5 rounded-full">{h}</span>
                          ))}
                        </div>
                        <a href={item.affiliate_url} target="_blank" rel="noreferrer"
                          className="block w-full text-center bg-orange-500 text-white text-sm py-2 rounded-xl font-medium hover:bg-orange-600 transition">
                          🛍 เปิดลิงก์ Shopee
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </main>
      </div>

      {/* ─── Bottom Bar ─── */}
      {basket.length > 0 && (
        <div className="fixed bottom-0 left-72 right-0 bg-white border-t px-4 py-3 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="flex gap-2 items-center">

            {/* Main CTA */}
            <button onClick={copyAllCaptions}
              className="flex-1 relative overflow-hidden bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition text-sm">
              {copied === "all" ? (
                <span>✅ คัดลอกแล้ว — เปิดแอปแล้วไปวางได้เลย!</span>
              ) : (
                <span>⚡ เปลี่ยนสินค้านี้เป็นคอนเทนต์ใน 1 วิ — กดเลย</span>
              )}
            </button>

            {/* Excel */}
            <button onClick={handleExcelExport}
              className="flex flex-col items-center px-4 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 py-2 rounded-xl transition min-w-[80px]">
              <span className="text-lg">📊</span>
              <span className="text-[10px] font-semibold">บันทึกแผน</span>
            </button>

            {/* New search */}
            <button onClick={() => setBasket([])}
              className="flex flex-col items-center px-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500 py-2 rounded-xl transition min-w-[80px]">
              <span className="text-lg">🔍</span>
              <span className="text-[10px] font-semibold">ค้นใหม่</span>
            </button>
          </div>

          {/* Sub hint */}
          {copied !== "all" && (
            <p className="text-[10px] text-gray-400 text-center mt-1.5">
              กด Copy → เปิดแอปที่ใช้โพสต์ → วาง Caption → แปะลิงก์ได้เลย
            </p>
          )}
        </div>
      )}

    </div>
  );
}

function FormSection({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="w-5 h-5 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{num}</span>
        <p className="text-sm font-bold text-gray-700">{title}</p>
      </div>
      {children}
    </div>
  );
}
