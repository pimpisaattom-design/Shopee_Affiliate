"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { curateBasket } from "@/lib/api";

const CATEGORIES = [
  { label: "ของใช้ในบ้าน", icon: "🏠" },
  { label: "สัตว์เลี้ยง",   icon: "🐾" },
  { label: "แฟชั่น",        icon: "👗" },
  { label: "ความงาม",       icon: "💄" },
  { label: "แม่และเด็ก",    icon: "👶" },
  { label: "มือถืออุปกรณ์", icon: "📱" },
  { label: "กีฬา",          icon: "🏋️" },
  { label: "เครื่องใช้ไฟฟ้า", icon: "⚡" },
  { label: "ยานยนต์",       icon: "🚗" },
];

const SUGGESTED = ["ออฟฟิศซินโดรม", "สุขภาพ", "ของใช้ส่วนตัว", "อาหารและเครื่องดื่ม"];

const PRICE_OPTIONS = [
  { label: "ไม่เกิน 200 ฿", value: 200 },
  { label: "ไม่เกิน 500 ฿", value: 500 },
  { label: "ไม่เกิน 1,000 ฿", value: 1000 },
  { label: "ไม่จำกัด", value: null },
];

const COMMISSION_OPTIONS = [
  { label: "5%",  sub: "เริ่มต้น", value: 5 },
  { label: "10%", sub: "แนะนำ",   value: 10 },
  { label: "15%", sub: "ดี",       value: 15, hot: true },
  { label: "20%+",sub: "พรีเมียม", value: 20 },
];

const CONTENT_OPTIONS = [
  { label: "รีวิวก่อน-หลัง", sub: "Before/After · ผลลัพธ์ชัด", icon: "▶️", value: "รีวิวก่อน-หลัง" },
  { label: "แก้ปัญหา",       sub: "Pain Point · ตอบโจทย์ตรง",  icon: "🎯", value: "แก้ปัญหา" },
  { label: "Unboxing",       sub: "เปิดกล่อง · First impression", icon: "📦", value: "Unboxing" },
  { label: "TikTok สั้น",    sub: "15–30 วิ · Hook แรง",        icon: "🎵", value: "TikTok สั้น" },
];

const COUNT_OPTIONS = [
  { label: "10", sub: "ทดลองก่อน", value: 10 },
  { label: "20", sub: "แนะนำ",     value: 20, hot: true },
  { label: "50", sub: "ตะกร้าใหญ่", value: 50 },
];

