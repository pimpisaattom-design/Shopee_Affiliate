def generate_explanation(product: dict, score_6d: dict) -> dict:
    c = product["commission_rate"]
    r = product["rating"]
    p = product["price"]
    n = product["review_count"]
    s = product["sales_volume"]
    cat = product["category"]
    in_stock = product.get("in_stock", True)

    good, bad = [], []

    # Commission
    if c >= 18:   good.append(f"คอมสูงมาก ({c}%) ทำเงินได้ดีต่อคลิป")
    elif c >= 13: good.append(f"คอมดี ({c}%) คุ้มค่าเวลาที่ลงทุน")
    elif c >= 9:  good.append(f"คอมพอใช้ ({c}%)")
    elif c >= 5:  bad.append(f"คอมค่อนข้างต่ำ ({c}%) ควรหาตัวเลือกที่ให้คอมสูงกว่า")
    else:         bad.append(f"คอมต่ำมาก ({c}%) แทบไม่คุ้มเวลาที่ลงทุน")

    # Rating
    if r >= 4.8:   good.append(f"รีวิวดีมาก ({r}⭐) สร้างความเชื่อถือง่าย")
    elif r >= 4.5: good.append(f"รีวิวดี ({r}⭐) น่าแนะนำได้เลย")
    elif r < 4.2:  bad.append(f"เรตติ้งต่ำ ({r}⭐) เสี่ยงถูกถามว่าทำไมแนะนำของไม่ดี")

    # Price
    if p <= 200:       good.append(f"ราคาถูกมาก (฿{p:,}) คนตัดสินใจซื้อได้เลย")
    elif p <= 500:     good.append(f"ราคาไม่สูง (฿{p:,}) คนตัดสินใจง่าย")
    elif p >= 5000:    bad.append(f"ราคาสูง (฿{p:,}) คนลังเลนาน ปิดการขายยาก")

    # Review count
    if n >= 5000:   good.append(f"รีวิวเยอะมาก ({n:,} รีวิว) เอาไปอ้างอิงในคลิปได้เลย")
    elif n >= 1000: good.append(f"มีรีวิวพอ ({n:,} รีวิว) มีหลักฐานให้ดู")
    elif n < 300:   bad.append("รีวิวน้อยมาก ยังไม่มีหลักฐานให้คนเชื่อ")

    # Competition
    if s > 50000:          bad.append("ยอดขายสูงมาก คู่แข่งแน่น โดดเด่นยาก")
    elif 5000 <= s <= 25000: good.append("ยอดขายพอดี ไม่อิ่มตัว ยังมีโอกาสโดดเด่น")

    # Content potential by category
    easy_cats = ["ความงาม", "ออฟฟิศซินโดรม", "สัตว์เลี้ยง", "แม่และเด็ก", "ของใช้ส่วนตัว", "สุขภาพ"]
    if cat in easy_cats:
        good.append(f"หมวด {cat} มี Pain Point ชัด ทำ Before/After หรือแก้ปัญหาได้ง่าย")

    # Stock
    if not in_stock:
        bad.append("สินค้าหมดสต็อก คนอยากซื้อก็ซื้อไม่ได้")

    recommend = len(good) >= len(bad) and score_6d["total"] >= 55

    if recommend and len(good) >= 2:
        summary = "สินค้านี้น่าทำ เพราะ " + " และ".join(good[:2])
    elif not recommend and len(bad) >= 1:
        summary = "สินค้านี้ไม่แนะนำ เพราะ " + bad[0]
    else:
        summary = "สินค้านี้พอใช้ได้ ลองพิจารณาดู"

    return {
        "recommend": recommend,
        "good_reasons": good,
        "bad_reasons": bad,
        "summary": summary,
    }
