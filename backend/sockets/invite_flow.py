import random
import string

from sockets import sio
from sockets.state_manager import state
from sockets.games.tictactoe import init_tictactoe

# ==========================
# GAME TYPE HELPERS
# ==========================

GAME_ALIASES = {
    "tictactoe": "tictactoe",
    "tic_tac_toe": "tictactoe",
    "tic-tac-toe": "tictactoe",
    "ttt": "tictactoe",
    "gartic": "gartic",
    "photobooth": "photobooth",
    "photo_booth": "photobooth",
    "photo-booth": "photobooth",
}

VALID_GAME_TYPES = {"tictactoe", "gartic", "photobooth"}


def normalize_game_type(value):
    """Ubah semua variasi nama game menjadi satu id kanonik.

    Nilai kosong/tidak dikenal sengaja mengembalikan None (bukan Tic Tac Toe).
    Fallback diam-diam ke Tic Tac Toe adalah penyebab undangan Gartic malah
    membuka Tic Tac Toe.
    """
    if value is None:
        return None
    key = str(value).strip().lower()
    if not key:
        return None
    return GAME_ALIASES.get(key)


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


# ==========================
# GAME INSTANCE HELPERS
# ==========================

def get_or_create_game_state(room_code, room):
    """
    Pastikan instance game untuk sebuah room sudah ada, lalu kembalikan
    state yang siap dimasukkan ke payload trigger_game_start.
    """
    game_type = room.get("game_type", "tictactoe")
    players = room.get("players", [])

    if len(players) < 2:
        return {}

    if game_type == "tictactoe":
        if "tictactoe" not in room:
            room["tictactoe"] = init_tictactoe(players[0], players[1])
        return {"tictactoe_state": room["tictactoe"]}

    if game_type == "gartic":
        # Import lokal untuk menghindari circular import saat modul pertama kali dimuat
        from sockets.games.gartic import GarticRoom
        from sockets.events_gartic import active_gartic_games

        if room_code not in active_gartic_games:
            active_gartic_games[room_code] = GarticRoom(
                room_code=room_code,
                player1=players[0],
                player2=players[1],
                sio=sio,
            )
            print(f"🎨 [GARTIC] Game dibuat untuk Room {room_code}")
        return {"gartic_state": active_gartic_games[room_code].get_state()}

    if game_type == "photobooth":
        from sockets.games.photobooth import PhotoboothRoom
        from sockets.events_photobooth import active_photobooths

        if room_code not in active_photobooths:
            active_photobooths[room_code] = PhotoboothRoom(
                room_code=room_code,
                player1=players[0],
                player2=players[1],
                sio=sio,
            )
            print(f"📸 [PHOTOBOOTH] Game dibuat untuk Room {room_code}")
        return {"photobooth_state": active_photobooths[room_code].get_state()}

    return {}


def discard_game_instance(room_code):
    """Hapus instance game + state yang menempel pada sebuah room."""
    from sockets.events_gartic import active_gartic_games
    from sockets.events_photobooth import active_photobooths

    gartic_game = active_gartic_games.pop(room_code, None)
    if gartic_game and getattr(gartic_game, "timer_task", None):
        gartic_game.timer_task.cancel()

    active_photobooths.pop(room_code, None)

    room = state.active_rooms.get(room_code)
    if room:
        room.pop("tictactoe", None)
        room.pop("ready_players", None)


def build_start_payload(room_code, room):
    game_type = room.get("game_type", "tictactoe")
    players = list(room.get("players", []))
    p1_name = players[0] if len(players) > 0 else ""
    p2_name = players[1] if len(players) > 1 else ""

    payload = {
        "message": "Lawan ditemukan! Game dimulai.",
        "room_code": room_code,
        "players": players,
        "game_type": game_type,
        "p1_name": p1_name,
        "p2_name": p2_name,
    }
    payload.update(get_or_create_game_state(room_code, room))
    return payload


# ==========================
# ROOM LIFECYCLE
# ==========================

async def remove_user_from_room(sid, username, room_code, notify=True):
    room = state.active_rooms.get(room_code)

    # Selalu keluarkan socket dari Socket.IO room, walau room-nya sudah tidak ada
    await sio.leave_room(sid, room_code)

    if not room:
        return

    players = room.get("players", [])
    if username in players:
        players.remove(username)

    if not players:
        state.active_rooms.pop(room_code, None)
        discard_game_instance(room_code)
        print(f"🗑️ Room {room_code} dihapus karena sudah kosong")
        return

    # Salah satu pemain keluar dari room yang sedang dipakai:
    # reset permainan supaya tidak ada state nyangkut, lalu beri tahu lawan.
    if room.get("host") == username:
        room["host"] = players[0]
    room["status"] = "waiting"
    discard_game_instance(room_code)

    if notify:
        await sio.emit(
            "opponent_left",
            {
                "room_code": room_code,
                "username": username,
                "reason": "left",
            },
            room=room_code,
        )

    print(f"🚪 {username} keluar dari Room {room_code}")


