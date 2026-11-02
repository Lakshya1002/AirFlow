"""
AIR-FLOW Backend — FastAPI Application Entry Point

Starts the FastAPI server with CORS, routing, and database initialization.
"""

import uvicorn

# Main entry point — full implementation in Phase 3
if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
