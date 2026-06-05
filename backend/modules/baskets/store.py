from datetime import datetime
import uuid

# เก็บข้อมูลในหน่วยความจำชั่วคราว (MVP — รีสตาร์ทแล้วข้อมูลหาย)
baskets: dict = {}


def create_basket(name: str, description: str = "") -> dict:
    basket_id = str(uuid.uuid4())[:8]
    basket = {
        "id": basket_id,
        "name": name,
        "description": description,
        "items": [],
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }
    baskets[basket_id] = basket
    return basket


def get_all_baskets() -> list:
    return list(baskets.values())


def get_basket(basket_id: str) -> dict | None:
    return baskets.get(basket_id)


def delete_basket(basket_id: str) -> bool:
    if basket_id in baskets:
        del baskets[basket_id]
        return True
    return False


def add_item(basket_id: str, product: dict, note: str = "") -> dict | None:
    basket = baskets.get(basket_id)
    if not basket:
        return None

    for item in basket["items"]:
        if item["product_id"] == product["id"]:
            return {"error": "สินค้านี้อยู่ในตะกร้าแล้ว"}

    item = {
        "id": str(uuid.uuid4())[:8],
        "product_id": product["id"],
        "product": product,
        "position": len(basket["items"]) + 1,
        "note": note,
        "added_at": datetime.now().isoformat(),
    }
    basket["items"].append(item)
    basket["updated_at"] = datetime.now().isoformat()
    return item


def remove_item(basket_id: str, item_id: str) -> bool:
    basket = baskets.get(basket_id)
    if not basket:
        return False
    original = len(basket["items"])
    basket["items"] = [i for i in basket["items"] if i["id"] != item_id]
    if len(basket["items"]) < original:
        basket["updated_at"] = datetime.now().isoformat()
        return True
    return False


def update_item(basket_id: str, item_id: str, note: str | None, position: int | None) -> dict | None:
    basket = baskets.get(basket_id)
    if not basket:
        return None
    for item in basket["items"]:
        if item["id"] == item_id:
            if note is not None:
                item["note"] = note
            if position is not None:
                item["position"] = position
            basket["updated_at"] = datetime.now().isoformat()
            return item
    return None
