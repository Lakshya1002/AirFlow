from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.api import api_router

app = FastAPI(
    title="AIR-FLOW API",
    description="Advanced SQL-Based Airline Revenue and Seat Utilization Intelligence System API",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root status
@app.get("/", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "system": "AIR-FLOW Intelligence System",
        "version": "1.0.0"
    }

# Include all API routes under /api
app.include_router(api_router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

