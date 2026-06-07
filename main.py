import os
import uvicorn
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.routes import router

app = FastAPI(title="Storytime")

for d in ["books", "uploads", "audio_output", "voice_clips"]:
    os.makedirs(d, exist_ok=True)

app.include_router(router, prefix="/api")


@app.get("/")
async def root():
    return FileResponse("frontend/picker.html")


@app.get("/reader/{book_id}")
async def reader_page(book_id: str):
    return FileResponse("frontend/reader.html")


@app.get("/reader")
async def picker_page():
    return FileResponse("frontend/picker.html")


@app.get("/parent")
async def parent_page():
    return FileResponse("frontend/index.html")


app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/audio", StaticFiles(directory="audio_output"), name="audio")
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
