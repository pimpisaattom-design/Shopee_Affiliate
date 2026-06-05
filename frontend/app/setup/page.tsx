"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [affiliateId, setAffiliateId] = useState("");
  const [error, setError] = useState("");

  const handleSave = () => {
    if (!affiliateId.trim()) {
      setError("กรุณากรอก Affiliate ID ก่อนนะคะ");
      return;
    }
    localStorage.setItem("affiliate_id", affiliateId.trim());
    router.push("/form");
  };

  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">

        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🛒</div>
          <h1 className="text-2xl font-bold text-gray-800">Shopee Affiliate</h1>
          <h2 className="text-2xl font-bold text-orange-500">Basket Manager</h2>
          <p className="text-gray-500 text-sm mt-2">ตอบ 5 ข้อ ระบบคัดสินค้าและจัดตะกร้าให้เลย</p>
        </div>

        <div className="bg-orange-50 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-orange-700 mb-1">🔑 Shopee Affiliate ID คืออะไร?</p>
          <p className="text-xs text-orange-600">
            คือรหัสประจำตัวของคุณในระบบ Shopee Affiliate
            หาได้จาก <strong>affiliate.shopee.co.th</strong> → โปรไฟล์ของฉัน
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Affiliate ID ของคุณ
          </label>
          <input
            type="text"
            placeholder="เช่น atom_creator_123"
            value={affiliateId}
            onChange={(e) => { setAffiliateId(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 transition"
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition text-base"
        >
          บันทึกและเริ่มใช้งาน →
        </button>

        <p className="text-xs text-gray-400 text-center mt-4">
          ข้อมูลเก็บไว้ในเครื่องของคุณเท่านั้น ไม่ได้ส่งไปที่ไหน
        </p>
      </div>
    </div>
  );
}
