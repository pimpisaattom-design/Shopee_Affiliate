TEMPLATES = {
    "รีวิวก่อน-หลัง": {
        "hook": "ก่อนจะบอกว่าดี ขอโชว์ผลจริงก่อนเลย...",
        "pov": "POV: เพิ่งลองสินค้านี้ แล้วไม่อยากกลับไปใช้ของเดิมแล้ว",
        "script": "เปิดด้วย Pain Point → โชว์ Before → ใช้สินค้า → โชว์ After → บอกราคา + ลิงก์",
        "camera": "ถ่ายใกล้ texture + วาง Before/After side-by-side",
        "selling": "ใครมีปัญหาแบบนี้อยู่ ลองดูก่อนนะ ฉันก็ไม่เชื่อจนกว่าจะลอง",
    },
    "แก้ปัญหา": {
        "hook": "ใครมีปัญหาเรื่องนี้บ้าง? ฉันเจอวิธีแก้แล้ว...",
        "pov": "POV: เพิ่งค้นพบว่าปัญหาที่ทรมานมาตลอดแก้ได้ง่ายมาก",
        "script": "เปิดด้วยปัญหาที่คนเจอ → อธิบายว่าแก้ยังไง → โชว์สินค้า → บอกผล → ราคา + ลิงก์",
        "camera": "ถ่ายแบบ talking head + insert สินค้า + โชว์การใช้งานจริง",
        "selling": "ไม่ต้องทนต่อไปแล้ว ของแค่นี้แก้ได้เลย",
    },
    "Unboxing": {
        "hook": "สั่งมาแล้ว มาดูกันว่าของข้างในเป็นยังไง...",
        "pov": "POV: กล่องมาแล้ว! เปิดด้วยกันเลย",
        "script": "โชว์กล่อง → เปิดกล่อง → ดูแต่ละชิ้น → First impression → บอกราคา + ลิงก์",
        "camera": "ถ่ายบนโต๊ะ overhead shot + close-up แต่ละชิ้น + reaction หน้า",
        "selling": "ของออกมาตรงปก ไม่ผิดหวัง คุ้มกับราคาที่จ่ายไป",
    },
    "TikTok สั้น": {
        "hook": "สินค้านี้ทำให้ฉัน... (15 วิ รู้เรื่องเลย)",
        "pov": "POV: เจอของที่ชีวิตต้องมี ราคาแค่นี้",
        "script": "Hook 3วิ → Problem 5วิ → Solution/สินค้า 10วิ → CTA 2วิ = รวม 20วิ",
        "camera": "แสง + พื้นหลังสะอาด + ถ่ายแนวตั้ง + text overlay",
        "selling": "Link in bio เลย ก่อนของหมด",
    },
}


def generate_content_ideas(product: dict, content_type: str) -> dict:
    name = product["name"]
    price = product["price"]
    cat = product["category"]
    tmpl = TEMPLATES.get(content_type, TEMPLATES["แก้ปัญหา"])

    hashtags = [f"#{cat}", "#แอฟฟิลิเอท", "#รีวิว", "#Shopee", "#ของดีบอกต่อ"]
    if price <= 300:
        hashtags.append("#ของถูกดี")
    if "ความงาม" in cat or "สกิน" in name.lower():
        hashtags += ["#สกินแคร์", "#ครีม"]
    if cat == "สัตว์เลี้ยง":
        hashtags += ["#แมว", "#สัตว์เลี้ยง"]

    caption = (
        f"เจอแล้ว! {name} ราคาแค่ ฿{price:,} บาท 🔥\n"
        f"✅ {tmpl['selling']}\n"
        f"🛒 กดลิงก์ใน bio ได้เลย\n"
        f"{' '.join(hashtags[:6])}"
    )

    return {
        "hook": tmpl["hook"],
        "pov": tmpl["pov"],
        "script": tmpl["script"],
        "camera_angle": tmpl["camera"],
        "selling_line": tmpl["selling"],
        "caption": caption,
        "hashtags": hashtags[:8],
    }
