from datetime import datetime, timezone
from sockets import sio
from sockets.state_manager import state

MAX_HISTORY = 100  # batas biar memory tidak bengkak kalau chat rame

@sio.on("send_message")
async def handle_send_message(sid, data):
    """
    Menerima pesan dari satu pemain dan menyebarkannya ke semua orang di room yang sama.
    Expected data from React: { "room_code": "XY99", "message": "Halo!" }
    """
    username = state.active_sockets.get(sid)
    room_code = data.get("room_code")
    message = data.get("message")

    if not username or not room_code or not message:
        return {"status": "error", "message": "Data tidak lengkap"}

    room = state.active_rooms.get(room_code)
    if not room:
        return {"status": "error", "message": "Room tidak ditemukan atau sudah ditutup"}

    if username not in room.get("players", []):
        return {"status": "error", "message": "Anda tidak tergabung dalam room ini"}

    chat_payload = {
        "sender": username,
        "message": message.strip(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    # Simpan ke histori room (in-memory, hilang saat room ditutup/server restart)
    history = room.setdefault("chat_history", [])
    history.append(chat_payload)
    if len(history) > MAX_HISTORY:
        history.pop(0)

    await sio.emit("receive_message", chat_payload, room=room_code)
    return {"status": "success"}


@sio.on("get_chat_history")
async def handle_get_chat_history(sid, data):
    """
    Dipanggil client saat ChatBox pertama kali mount, untuk ambil histori
    yang sudah ada di room (misal karena refresh atau baru gabung).
    Expected data: { "room_code": "XY99" }
    """
    room_code = data.get("room_code")
    room = state.active_rooms.get(room_code)

    if not room:
        return {"status": "error", "message": "Room tidak ditemukan"}

    return {"status": "success", "history": room.get("chat_history", [])}