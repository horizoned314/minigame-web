import random
import string
from sockets import sio
from sockets.state_manager import state
from sockets.games.tictactoe import init_tictactoe

# ==========================================
# FUNGSI PENGAMAN BACKEND (DATA CONTRACT)
# Memastikan username SELALU berformat Teks (String) murni
# ==========================================
def extract_string_username(raw_user_data):
    if not raw_user_data:
        return "UNKNOWN_USER"
    # Jika data berupa dictionary/object (misal: {"username": "RAFIF", "id": 1})
    if isinstance(raw_user_data, dict):
        return str(raw_user_data.get("username", raw_user_data.get("name", "UNKNOWN_USER")))
    # Jika data berupa list/array
    if isinstance(raw_user_data, list):
        return str(raw_user_data[0]) if len(raw_user_data) > 0 else "UNKNOWN_USER"
    # Jika sudah string atau tipe lain
    return str(raw_user_data)

def generate_room_code(length=4):
    """Menghasilkan 4 digit kode unik acak (misal: XY99)"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))


@sio.on("create_room")
async def create_room(sid, data=None):
    """Skenario: Host membuat room via Kode."""
    raw_user = state.active_sockets.get(sid)
    if not raw_user:
        return {"status": "error", "message": "Sesi tidak valid"}
    
    # 🔒 Ekstrak menjadi Teks Murni
    username = extract_string_username(raw_user)
    
    room_code = generate_room_code()

    while room_code in state.active_rooms:
        room_code = generate_room_code()
    
    # Daftarkan room ke memori server dengan format teks yang bersih
    state.active_rooms[room_code] = {
        "host": username,
        "players": [username],
        "status": "waiting"
    }
    
    # Masukkan socket host ke dalam ruangan virtual
    await sio.enter_room(sid, room_code)
    print(f"🏠 Room {room_code} dibuat oleh {username}")
    
    return {"status": "success", "room_code": room_code}


@sio.on("join_room")
async def join_room(sid, data):
    """Skenario: Guest bergabung ke room menggunakan kode atau menerima invite."""
    raw_user = state.active_sockets.get(sid)
    username = extract_string_username(raw_user) # 🔒 Ekstrak menjadi Teks Murni
    
    room_code = data.get("room_code")
    
    if not room_code or room_code not in state.active_rooms:
        return {"status": "error", "message": "Kode Room tidak ditemukan"}
        
    room = state.active_rooms[room_code]
    
    if len(room["players"]) >= 2:
        return {"status": "error", "message": "Room sudah penuh!"}
        
    # Tambahkan player ke daftar jika belum ada
    if username not in room["players"]:
        room["players"].append(username)
        
    await sio.enter_room(sid, room_code)
    print(f"🚶 {username} bergabung ke Room {room_code}")
    
    # Jika room sudah terisi 2 orang, mulai game!
    if len(room["players"]) == 2:
        room["status"] = "playing"
        
        # Inisialisasi TicTacToe menggunakan teks murni
        room["tictactoe"] = init_tictactoe(room["players"][0], room["players"][1])
        
        # Kirim data ke Frontend (Sekarang dijamin 100% String)
        await sio.emit("trigger_game_start", {
            "message": "Lawan ditemukan! Game dimulai.",
            "room_code": room_code,
            "players": room["players"],          # Ini sekarang murni Array of Strings: ["RUUNA", "RAFIF"]
            "tictactoe_state": room["tictactoe"]
        }, room=room_code)
        
    return {"status": "success", "room_code": room_code}


@sio.on("send_invite_realtime")
async def send_invite_realtime(sid, data):
    """Skenario: Mengirim notifikasi invite pop-up secara real-time via Socket"""
    raw_user = state.active_sockets.get(sid)
    sender_username = extract_string_username(raw_user) # 🔒 Ekstrak menjadi Teks Murni
    
    target_username = data.get("target_username")
    room_code = data.get("room_code")
    
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