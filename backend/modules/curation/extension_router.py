from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from modules.scoring.engine import calculate_6d_score
from modules.scoring.explanation import generate_explanation
from modules.curation.content import generate_content_ideas

router = APIRouter(prefix="/api/extension", tags=["extension"])

extension_baskets: dict = {}
_last_session = {"id": None}  # จำ session ล่าสุดที่สแกนเข้ามา


def _clean(text: str) -> str:
    """ลบ Unicode surrogate characters ที่ Python UTF-8 encode ไม่ได้
    เช่น 𝗔𝗕𝗖 (mathematical bold) ในชื่อสินค้า Shopee"""
    if not isinstance(text, str):
        return str(text) if text is not None else ""
    return text.encode("utf-8", errors="ignore").decode("utf-8").strip()


def _clean_product(p: dict) -> dict:
    """Sanitize ทุก string field ใน product dict"""
    str_fields = ["name", "brand", "category", "affiliate_url", "image_url", "source"]
    for f in str_fields:
        if f in p and isinstance(p[f], str):
            p[f] = _clean(p[f])
    return p


class ExtProduct(BaseModel):
    id: str
    name: str
    price: float = 0
    commission_rate: float = 0
    rating: float = 4.5
    sales_volume: int = 0
    review_count: int = 0
    discount_rate: float = 0
    image_url: str = ""
    affiliate_url: str = ""
    category: str = "ไม่ระบุหมวด"
    brand: str = ""
    in_stock: bool = True
    source: str = "extension"


class ExtBasketRequest(BaseModel):
    products: List[ExtProduct]
    affiliate_id: Optional[str] = ""
    content_type: Optional[str] = "วิดีโอสั้น"


@router.post("/basket")
def receive_from_extension(body: ExtBasketRequest):
    scored = []
    for p in body.products:
        pd = _clean_product(p.dict())
        pd.setdefault("review_count", 0)
        pd.setdefault("discount_rate", 0)

        score_6d = calculate_6d_score(pd)
        explanation = generate_explanation(pd, score_6d)
        content = generate_content_ideas(pd, body.content_type or "วิดีโอสั้น")

        af_url = pd["affiliate_url"]
        if body.affiliate_id and "af_id" not in af_url:
            sep = "&" if "?" in af_url else "?"
            af_url = f"{af_url}{sep}af_id={body.affiliate_id}"

        scored.append({
            "product": pd,
            "role": assign_role(pd, score_6d),
            "score_6d": score_6d,
            "explanation": explanation,
            "content_ideas": content,
            "affiliate_url": af_url,
        })

    scored.sort(key=lambda x: x["score_6d"]["total"], reverse=True)

    session_id = body.affiliate_id or "default"
    extension_baskets[session_id] = scored
    _last_session["id"] = session_id  # บันทึกว่าอันนี้คือล่าสุด

    return {
        "total": len(scored),
        "basket": scored,
        "message": "รับข้อมูลจาก Extension แล้ว เปิดแอปดูผลได้เลย"
    }


@router.get("/latest")
def get_latest_basket():
    """คืนผลสแกนล่าสุด ไม่ว่า session ไหน — สำหรับให้หน้าเว็บดึงไปแสดง"""
    sid = _last_session["id"]
    if not sid or sid not in extension_baskets:
        return {"total": 0, "basket": [], "message": "ยังไม่มีข้อมูลสแกน"}
    basket = extension_baskets[sid]
    return {"total": len(basket), "basket": basket, "session_id": sid}


@router.get("/basket/{session_id}")
def get_extension_basket(session_id: str = "default"):
    basket = extension_baskets.get(session_id, [])
    return {"total": len(basket), "basket": basket}


def assign_role(product: dict, score_6d: dict) -> str:
    dims = score_6d["dimensions"]
    cat = product.get("category", "")
    REPEAT_CATS = ["อาหารเสริม", "ของใช้ประจำวัน", "สุขภาพ", "สัตว์เลี้ยง", "ของใช้เด็ก"]

    if product.get("price", 0) <= 300 and dims.get("ขายง่าย", 0) >= 75:
        return "ดึงคนเข้า"
    if dims.get("คอมดี", 0) >= 75:
        return "คอมดี"
    if cat in REPEAT_CATS:
        return "ขายซ้ำ"
    if dims.get("ทำคอนเทนต์ง่าย", 0) >= 80:
        return "ทำคลิปง่าย"
    return "เสริมตะกร้า"