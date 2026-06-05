import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from modules.baskets import store
from modules.scoring.engine import calculate_score

router = APIRouter(prefix="/api/baskets", tags=["baskets"])

DATA_FILE = Path(__file__).parent.parent.parent / "data" / "mock_products.json"


def find_product(product_id: str) -> dict | None:
    with open(DATA_FILE, encoding="utf-8") as f:
        products = json.load(f)
    for p in products:
        if p["id"] == product_id:
            p["score"] = calculate_score(p["commission_rate"], p["sales_volume"], p["rating"])
            return p
    return None


class CreateBasketBody(BaseModel):
    name: str
    description: Optional[str] = ""


class AddItemBody(BaseModel):
    product_id: str
    note: Optional[str] = ""


class UpdateItemBody(BaseModel):
    note: Optional[str] = None
    position: Optional[int] = None


@router.post("")
def create_basket(body: CreateBasketBody):
    return store.create_basket(body.name, body.description)


@router.get("")
def list_baskets():
    return {"baskets": store.get_all_baskets()}


@router.get("/{basket_id}")
def get_basket(basket_id: str):
    basket = store.get_basket(basket_id)
    if not basket:
        raise HTTPException(status_code=404, detail="ไม่พบตะกร้า")
    return basket


@router.delete("/{basket_id}")
def delete_basket(basket_id: str):
    if not store.delete_basket(basket_id):
        raise HTTPException(status_code=404, detail="ไม่พบตะกร้า")
    return {"message": "ลบตะกร้าแล้ว"}


@router.post("/{basket_id}/items")
def add_item(basket_id: str, body: AddItemBody):
    product = find_product(body.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="ไม่พบสินค้า")
    result = store.add_item(basket_id, product, body.note)
    if not result:
        raise HTTPException(status_code=404, detail="ไม่พบตะกร้า")
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.delete("/{basket_id}/items/{item_id}")
def remove_item(basket_id: str, item_id: str):
    if not store.remove_item(basket_id, item_id):
        raise HTTPException(status_code=404, detail="ไม่พบสินค้าในตะกร้า")
    return {"message": "ลบสินค้าออกจากตะกร้าแล้ว"}


@router.patch("/{basket_id}/items/{item_id}")
def update_item(basket_id: str, item_id: str, body: UpdateItemBody):
    result = store.update_item(basket_id, item_id, body.note, body.position)
    if not result:
        raise HTTPException(status_code=404, detail="ไม่พบสินค้าในตะกร้า")
    return result
# --- Extension Endpoint ---
class ExtensionBasketBody(BaseModel):
    products: list
    affiliate_id: Optional[str] = ""

@router.post("/extension/basket")
def receive_from_extension(body: ExtensionBasketBody):
    basket = store.create_basket(
        name="Extension Basket",
        description=f"Affiliate ID: {body.affiliate_id}"
    )
    basket_id = basket["id"]
    for p in body.products:
        store.add_item(basket_id, p, "")
    return {
        "success": True,
        "basket_id": basket_id,
        "count": len(body.products),
        "redirect_url": f"http://localhost:3000/baskets/{basket_id}"
    }
