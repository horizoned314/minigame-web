import random
import string
from sockets import sio
from sockets.state_manager import state

def generate_room_code(length=4):
    """Menghasilkan 4 digit kode unik acak (misal: XY99)"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

@sio.on("create_room")
async def create_room(sid, data=None):
    """Skenario: Host membuat room via Kode."""
    username = state.active_sockets.get(sid)
    if not username:
        return {"status": "error", "message": "Sesi tidak valid"}
    
    room_code = generate_room_code()
    
    # Daftarkan room ke memori server
    state.active_rooms[room_code] = {
        "players": [username],
        "status": "waiting"
    }
    
    # Masukkan socket host ke dalam ruangan virtual
    sio.enter_room(sid, room_code)
    print(f"🏠 Room {room_code} dibuat oleh {username}")
    
    return {"status": "success", "room_code": room_code}

@sio.on("join_room")
async def join_room(sid, data):
    """Skenario: Guest bergabung ke room menggunakan kode atau menerima invite."""
    username = state.active_sockets.get(sid)
    room_code = data.get("room_code")
    
    if not room_code or room_code not in state.active_rooms:
        return {"status": "error", "message": "Kode Room tidak ditemukan"}
        
    room = state.active_rooms[room_code]
    
    if len(room["players"]) >= 2:
        return {"status": "error", "message": "Room sudah penuh!"}
        
    # Tambahkan player ke daftar jika belum ada
    if username not in room["players"]:
        room["players"].append(username)
        
    sio.enter_room(sid, room_code)
    print(f"🚶 {username} bergabung ke Room {room_code}")
    
    # Jika room sudah terisi 2 orang, mulai game!
    if len(room["players"]) == 2:
        room["status"] = "playing"
        await sio.emit("game_start", {
            "message": "Lawan ditemukan! Game dimulai.",
            "room_code": room_code, 
            "players": room["players"]
        }, room=room_code)
        
    return {"status": "success", "room_code": room_code}

@sio.on("send_invite_realtime")
async def send_invite_realtime(sid, data):
    """Skenario: Mengirim notifikasi invite pop-up secara real-time via Socket"""
    sender_username = state.active_sockets.get(sid)
    target_username = data.get("target_username")
    room_code = data.get("room_code") # Host biasanya membuat room_code dulu sebelum invite
    
    if not target_username or not room_code:
        return {"status": "error", "message": "Data tidak lengkap"}
        
    target_sid = state.online_users.get(target_username)
    
    if not target_sid:
        return {"status": "error", "message": f"Temanmu '{target_username}' sedang offline"}
    
    # Tembak notifikasi JAPRI hanya ke socket milik target
    await sio.emit("incoming_invite", {
        "from": sender_username,
        "room_code": room_code
    }, to=target_sid)
    
    print(f"✉️ Invite real-time dikirim: {sender_username} -> {target_username} (Room: {room_code})")
    return {"status": "success", "message": "Undangan terkirim!"}