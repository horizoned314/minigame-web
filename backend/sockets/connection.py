import jwt
import socketio
from sockets import sio
from sockets.state_manager import state
from core.config import settings

@sio.on("connect")
async def connect(sid, environ, auth):
    """
    Dipanggil saat klien mencoba terhubung. 
    Klien HARUS mengirimkan dictionary `auth` berisi `token`.
    """
    if not auth or "token" not in auth:
        print(f"Koneksi Ditolak (No Token): {sid}")
        raise socketio.exceptions.ConnectionRefusedError("Token JWT tidak ditemukan")

    token = auth["token"]
    
    try:
        # Dekode dan validasi JWT
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username = payload.get("sub")
        
        if not username:
            raise ValueError("Username tidak ditemukan di payload JWT")

        # Catat user sebagai 'Online' di State Manager
        state.add_user(username, sid)
        print(f"🟢 User Terhubung: {username} (SID: {sid})")
        
        # Kirim sinyal konfirmasi ke klien yang baru terhubung
        await sio.emit("connected_success", {"message": f"Welcome, {username}!"}, to=sid)

    except jwt.ExpiredSignatureError:
        print(f"Koneksi Ditolak (Expired): {sid}")
        raise socketio.exceptions.ConnectionRefusedError("Token JWT sudah kedaluwarsa")
    except Exception as e:
        print(f"Koneksi Ditolak (Invalid): {sid} - {str(e)}")
        raise socketio.exceptions.ConnectionRefusedError("Token JWT tidak valid")

@sio.on("disconnect")
async def disconnect(sid):
    """Dipanggil saat klien terputus (close browser, refresh, internet mati)."""
    username = state.remove_user(sid)
    if username:
        print(f"🔴 User Terputus: {username} (SID: {sid})")