async def cleanup_user_rooms(sid, username):
    """Keluarkan user dari semua room yang masih mencatat dirinya."""
    for room_code, room in list(state.active_rooms.items()):
        if username in room.get("players", []):
            await remove_user_from_room(sid, username, room_code)


# ==========================
# SOCKET EVENTS
# ==========================

@sio.on("create_room")
async def create_room(sid, data=None):
    raw_user = state.active_sockets.get(sid)
    if not raw_user:
        return {"status": "error", "message": "Sesi tidak valid. Silakan login ulang."}

    username = extract_string_username(raw_user)

    game_type = normalize_game_type(data.get("game_type") if data else None)
    if game_type not in VALID_GAME_TYPES:
        return {"status": "error", "message": "Jenis game tidak dikenal"}

    # Jangan biarkan user membuat room baru sambil masih nyangkut di room lama
    await cleanup_user_rooms(sid, username)

    room_code = generate_room_code()

    while room_code in state.active_rooms:
        room_code = generate_room_code()

    state.active_rooms[room_code] = {
        "host": username,
        "players": [username],
        "game_type": game_type,
        "status": "waiting",
    }

    await sio.enter_room(sid, room_code)
    print(f"🏠 Room {room_code} ({game_type}) dibuat oleh {username}")

    return {"status": "success", "room_code": room_code, "game_type": game_type}


@sio.on("join_room")
async def join_room(sid, data=None):
    raw_user = state.active_sockets.get(sid)
    if not raw_user:
        return {"status": "error", "message": "Sesi tidak valid. Silakan login ulang."}

    username = extract_string_username(raw_user)
    data = data or {}
    room_code = str(data.get("room_code", "")).strip().upper()

    if not room_code or room_code not in state.active_rooms:
        return {"status": "error", "message": "Kode Room tidak ditemukan"}

    room = state.active_rooms[room_code]
    players = room.setdefault("players", [])

    # Kasus rejoin / socket reconnect
    if username in players:
        await sio.enter_room(sid, room_code)
        if len(players) >= 2:
            payload = build_start_payload(room_code, room)
            await sio.emit("trigger_game_start", payload, to=sid)
        return {"status": "success", "room_code": room_code}

    if len(players) >= 2:
        return {"status": "error", "message": "Room sudah penuh!"}

    # Kalau user masih tercatat di room lain, bersihkan dulu
    await cleanup_user_rooms(sid, username)

    players.append(username)
    await sio.enter_room(sid, room_code)
    print(f"🚶 {username} bergabung ke Room {room_code}")

    if len(players) == 2:
        room["status"] = "playing"
        payload = build_start_payload(room_code, room)

        # Kedua pemain mendapat event yang sama, lengkap dengan tipe game + state-nya
        await sio.emit("trigger_game_start", payload, room=room_code)

    return {"status": "success", "room_code": room_code}


@sio.on("leave_room")
async def leave_room(sid, data=None):
    raw_user = state.active_sockets.get(sid)
    username = extract_string_username(raw_user)

    data = data or {}
    room_code = data.get("room_code")

    if room_code:
        await remove_user_from_room(sid, username, room_code)
    else:
        await cleanup_user_rooms(sid, username)

    return {"status": "success"}


@sio.on("send_invite_realtime")
async def send_invite_realtime(sid, data=None):
    raw_user = state.active_sockets.get(sid)
    sender_username = extract_string_username(raw_user)

    data = data or {}
    target_username = data.get("target_username")
    room_code = data.get("room_code")
    game_type = normalize_game_type(data.get("game_type"))

    if not target_username or not room_code:
        return {"status": "error", "message": "Data tidak lengkap"}

    target_sid = state.online_users.get(target_username)

    if not target_sid:
        return {"status": "error", "message": f"Temanmu '{target_username}' sedang offline"}

    await sio.emit("incoming_invite", {
        "from": sender_username,
        "room_code": room_code,
        "game_type": game_type,
    }, to=target_sid)

    return {"status": "success", "message": "Undangan terkirim!"}
