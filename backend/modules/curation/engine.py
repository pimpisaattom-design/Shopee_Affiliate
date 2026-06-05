import json
import math
from pathlib import Path
from modules.scoring.engine import calculate_6d_score
from modules.scoring.explanation import generate_explanation
from modules.curation.content import generate_content_ideas

DATA_FILE = Path(__file__).parent.parent.parent / "data" / "mock_products.json"

ROLES = ["ดึงคนเข้า", "คอมดี", "ทำคลิปง่าย", "ขายซ้ำ", "เสริมตะกร้า"]

REPEAT_CATS = ["อาหารและเครื่องดื่ม", "ของใช้ส่วนตัว", "สุขภาพ", "สัตว์เลี้ยง", "แม่และเด็ก"]


def load_products():
    with open(DATA_FILE, encoding="utf-8") as f:
        return json.load(f)


def filter_products(products, category, max_price, min_commission):
    result = []
    for p in products:
        if not p.get("in_stock", True):
            continue
        if category and category != "ทั้งหมด" and p["category"] != category:
            continue
        if max_price and p["price"] > max_price:
            continue
        if min_commission and p["commission_rate"] < min_commission:
            continue
        result.append(p)
    return result


def assign_role(product, score_6d):
    dims = score_6d["dimensions"]
    cat = product["category"]

    if product["price"] <= 300 and dims["ขายง่าย"] >= 80:
        return "ดึงคนเข้า"
    if dims["คอมดี"] >= 75:
        return "คอมดี"
    if cat in REPEAT_CATS:
        return "ขายซ้ำ"
    if dims["ทำคอนเทนต์ง่าย"] >= 80:
        return "ทำคลิปง่าย"
    return "เสริมตะกร้า"


def curate(category, max_price, min_commission, content_type, count, affiliate_id=""):
    products = load_products()
    filtered = filter_products(products, category, max_price, min_commission)

    if not filtered:
        return []

    # Score ทุกชิ้น
    scored = []
    for p in filtered:
        s6d = calculate_6d_score(p)
        scored.append((p, s6d))

    # เรียงตามคะแนนรวม
    scored.sort(key=lambda x: x[1]["total"], reverse=True)

    # จำกัดจำนวนตาม count
    top = scored[:min(count * 2, len(scored))]

    # กระจาย Role ให้สมดุล
    basket = []
    role_quota = {
        "ดึงคนเข้า": math.ceil(count * 0.20),
        "คอมดี":     math.ceil(count * 0.30),
        "ทำคลิปง่าย": math.ceil(count * 0.25),
        "ขายซ้ำ":    math.ceil(count * 0.15),
        "เสริมตะกร้า": math.ceil(count * 0.10),
    }
    role_count = {r: 0 for r in ROLES}
    used_ids = set()

    for p, s6d in top:
        if len(basket) >= count:
            break
        if p["id"] in used_ids:
            continue

        role = assign_role(p, s6d)
        if role_count[role] >= role_quota[role]:
            role = "เสริมตะกร้า"

        explanation = generate_explanation(p, s6d)
        content = generate_content_ideas(p, content_type)

        af_url = p["affiliate_url"]
        if affiliate_id:
            af_url = f"{af_url}?af_id={affiliate_id}"

        basket.append({
            "product": p,
            "role": role,
            "score_6d": s6d,
            "explanation": explanation,
            "content_ideas": content,
            "affiliate_url": af_url,
        })

        role_count[role] += 1
        used_ids.add(p["id"])

    return basket
