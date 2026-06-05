import json
from pathlib import Path
from fastapi import APIRouter, Query
from typing import Optional
from modules.scoring.engine import calculate_score

router = APIRouter(prefix="/api/products", tags=["products"])

DATA_FILE = Path(__file__).parent.parent.parent / "data" / "mock_products.json"


def load_products():
    with open(DATA_FILE, encoding="utf-8") as f:
        products = json.load(f)
    for p in products:
        p["score"] = calculate_score(p["commission_rate"], p["sales_volume"], p["rating"])
    return products


# ⚠️ /categories และ /trending ต้องอยู่ก่อน /{product_id} เสมอ

@router.get("/categories")
def list_categories():
    products = load_products()
    cats = sorted(set(p["category"] for p in products))
    return {"categories": cats}


@router.get("/trending")
def list_trending():
    products = load_products()
    trending = [p for p in products if p.get("trending") and p.get("in_stock", True)]
    trending.sort(key=lambda p: p.get("score", 0), reverse=True)
    return {"trending": trending[:8]}


@router.get("")
def list_products(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    min_commission: Optional[float] = Query(None),
    sort_by: str = Query("score"),
    order: str = Query("desc"),
):
    products = load_products()

    if search:
        q = search.lower()
        products = [p for p in products if q in p["name"].lower() or q in p["brand"].lower()]
    if category:
        products = [p for p in products if p["category"] == category]
    if min_price is not None:
        products = [p for p in products if p["price"] >= min_price]
    if max_price is not None:
        products = [p for p in products if p["price"] <= max_price]
    if min_commission is not None:
        products = [p for p in products if p["commission_rate"] >= min_commission]

    reverse = order == "desc"
    if sort_by in ("score", "price", "commission_rate", "sales_volume", "rating"):
        products.sort(key=lambda p: p.get(sort_by, 0), reverse=reverse)

    return {"total": len(products), "products": products}


@router.get("/{product_id}")
def get_product(product_id: str):
    products = load_products()
    for p in products:
        if p["id"] == product_id:
            return p
    return {"error": "ไม่พบสินค้า"}, 404
