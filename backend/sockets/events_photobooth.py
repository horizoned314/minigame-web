from sockets.state_manager import state
from sockets.games.photobooth import PhotoboothRoom

active_photobooths = {}

def register_photobooth_events(sio):
    
    @sio.on("photobooth_action")
    async def handle_photobooth_action(sid, data):
        room_code = data.get("room_code")
        action = data.get("action")
        
        raw_user = state.active_sockets.get(sid)
        username = str(raw_user.get("username", raw_user)) if isinstance(raw_user, dict) else str(raw_user)
        
        if not room_code or room_code not in state.active_rooms:
            return
            
        # Inisialisasi on-the-fly jika instance belum ada
        if room_code not in active_photobooths:
            room_info = state.active_rooms[room_code]
            players = room_info["players"]
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
            await game.sync_action(action)

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
