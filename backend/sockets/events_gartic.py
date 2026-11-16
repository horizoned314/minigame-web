from datetime import datetime, timezone

from sockets.state_manager import state
from sockets.games.gartic import GarticRoom

active_gartic_games = {}


def _username_from_sid(sid):
    raw_user = state.active_sockets.get(sid)
    if not raw_user:
        return None
    if isinstance(raw_user, dict):
        return str(raw_user.get("username", raw_user.get("name", "")))
    return str(raw_user)


def _ensure_game(room_code, sio):
    """Ambil game Gartic; buat on-the-fly kalau karena satu dan lain hal belum ada."""
    if room_code in active_gartic_games:
        return active_gartic_games[room_code]

    room = state.active_rooms.get(room_code)
    if not room:
        return None

    players = room.get("players", [])
    if len(players) < 2:
        return None

    game = GarticRoom(
        room_code=room_code,
        player1=players[0],
        player2=players[1],
        sio=sio,
    )
    active_gartic_games[room_code] = game
    print(f"🎨 [GARTIC] Game dibuat on-the-fly untuk Room {room_code}")
    return game


def _is_room_player(room_code, username):
    if not room_code or not username:
        return False
    room = state.active_rooms.get(room_code)
    return bool(room and username in room.get("players", []))


def register_gartic_events(sio):

    @sio.on("init_gartic_game")
    async def init_gartic_game(sid, data=None):
        data = data or {}
        room_code = data.get("room_code")
        username = _username_from_sid(sid)

        if not _is_room_player(room_code, username):
            return {"status": "error", "message": "Room tidak ditemukan"}

        game = _ensure_game(room_code, sio)
        if not game:
            return {"status": "error", "message": "Pemain belum lengkap"}

        # Broadcast ke room supaya kedua klien langsung punya state yang sama
        # (broadcast_state juga menyembunyikan kata rahasia dari penebak)
        await game.broadcast_state()
        return {"status": "success"}

    @sio.on("gartic_action")
    async def handle_gartic_action(sid, data=None):
        data = data or {}
        room_code = data.get("room_code")
        action = data.get("action")
        username = _username_from_sid(sid)

        if not _is_room_player(room_code, username):
            return

        game = _ensure_game(room_code, sio)
        if not game:
            return

        if action == 'ready':
            await game.player_ready(username)

        elif action == 'set_custom_word':
            # Hanya penggambar yang boleh menentukan kata pada free round
            if username != game.current_drawer:
                return
            word = data.get("word")
            await game.set_custom_word(word)

    @sio.on("gartic_draw")
    async def handle_gartic_draw(sid, data=None):
        data = data or {}
        room_code = data.get("room_code")
        username = _username_from_sid(sid)

        if not _is_room_player(room_code, username):
            return

        game = active_gartic_games.get(room_code)
        if not game:
            return

        # Hanya penggambar aktif yang boleh mengirim coretan, dan hanya saat fase drawing
        if username != game.current_drawer or game.phase != 'drawing':
            return

        await sio.emit('gartic_draw_receive', {
            "type": data.get("type"),
            "x": data.get("x"),
            "y": data.get("y"),
            "color": data.get("color"),
            "size": data.get("size")
        }, room=room_code, skip_sid=sid)

    @sio.on("gartic_guess")
    async def handle_gartic_guess(sid, data=None):
        data = data or {}
        room_code = data.get("room_code")
        message = str(data.get("message", "")).strip()
        sender = _username_from_sid(sid)

        if not _is_room_player(room_code, sender) or not message:
            return

        game = active_gartic_games.get(room_code)
        is_correct = False

        if game:
            is_correct = await game.handle_guess(sender, message)

        # Chat biasa (pakai key `message` agar konsisten dengan ChatBox)
        await sio.emit("receive_message", {
            "sender": sender,
            "message": message,
            "text": message,
            "is_system": False,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }, room=room_code)

        # Notif Benar
        if is_correct:
            await sio.emit("receive_message", {
                "sender": "SYSTEM",
                "message": f"🎉 {sender} BERHASIL MENEBAK DENGAN BENAR!",
                "text": f"🎉 {sender} BERHASIL MENEBAK DENGAN BENAR!",
                "is_system": True,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }, room=room_code)
