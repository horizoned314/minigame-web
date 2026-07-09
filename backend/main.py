from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings

import models

from routers import auth 

import socketio
from sockets import sio
import sockets.connection

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API & WebSocket untuk Playground",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    #allow_origins=settings.CORS_ORIGINS,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- TAMBAHKAN BARIS INI UNTUK MENDAFTARKAN ROUTER ---
app.include_router(auth.router)

@app.get("/")
async def root():
    return {
        "status": "online", 
        "project": settings.PROJECT_NAME,
        "message": "Server is up and running!"
    }

# --- BUNGKUS FASTAPI DENGAN SOCKET.IO ---
# Variabel `sio_app` ini yang akan dieksekusi oleh Uvicorn
sio_app = socketio.ASGIApp(socketio_server=sio, other_asgi_app=app)