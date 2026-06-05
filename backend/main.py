from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from modules.products.router import router as products_router
from modules.baskets.router import router as baskets_router
from modules.export.router import router as export_router
from modules.curation.router import router as curation_router
from modules.curation.extension_router import router as extension_router

app = FastAPI(title="Shopee Affiliate Basket Manager API", version="1.0.0")

ALLOWED = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://affiliate.shopee.co.th",
    "https://shopee.co.th",
]

class CORSMiddlewareCustom(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin", "")
        is_allowed = (
            origin in ALLOWED
            or origin.startswith("chrome-extension://")
            or origin.endswith(".vercel.app")  # รองรับ Vercel deploy
        )

        if request.method == "OPTIONS":
            response = Response()
            if is_allowed:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
                response.headers["Access-Control-Allow-Credentials"] = "true"
            return response

        response = await call_next(request)
        if is_allowed:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

app.add_middleware(CORSMiddlewareCustom)

app.include_router(products_router)
app.include_router(baskets_router)
app.include_router(export_router)
app.include_router(curation_router)
app.include_router(extension_router)

@app.get("/")
def root():
    return {"message": "Shopee Affiliate API พร้อมแล้ว ✅"}