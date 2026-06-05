(function () {
  // รันใน MAIN world (ลงทะเบียนผ่าน manifest content_scripts world:"MAIN")
  // ใช้ fetch ของ Shopee ที่มี anti-bot SDK hooks → ได้ header ครบ ไม่โดน 403
  window.addEventListener("message", function (e) {
    if (!e.data || e.data.__sab !== "req") return;
    var url = e.data.url;
    var reqId = e.data.reqId;
    fetch(url, {
      credentials: "include",
      headers: {
        "accept": "application/json, text/plain, */*",
        "affiliate-program-type": "1"
      }
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      window.postMessage({ __sab: "res", reqId: reqId, data: data, ok: true }, "*");
    })
    .catch(function (err) {
      window.postMessage({ __sab: "res", reqId: reqId, ok: false, error: err.message }, "*");
    });
  });
})();
