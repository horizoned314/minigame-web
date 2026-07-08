class StateManager:
    def __init__(self):
        # Mapping username -> socket_id
        self.online_users: dict[str, str] = {}
        # Mapping socket_id -> username
        self.active_sockets: dict[str, str] = {}
        # Menyimpan data ruang bermain yang sedang aktif
        self.active_rooms: dict[str, dict] = {}

    def add_user(self, username: str, sid: str):
        self.online_users[username] = sid
        self.active_sockets[sid] = username

    def remove_user(self, sid: str) -> str | None:
        username = self.active_sockets.get(sid)
        if username:
            self.online_users.pop(username, None)
            self.active_sockets.pop(sid, None)
        return username

# Instansiasi objek global agar bisa diakses dari file lain
state = StateManager()