export default function FormPage() {
  const router = useRouter();
  const [category, setCategory]     = useState("");
  const [customCat, setCustomCat]   = useState("");
  const [maxPrice, setMaxPrice]     = useState<number | null>(500);
  const [minCom, setMinCom]         = useState(10);
  const [contentType, setContentType] = useState("แก้ปัญหา");
  const [count, setCount]           = useState(20);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  const selectedCat = customCat.trim() || category;

  const handleSubmit = async () => {
    if (!selectedCat) { setError("เลือกหมวดสินค้าก่อนนะคะ"); return; }
    setError("");
    setLoading(true);
    try {
      const affiliateId = localStorage.getItem("affiliate_id") || "";
      const data = await curateBasket({
        category: selectedCat,
        max_price: maxPrice,
        min_commission: minCom,
        content_type: contentType,
        count,
        affiliate_id: affiliateId,
      });
      localStorage.setItem("basket_result", JSON.stringify(data));
      router.push("/results");
    } catch {
      setError("เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะคะ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50">
      {/* Header */}
      <div className="bg-white shadow-sm px-5 py-4 flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            คัดสินค้า <span className="text-orange-500">Affiliate</span>
          </h1>
          <h1 className="text-xl font-bold text-gray-800">ที่ใช่ให้คุณ</h1>
          <p className="text-xs text-gray-400 mt-1">ตอบ 5 ข้อ ระบบวิเคราะห์และจัดตะกร้าให้เลย</p>
        </div>
        <div className="text-4xl">🛒</div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-32">

        {/* ข้อ 1 หมวดสินค้า */}
        <Section num={1} title="หมวดสินค้าที่อยากขาย">
          <p className="text-xs text-gray-400 mb-3">หมวดหลักใน Marketplace</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {CATEGORIES.map((c) => (
              <button
                key={c.label}
                onClick={() => { setCategory(c.label); setCustomCat(""); setError(""); }}
                className={`flex flex-col items-center py-3 px-2 rounded-xl border-2 text-xs font-medium transition ${
                  category === c.label && !customCat
                    ? "border-orange-400 bg-orange-50 text-orange-600"
                    : "border-gray-100 bg-white text-gray-600 hover:border-orange-200"
                }`}
              >
                <span className="text-2xl mb-1">{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-400 mb-2">แนะนำสำหรับมือใหม่ ✨</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {SUGGESTED.map((s) => (
              <button
                key={s}
                onClick={() => { setCategory(s); setCustomCat(""); setError(""); }}
                className={`px-3 py-1.5 rounded-full text-xs border-2 transition ${
                  category === s && !customCat
                    ? "border-orange-400 bg-orange-50 text-orange-600"
                    : "border-gray-200 bg-white text-gray-600 hover:border-orange-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
              placeholder="หรือพิมพ์เองเลย เช่น กล่องเก็บของ / ของแมว"
              value={customCat}
              onChange={(e) => { setCustomCat(e.target.value); setCategory(""); setError(""); }}
            />
          </div>
          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        </Section>

        {/* ข้อ 2 ราคา */}
        <Section num={2} title="ราคาสินค้าที่อยากขาย">
          <div className="flex flex-wrap gap-2">
            {PRICE_OPTIONS.map((p) => (
              <button
                key={p.label}
                onClick={() => setMaxPrice(p.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition ${
                  maxPrice === p.value
                    ? "border-orange-400 bg-orange-50 text-orange-600"
                    : "border-gray-200 bg-white text-gray-600 hover:border-orange-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Section>

        {/* ข้อ 3 คอมมิชชัน */}
        <Section num={3} title="คอมมิชชันขั้นต่ำที่รับได้">
          <div className="grid grid-cols-4 gap-2">
            {COMMISSION_OPTIONS.map((c) => (
              <button
                key={c.value}
                onClick={() => setMinCom(c.value)}
                className={`relative py-3 rounded-xl border-2 text-center transition ${
                  minCom === c.value
                    ? "border-orange-400 bg-orange-50"
                    : "border-gray-200 bg-white hover:border-orange-200"
                }`}
              >
                {c.hot && (
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">คุ้ม!</span>
                )}
                <p className={`font-bold text-base ${minCom === c.value ? "text-orange-500" : "text-gray-700"}`}>{c.label}</p>
                <p className="text-xs text-gray-400">{c.sub}</p>
              </button>
            ))}
          </div>
        </Section>

        {/* ข้อ 4 แนวคอนเทนต์ */}
        <Section num={4} title="แนวคอนเทนต์ที่อยากทำ">
          <div className="grid grid-cols-2 gap-2">
            {CONTENT_OPTIONS.map((c) => (
              <button
                key={c.value}
                onClick={() => setContentType(c.value)}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition ${
                  contentType === c.value
                    ? "border-orange-400 bg-orange-50"
                    : "border-gray-200 bg-white hover:border-orange-200"
                }`}
              >
                <span className="text-2xl">{c.icon}</span>
                <div>
                  <p className={`text-sm font-semibold ${contentType === c.value ? "text-orange-600" : "text-gray-700"}`}>{c.label}</p>
                  <p className="text-xs text-gray-400">{c.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* ข้อ 5 จำนวน */}
        <Section num={5} title="อยากได้สินค้ากี่ชิ้น?">
          <div className="grid grid-cols-3 gap-3">
            {COUNT_OPTIONS.map((c) => (
              <button
                key={c.value}
                onClick={() => setCount(c.value)}
                className={`relative py-4 rounded-xl border-2 text-center transition ${
                  count === c.value
                    ? "border-orange-400 bg-orange-50"
                    : "border-gray-200 bg-white hover:border-orange-200"
                }`}
              >
                {c.hot && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">แนะนำ</span>
                )}
                <p className={`text-2xl font-bold ${count === c.value ? "text-orange-500" : "text-gray-700"}`}>{c.label}</p>
                <p className="text-xs text-gray-400">{c.sub}</p>
              </button>
            ))}
          </div>
        </Section>

      </div>

      {/* CTA Fixed Bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-4 shadow-lg">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full max-w-lg mx-auto block bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold py-4 rounded-xl text-base transition"
        >
          {loading ? "⏳ กำลังวิเคราะห์..." : "🔍 คัดสินค้าน่าทำ Affiliate ให้ฉัน →"}
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">
          ระบบจะวิเคราะห์และจัดตะกร้า พร้อมไอเดียคอนเทนต์ให้เลย
        </p>
      </div>
    </div>
  );
}

function Section({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-7 h-7 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">{num}</span>
        <h2 className="font-bold text-gray-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}
