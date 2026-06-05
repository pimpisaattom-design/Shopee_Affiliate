def calculate_6d_score(product: dict) -> dict:
    price = product["price"]
    commission = product["commission_rate"]
    rating = product["rating"]
    sales = product["sales_volume"]
    review_count = product["review_count"]
    category = product["category"]
    in_stock = product.get("in_stock", True)

    # 1. ขายง่าย — ราคา + รีวิว + เรตติ้ง
    price_s = 100 if price <= 200 else (85 if price <= 500 else (65 if price <= 1000 else 40))
    review_s = min(review_count / 150, 100)
    rating_s = (rating / 5) * 100
    sell_easy = round(price_s * 0.40 + review_s * 0.35 + rating_s * 0.25, 1)

    # 2. คอมดี — commission_rate
    com_score = round(min(commission / 20 * 100, 100), 1)

    # 3. ทำคอนเทนต์ง่าย — หมวดหมู่ที่มี Pain Point ชัด
    content_map = {
        "ความงาม": 95, "ของใช้ส่วนตัว": 90, "สุขภาพ": 88,
        "ออฟฟิศซินโดรม": 92, "สัตว์เลี้ยง": 90, "แม่และเด็ก": 88,
        "ของใช้ในบ้าน": 80, "แฟชั่น": 78, "กีฬา": 80,
        "อาหารและเครื่องดื่ม": 75, "มือถืออุปกรณ์": 72,
        "อิเล็กทรอนิกส์": 65, "เครื่องใช้ไฟฟ้า": 65,
        "เฟอร์นิเจอร์": 55, "ยานยนต์": 70,
    }
    content_easy = content_map.get(category, 70)

    # 4. คนดูเข้าใจเร็ว — ราคาต่ำ = ตัดสินใจเร็ว
    understand = 100 if price <= 200 else (85 if price <= 500 else (65 if price <= 1500 else 45))

    # 5. ความเสี่ยงต่ำ — เรตติ้ง + stock + ยอดขายสม่ำเสมอ
    risk = round((rating / 5) * 70 + (25 if in_stock else 0) + (5 if rating >= 4.5 else 0), 1)

    # 6. คู่แข่งไม่แน่น — sweet spot ยอดขาย 3k-25k
    if 3000 <= sales <= 25000:
        competition = 88
    elif sales < 3000:
        competition = 62
    elif 25000 < sales <= 50000:
        competition = 72
    else:
        competition = 52

    dimensions = {
        "ขายง่าย": min(sell_easy, 100),
        "คอมดี": com_score,
        "ทำคอนเทนต์ง่าย": float(content_easy),
        "คนดูเข้าใจเร็ว": float(understand),
        "ความเสี่ยงต่ำ": min(risk, 100),
        "คู่แข่งไม่แน่น": float(competition),
    }

    weights = {
        "ขายง่าย": 0.25, "คอมดี": 0.25, "ทำคอนเทนต์ง่าย": 0.20,
        "คนดูเข้าใจเร็ว": 0.10, "ความเสี่ยงต่ำ": 0.10, "คู่แข่งไม่แน่น": 0.10,
    }

    total = round(sum(dimensions[k] * weights[k] for k in dimensions), 1)
    return {"dimensions": dimensions, "total": total}


def calculate_score(commission_rate, sales_volume, rating):
    """ใช้สำหรับ backward compatibility กับ products router เดิม"""
    max_sales = 70000
    c = min(commission_rate / 20 * 100, 100)
    s = min(sales_volume / max_sales * 100, 100)
    r = (rating / 5) * 100
    return round(c * 0.40 + s * 0.35 + r * 0.25, 1)
