# mengurus aksi tictactoe
import random
from sockets import sio
from sockets.state_manager import state

# Kombinasi garis kemenangan (Index array 0-8)
WINNING_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], # Horisontal
    [0, 3, 6], [1, 4, 7], [2, 5, 8], # Vertikal
    [0, 4, 8], [2, 4, 6]             # Diagonal
]

def init_tictactoe(player1, player2):
    """Fungsi untuk membuat state awal game saat room pertama kali terbentuk"""
    players = [player1, player2]
    random.shuffle(players) # Acak siapa yang jadi X dan O di ronde 1
    
    return {
        "board": [None] * 9,
        "player_x": players[0], # X selalu jalan duluan
        "player_o": players[1],
        "current_turn": players[0],
        "scores": {player1: 0, player2: 0},
        "round": 1,
        "round_winner": None,
        "is_game_over": False,
        "final_message": ""
    }

def check_winner(board):
    for a, b, c in WINNING_LINES:
        if board[a] and board[a] == board[b] and board[a] == board[c]:
            return board[a] # Return 'X' atau 'O'
    if None not in board:
        return 'DRAW'
    return None

@sio.on("tictactoe_move")
async def handle_move(sid, data):
    username = state.active_sockets.get(sid)
    room_code = data.get("room_code")
    index = data.get("index")
    
    room = state.active_rooms.get(room_code)
    if not room or "tictactoe" not in room:
        return
        
    game = room["tictactoe"]
    
    # Validasi Keamanan: Abaikan jika bukan giliran, kotak sudah terisi, atau game usai
    if game["current_turn"] != username or game["board"][index] is not None or game["round_winner"]:
        return
        
    # Tandai papan
    marker = 'X' if username == game["player_x"] else 'O'
    game["board"][index] = marker
    
    # Cek Pemenang
    winner_marker = check_winner(game["board"])
    
    if winner_marker:
        if winner_marker == 'DRAW':
            game["round_winner"] = 'DRAW'
        else:
            winner_name = game["player_x"] if winner_marker == 'X' else game["player_o"]
            game["round_winner"] = winner_name
            game["scores"][winner_name] += 1 # Tambah skor
            
        # Cek apakah Match selesai (Best of 3)
        if game["round"] >= 3:
            game["is_game_over"] = True
            p1, p2 = game["player_x"], game["player_o"]
            if game["scores"][p1] > game["scores"][p2]:
                game["final_message"] = f"{p1.upper()} WINS THE MATCH!"
            elif game["scores"][p2] > game["scores"][p1]:
                game["final_message"] = f"{p2.upper()} WINS THE MATCH!"
            else:
                game["final_message"] = "MATCH ENDS IN A TIE!"
    else:
        # Ganti Giliran
        game["current_turn"] = game["player_x"] if username == game["player_o"] else game["player_o"]
        
    # Pancarkan data terbaru ke kedua pemain
    await sio.emit("tictactoe_update", game, room=room_code)

@sio.on("tictactoe_action")
async def handle_action(sid, data):
    """Menangani tombol Next Round dan Rematch"""
    room_code = data.get("room_code")
    action = data.get("action")
    room = state.active_rooms.get(room_code)
    
    if not room or "tictactoe" not in room:
        return
        
    game = room["tictactoe"]
    
    if action == "next_round" and game["round"] < 3:
        game["round"] += 1
        game["board"] = [None] * 9
        game["round_winner"] = None
        # Aturan Giliran: Ronde genap dimulai oleh O, ronde ganjil oleh X
        game["current_turn"] = game["player_o"] if game["round"] % 2 == 0 else game["player_x"]
        
    elif action == "rematch":
        # Reset ulang total state
        game.update(init_tictactoe(game["player_x"], game["player_o"]))

    await sio.emit("tictactoe_update", game, room=room_code)