from sockets.state_manager import state
from sockets.games.gartic import GarticRoom

# Penyimpanan aktif objek game Gartic di memori (Key: room_code, Value: GarticRoom instance)
active_gartic_games = {}

def register_gartic_events(sio):
    
    @sio.on("init_gartic_game")
    async def init_gartic_game(sid, data):
        """Dipanggil saat pemain masuk ke dalam layar permainan Gartic"""
        room_code = data.get("room_code")
        if not room_code or room_code not in state.active_rooms:
            return
            
        room_info = state.active_rooms[room_code]
        players = room_info["players"]
        
        # Buat instance game baru jika belum ada di dalam memori
        if room_code not in active_gartic_games:
            active_gartic_games[room_code] = GarticRoom(
                room_code=room_code,
                player1=players[0],
                player2=players[1],
                sio=sio
            )
            print(f"🎨 [GARTIC] Game dibuat untuk Room {room_code}")
        
        game = active_gartic_games[room_code]
        # Kirim data awal (state tutorial)
        await sio.emit('gartic_update', game.get_state(), to=sid)

    @sio.on("gartic_action")
    async def handle_gartic_action(sid, data):
        """Menangani aksi klik dari Frontend: tutorial 'ready' & 'set_custom_word'"""
        room_code = data.get("room_code")
        action = data.get("action")
        username = state.active_sockets.get(sid)
        
        game = active_gartic_games.get(room_code)
        if not game:
            return
            
        if action == 'ready' and username:
            await game.player_ready(username)
            
        elif action == 'set_custom_word':
            word = data.get("word")
            await game.set_custom_word(word)

    @sio.on("gartic_draw")
    async def handle_gartic_draw(sid, data):
        """Meneruskan aliran koordinat kanvas (start, draw, stop, clear) ke lawan"""
        room_code = data.get("room_code")
        if not room_code:
            return
            
        # PANTULKAN KE LAWAN: Panggil gartic_draw_receive dengan skip_sid=sid 
        # (Pelukis tidak menerima datanya sendiri karena sudah digambar lokal)
        await sio.emit('gartic_draw_receive', {
            "type": data.get("type"),
            "x": data.get("x"),
            "y": data.get("y"),
            "color": data.get("color"),
            "size": data.get("size")
        }, room=room_code, skip_sid=sid)

    @sio.on("gartic_guess")
    async def handle_gartic_guess(sid, data):
        """Menangani pesan dari ChatBox dan memeriksa validitas jawaban"""
        room_code = data.get("room_code")
        sender = data.get("sender")
        message = data.get("message", "")
        
        game = active_gartic_games.get(room_code)
        
        is_correct = False
        if game:
            # Periksa apakah teks yang diketik adalah jawaban tebakan yang sah
            is_correct = await game.handle_guess(sender, message)
        
        # 1. Kirim pesan ke kolom chat (agar tetap terlihat seperti chat biasa)
        await sio.emit("receive_message", {
            "sender": sender,
            "text": message,
            "is_system": False
        }, room=room_code)
        
        # 2. Jika tebakan BENAR, kirim notifikasi sistem otomatis ke dalam kolom chat
        if is_correct:
            await sio.emit("receive_message", {
                "sender": "SYSTEM",
                "text": f"🎉 {sender} BERHASIL MENEBAK KATA DENGAN BENAR!",
                "is_system": True
            }, room=room_code)

    @sio.on("disconnect")
    async def on_gartic_disconnect(sid):
        """Pembersihan otomatis jika pemain terputus saat bermain"""
        username = state.active_sockets.get(sid)
        for room_code, game in list(active_gartic_games.items()):
            if username in [game.p1, game.p2]:
                if game.timer_task:
                    game.timer_task.cancel()
                del active_gartic_games[room_code]
                print(f"🗑️ [GARTIC] Room {room_code} dihapus karena pemain disconnect.")
                break