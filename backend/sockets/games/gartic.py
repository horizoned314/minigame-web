# logic gartic
import asyncio
import random

# Kata rahasia bawaan server untuk Ronde 1 & 2
DEFAULT_WORD_BANK = [
    "PIZZA", "ROKET", "PENGUIN", "GITROW", "KUCING", "TELEVISI", 
    "PESAWAT", "SEPAKBOLA", "MATAHARI", "KAMERA", "LAPTOP", "SEPEDA"
]

class GarticRoom:
    def __init__(self, room_code, player1, player2, sio):
        self.room_code = room_code
        self.p1 = player1
        self.p2 = player2
        self.sio = sio
        
        # State sesuai dengan ekspektasi Frontend React
        self.round = 1
        self.scores = {self.p1: 0, self.p2: 0}
        self.phase = 'tutorial'  # tutorial -> setup -> drawing -> guessing -> round_over
        self.is_game_over = False
        self.timer = 0
        
        # Tutorial & kesiapan pemain
        self.ready_players = []
        
        # Data ronde
        self.secret_word = ""
        self.has_guessed = False
        self.current_drawer = self.p1
        self.current_guesser = self.p2
        
        # Task latar belakang (Asyncio Timer)
        self.timer_task = None

    def get_state(self, should_clear_canvas=False):
        """Membungkus state untuk dikirim ke frontend via 'gartic_update'"""
        return {
            "round": self.round,
            "scores": self.scores,
            "phase": self.phase,
            "is_game_over": self.is_game_over,
            "timer": self.timer,
            "ready_players": self.ready_players,
            "p1_ready": self.p1 in self.ready_players,
            "p2_ready": self.p2 in self.ready_players,
            "secret_word": self.secret_word,
            "has_guessed": self.has_guessed,
            "should_clear_canvas": should_clear_canvas
        }

    async def broadcast_state(self, should_clear_canvas=False):
        """Mengirim pembaruan state ke kedua pemain di dalam room"""
        await self.sio.emit('gartic_update', self.get_state(should_clear_canvas), room=self.room_code)

    def set_drawer_and_guesser(self):
        """Mengatur siapa yang menggambar berdasarkan angka ronde"""
        if self.round % 2 != 0:
            self.current_drawer = self.p1
            self.current_guesser = self.p2
        else:
            self.current_drawer = self.p2
            self.current_guesser = self.p1

    async def player_ready(self, username):
        """Dipanggil saat tombol [MENGERTI] di tutorial ditekan"""
        if username not in self.ready_players:
            self.ready_players.append(username)
            await self.broadcast_state()
            
            # Jika kedua pemain sudah siap, mulai ronde 1
            if len(self.ready_players) >= 2:
                await asyncio.sleep(0.5)
                await self.start_new_round()

    async def start_new_round(self):
        """Memulai ronde baru (atau mengakhiri permainan jika sudah ronde > 4)"""
        if self.round > 4:
            self.is_game_over = True
            await self.broadcast_state()
            return

        self.set_drawer_and_guesser()
        self.has_guessed = False

        # Cek apakah masuk fase Free Round (Ronde 3 & 4 - Set manual oleh pemain)
        if self.round == 3 or self.round == 4:
            self.phase = 'setup'
            self.secret_word = ""
            await self.broadcast_state(should_clear_canvas=True)
            # Menunggu 'set_custom_word' dipicu dari frontend (tanpa timer)
        else:
            # Ronde 1 & 2 menggunakan kata acak dari server
            self.secret_word = random.choice(DEFAULT_WORD_BANK)
            await self.start_drawing_phase()

    async def set_custom_word(self, word):
        """Dijalankan ketika penggambar mengirim kata custom (Ronde 3/4)"""
        if self.phase == 'setup' and word:
            self.secret_word = word.upper().strip()
            await self.start_drawing_phase()

    async def start_drawing_phase(self):
        """Mulai Fase Drawing (30 Detik - Kanvas penebak dikunci dari React)"""
        if self.timer_task:
            self.timer_task.cancel()

        self.phase = 'drawing'
        self.timer = 30
        await self.broadcast_state(should_clear_canvas=True)

        # Jalankan countdown otomatis server
        self.timer_task = asyncio.create_task(self._run_timer(
            duration=30,
            next_action=self.start_guessing_phase
        ))

    async def start_guessing_phase(self):
        """Mulai Fase Guessing (Kanvas penebak dibuka)"""
        if self.timer_task:
            self.timer_task.cancel()

        self.phase = 'guessing'
        self.timer = 30  # Waktu menebak
        await self.broadcast_state()

        self.timer_task = asyncio.create_task(self._run_timer(
            duration=30,
            next_action=self.end_round
        ))

    async def handle_guess(self, sender, message):
        """Memeriksa apakah pesan yang diketik di ChatBox adalah jawaban yang benar"""
        if self.phase != 'guessing' or sender != self.current_guesser or self.has_guessed:
            return False

        # Sanitasi teks (hapus spasi ekstra dan ubah ke huruf besar)
        clean_msg = message.strip().upper()
        
        if clean_msg == self.secret_word:
            self.has_guessed = True
            # Hitung skor berdasarkan sisa waktu (makin cepat makin banyak poin)
            bonus_time = self.timer
            self.scores[self.current_guesser] += 10 + int(bonus_time * 0.5)
            self.scores[self.current_drawer] += 5  # Pelukis dapat bonus karena menggambar dengan jelas
            
            # Akhiri ronde karena sudah tertebak
            if self.timer_task:
                self.timer_task.cancel()
            
            await asyncio.sleep(0.5)
            await self.end_round()
            return True
        
        return False

    async def end_round(self):
        """Fase transisi setelah ronde habis/berhasil ditebak"""
        if self.timer_task:
            self.timer_task.cancel()

        self.phase = 'round_over'
        self.timer = 5  # Transisi 5 detik sebelum ronde berikutnya
        await self.broadcast_state()

        self.timer_task = asyncio.create_task(self._run_timer(
            duration=5,
            next_action=self.advance_round
        ))

    async def advance_round(self):
        """Maju ke ronde berikutnya"""
        self.round += 1
        await self.start_new_round()

    async def _run_timer(self, duration, next_action):
        """Loop internal untuk menjaga timer server sinkron dengan timer lokal React"""
        try:
            for remaining in range(duration, -1, -1):
                self.timer = remaining
                # Sinkronkan dengan klien setiap 5 detik agar hemat bandwidth
                if remaining % 5 == 0 or remaining <= 3:
                    await self.broadcast_state()
                await asyncio.sleep(1)
            
            # Setelah timer habis, eksekusi fase berikutnya
            await next_action()
        except asyncio.CancelledError:
            pass  # Timer dibatalkan karena pemain menebak atau interupsi lain