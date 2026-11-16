import json
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings

import models

from routers import auth, invites

import socketio
from sockets import sio
import sockets.connection
import sockets.chat
import sockets.invite_flow

# sockets/games
import sockets.games.tictactoe
from sockets.events_gartic import register_gartic_events
from sockets.events_photobooth import register_photobooth_events # Duplikasi import gartic dihapus

register_gartic_events(sio)
register_photobooth_events(sio)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API & WebSocket untuk Playground",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(invites.router)

@app.get("/")
async def root():
    return {
        "status": "online", 
        "project": settings.PROJECT_NAME,
        "message": "Server is up and running!"
    }


@app.get("/webrtc/ice-servers")
async def get_webrtc_ice_servers():
    """Expose ICE servers without baking TURN credentials into the frontend."""
    raw_servers = os.getenv("WEBRTC_ICE_SERVERS", "").strip()
    if raw_servers:
        try:
            ice_servers = json.loads(raw_servers)
            if not isinstance(ice_servers, list) or not all(
                isinstance(server, dict) and server.get("urls")
                for server in ice_servers
            ):
                raise ValueError("WEBRTC_ICE_SERVERS must be a JSON array of ICE server objects")
        except (json.JSONDecodeError, ValueError) as exc:
            raise ValueError(f"Invalid WEBRTC_ICE_SERVERS: {exc}") from exc
    else:
        # STUN can connect many network pairs, but TURN must be configured for
        # restrictive NATs and firewalls.
        ice_servers = [
            {"urls": "stun:stun.l.google.com:19302"},
            {"urls": "stun:stun1.l.google.com:19302"},
        ]

    return {"iceServers": ice_servers, "iceCandidatePoolSize": 4}

# --- BUNGKUS FASTAPI DENGAN SOCKET.IO ---
# Variabel `sio_app` ini yang akan dieksekusi oleh Uvicorn di Dockerfile
sio_app = socketio.ASGIApp(socketio_server=sio, other_asgi_app=app)
