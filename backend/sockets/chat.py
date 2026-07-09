from datetime import datetime, timezone
from sockets import sio
from sockets.state_manager import state

@sio.on("send_message")
async def handle_send_message(sid, data):
    """
    Menerima pesan dari satu pemain dan menyebarkannya ke semua orang di room yang sama.
    Expected data from React: { "room_code": "XY99", "message": "Halo!" }
    """
    username = state.active_sockets.get(sid)
    room_code = data.get("room_code")
    message = data.get("message")
    
    # Validasi dasar
    if not username or not room_code or not message:
        return {"status": "error", "message": "Data tidak lengkap"}
        
    # Pastikan room-nya ada
    room = state.active_rooms.get(room_code)
    if not room:
        return {"status": "error", "message": "Room tidak ditemukan atau sudah ditutup"}
        
    # Validasi apakah user tersebut benar-benar ada di dalam room ini
    if username not in room.get("players", []):
        return {"status": "error", "message": "Anda tidak tergabung dalam room ini"}

    # Format pesan yang akan dikirim ke klien
    chat_payload = {
        "sender": username,
        "message": message.strip(),
        # Waktu server saat ini (dalam format ISO untuk di-parse React nantinya)
        "timestamp": datetime.now(timezone.utc).isoformat() 
    }
    
    # Broadcast HANYA ke ruangan tersebut
    await sio.emit("receive_message", chat_payload, room=room_code)
    
    # Opsional: Beri respons ke pengirim bahwa pesan sukses terkirim
    return {"status": "success"}