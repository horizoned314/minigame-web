from sockets.state_manager import state
from sockets.games.photobooth import PhotoboothRoom

active_photobooths = {}


def _username_from_sid(sid):
    raw_user = state.active_sockets.get(sid)
    if not raw_user:
        return None
    if isinstance(raw_user, dict):
        return str(raw_user.get("username", raw_user.get("name", "")))
    return str(raw_user)


def _is_room_player(room_code, username):
    if not room_code or not username:
        return False
    room = state.active_rooms.get(room_code)
    return bool(room and username in room.get("players", []))


def register_photobooth_events(sio):

    @sio.on("init_photobooth_game")
    async def init_photobooth_game(sid, data=None):
        """Kirim state terbaru ke satu klien yang baru mount / resync."""
        data = data or {}
        room_code = data.get("room_code")
        username = _username_from_sid(sid)

        if not _is_room_player(room_code, username):
            return {"status": "error", "message": "Room tidak ditemukan"}

        if room_code not in active_photobooths:
            room = state.active_rooms.get(room_code)
            players = room.get("players", []) if room else []
            if len(players) < 2:
                return {"status": "error", "message": "Pemain belum lengkap"}
            active_photobooths[room_code] = PhotoboothRoom(room_code, players[0], players[1], sio)

        game = active_photobooths[room_code]
        await sio.emit('photobooth_update', game.get_state(), to=sid)
        return {"status": "success"}

    @sio.on("photobooth_action")
    async def handle_photobooth_action(sid, data=None):
        data = data or {}
        room_code = data.get("room_code")
        action = data.get("action")
        username = _username_from_sid(sid)

        if not _is_room_player(room_code, username):
            return

        # Inisialisasi on-the-fly jika instance belum ada (misal server baru restart)
        if room_code not in active_photobooths:
            players = state.active_rooms[room_code]["players"]
            if len(players) < 2:
                return
            active_photobooths[room_code] = PhotoboothRoom(room_code, players[0], players[1], sio)

        game = active_photobooths[room_code]

        if action == 'ready':
            await game.handle_ready(username)

        elif action == 'propose_frame':
            frame_id = data.get("frame_id")
            await game.propose_frame(username, frame_id)

        elif action == 'confirm_frame':
            agreed = data.get("agreed")
            await game.confirm_frame(agreed)

        elif action in ['retake_current_shot', 'next_shot', 'retake_all']:
            # skip_sid: pengirim sudah menerapkan aksi secara lokal.
            # Kalau server juga mengirim balik ke pengirim, aksi jalan dua kali
            # (misalnya foto ke-2 langsung loncat ke foto ke-3).
            await game.sync_action(action, skip_sid=sid)

    # === WEBRTC SIGNALING EVENTS ===
    @sio.on("webrtc_offer")
    async def handle_webrtc_offer(sid, data):
        room_code = data.get("room_code")
        if room_code:
            await sio.emit("webrtc_offer", data, room=room_code, skip_sid=sid)

    @sio.on("webrtc_answer")
    async def handle_webrtc_answer(sid, data):
        room_code = data.get("room_code")
        if room_code:
            await sio.emit("webrtc_answer", data, room=room_code, skip_sid=sid)

    @sio.on("webrtc_ice_candidate")
    async def handle_webrtc_ice(sid, data):
        room_code = data.get("room_code")
        if room_code:
            await sio.emit("webrtc_ice_candidate", data, room=room_code, skip_sid=sid)

    @sio.on("disconnect")
    async def on_photobooth_disconnect(sid):
        raw_user = state.active_sockets.get(sid)
        if not raw_user:
            return
            
        username = str(raw_user.get("username", raw_user)) if isinstance(raw_user, dict) else str(raw_user)
        
        for room_code, game in list(active_photobooths.items()):
            if username in [game.p1, game.p2]:
                del active_photobooths[room_code]
                print(f"📸 [PHOTOBOOTH] Room {room_code} dihapus karena player disconnect.")
                break
