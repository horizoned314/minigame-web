class StateManager:
    def __init__(self):
        # Mapping username -> socket_id
        self.online_users: dict[str, str] = {}
        # Mapping socket_id -> username
        self.active_sockets: dict[str, str] = {}
        # Menyimpan data ruang bermain yang sedang aktif
        self.active_rooms: dict[str, dict] = {}

    def add_user(self, username: str, sid: str):
        # Kalau user reconnect, buang mapping socket lama supaya tidak nyangkut
        old_sid = self.online_users.get(username)
        if old_sid and old_sid != sid:
            self.active_sockets.pop(old_sid, None)

        self.online_users[username] = sid
        self.active_sockets[sid] = username

    def remove_user(self, sid: str) -> str | None:
        username = self.active_sockets.get(sid)
        if not username:
            return None

        self.active_sockets.pop(sid, None)

        # Hanya hapus mapping online kalau SID ini masih SID aktif untuk user tsb.
        # Ini mencegah disconnect lama menghapus koneksi baru (kasus refresh / reconnect).
        if self.online_users.get(username) == sid:
            self.online_users.pop(username, None)

        return username

# Instansiasi objek global agar bisa diakses dari file lain
state = StateManager()
