const API_URL = "http://localhost:8000";

async function getBasket() {
  const { basket = [] } = await chrome.storage.local.get("basket");
  return basket;
}

async function saveBasket(basket) {
  await chrome.storage.local.set({ basket });
}

async function addProduct(product) {
  const basket = await getBasket();
  const exists = basket.find(p => p.id === product.id);
  if (exists) return { success: false, message: "สินค้านี้อยู่ในตะกร้าแล้ว" };
  product.added_at = new Date().toISOString();
  basket.push(product);
  await saveBasket(basket);
  return { success: true, count: basket.length };
}

async function removeProduct(productId) {
  const basket = await getBasket();
  const updated = basket.filter(p => p.id !== productId);
  await saveBasket(updated);
  return { count: updated.length };
}

async function clearBasket() {
  await saveBasket([]);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case "ADD_PRODUCT":
        sendResponse(await addProduct(msg.product));
        break;
      case "GET_BASKET":
        sendResponse(await getBasket());
        break;
      case "REMOVE_PRODUCT":
        sendResponse(await removeProduct(msg.productId));
        break;
      case "SET_BASKET":
        await saveBasket(msg.basket);
        sendResponse({ success: true });
        break;
      case "CLEAR_BASKET":
        await clearBasket();
        sendResponse({ success: true });
        break;
      case "SEND_TO_APP":
        sendResponse(await sendToApp(msg.basket, msg.affiliateId));
        break;
    }
  })();
  return true;
});

async function sendToApp(basket, affiliateId) {
  try {
    const res = await fetch(`${API_URL}/api/extension/basket`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products: basket, affiliate_id: affiliateId }),
    });
    const data = await res.json();
    return { success: true, data };
  } catch (e) {
    return { success: false, message: "เชื่อมต่อแอปไม่ได้ ตรวจสอบว่าแอปเปิดอยู่" };
  }
}