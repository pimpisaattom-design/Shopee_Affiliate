const API = "http://localhost:8000";

export async function fetchTrending() {
  const r = await fetch(`${API}/api/products/trending`);
  return r.json();
}

export async function curateBasket(p: {
  category: string; max_price: number | null;
  min_commission: number; content_type: string;
  count: number; affiliate_id: string;
}) {
  const r = await fetch(`${API}/api/curate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
  return r.json();
}

export async function exportExcel(items: object[], basketName = "ตะกร้าสินค้า Affiliate") {
  const r = await fetch(`${API}/api/export/excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ basket_name: basketName, items }),
  });
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "affiliate_basket.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}
