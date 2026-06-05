from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from modules.curation.engine import curate

router = APIRouter(prefix="/api", tags=["curation"])


class CurateRequest(BaseModel):
    category: str = "ทั้งหมด"
    max_price: Optional[float] = None
    min_commission: float = 5.0
    content_type: str = "แก้ปัญหา"
    count: int = 20
    affiliate_id: Optional[str] = ""


@router.post("/curate")
def curate_basket(body: CurateRequest):
    basket = curate(
        category=body.category,
        max_price=body.max_price,
        min_commission=body.min_commission,
        content_type=body.content_type,
        count=body.count,
        affiliate_id=body.affiliate_id or "",
    )
    return {
        "total": len(basket),
        "category": body.category,
        "basket": basket,
    }
