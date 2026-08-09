import random
import string
from sockets import sio
from sockets.state_manager import state
from sockets.games.tictactoe import init_tictactoe

def extract_string_username(raw_user_data):
    if not raw_user_data:
        return "UNKNOWN_USER"
    if isinstance(raw_user_data, dict):
        return str(raw_user_data.get("username", raw_user_data.get("name", "UNKNOWN_USER")))
    if isinstance(raw_user_data, list):
        return str(raw_user_data[0]) if len(raw_user_data) > 0 else "UNKNOWN_USER"
    return str(raw_user_data)

def generate_room_code(length=4):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

@sio.on("create_room")
async def create_room(sid, data=None):
    raw_user = state.active_sockets.get(sid)
    if not raw_user:
        return {"status": "error", "message": "Sesi tidak valid"}
    
    username = extract_string_username(raw_user)
    room_code = generate_room_code()

    while room_code in state.active_rooms:
        room_code = generate_room_code()
    
    # DINAMIS: Tangkap jenis game dari React, default tictactoe
    game_type = data.get("game_type", "tictactoe") if data else "tictactoe"
    
    state.active_rooms[room_code] = {
        "host": username,
        "players": [username],
        "game_type": game_type, 
        "status": "waiting"
    }
    
    await sio.enter_room(sid, room_code)
    print(f"🏠 Room {room_code} ({game_type}) dibuat oleh {username}")
    
    return {"status": "success", "room_code": room_code, "game_type": game_type}

@sio.on("join_room")
async def join_room(sid, data):
    raw_user = state.active_sockets.get(sid)
    username = extract_string_username(raw_user) 
    
    room_code = data.get("room_code")
    
    if not room_code or room_code not in state.active_rooms:
        return {"status": "error", "message": "Kode Room tidak ditemukan"}
        
    room = state.active_rooms[room_code]
    
    if len(room["players"]) >= 2:
        return {"status": "error", "message": "Room sudah penuh!"}
        
    if username not in room["players"]:
        room["players"].append(username)
        
    await sio.enter_room(sid, room_code)
    print(f"🚶 {username} bergabung ke Room {room_code}")
    
    if len(room["players"]) == 2:
        room["status"] = "playing"
        game_type = room.get("game_type", "tictactoe")
        
        payload = {
            "message": "Lawan ditemukan! Game dimulai.",
            "room_code": room_code,
            "players": room["players"],
            "game_type": game_type
        }
        
        # ROUTING INIT GAME BERDASARKAN TIPE
        if game_type == "tictactoe":
            room["tictactoe"] = init_tictactoe(room["players"][0], room["players"][1])
            payload["tictactoe_state"] = room["tictactoe"]
        # Jika gartic, tidak dikirim state awal di sini (React akan memanggil init_gartic_game terpisah)
        
        await sio.emit("trigger_game_start", payload, room=room_code)
        
    return {"status": "success", "room_code": room_code}

@sio.on("send_invite_realtime")
async def send_invite_realtime(sid, data):
    raw_user = state.active_sockets.get(sid)
    sender_username = extract_string_username(raw_user)
    
    target_username = data.get("target_username")
    room_code = data.get("room_code")
    game_type = data.get("game_type", "tictactoe")
    
    if not target_username or not room_code:
        return {"status": "error", "message": "Data tidak lengkap"}
        
    target_sid = state.online_users.get(target_username)
    
    if not target_sid:
        return {"status": "error", "message": f"Temanmu '{target_username}' sedang offline"}
    
    await sio.emit("incoming_invite", {
        "from": sender_username,
        "room_code": room_code,
        "game_type": game_type
    }, to=target_sid)
    
    return {"status": "success", "message": "Undangan terkirim!"}