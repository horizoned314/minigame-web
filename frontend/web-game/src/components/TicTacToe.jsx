import React, { useState, useEffect } from 'react';
import ChatBox from './ChatBox';
import { socket } from '../socket'; // <-- Impor saklar socket yang baru kita buat

// Tambahkan prop roomCode dan currentUser dari Dashboard
function TicTacToe({ player1Name, player2Name, currentUser, roomCode, onBackToDashboard }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [currentTurn, setCurrentTurn] = useState(null); 
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [roundWinner, setRoundWinner] = useState(null); 
  const [isGameOver, setIsGameOver] = useState(false);
  const [finalWinnerMessage, setFinalWinnerMessage] = useState('');

  // 1. DENGARKAN UPDATE DARI SERVER BACKEND
  useEffect(() => {
    socket.on('tictactoe_update', (gameState) => {
      setBoard(gameState.board);
      setCurrentTurn(gameState.current_turn);
      setRound(gameState.round);
      
      // Backend mengirim skor berdasarkan username asli: { "ruuna": 1, "horizon": 0 }
      // Kita konversi balik ke format { p1, p2 } agar UI tidak perlu diubah
      setScores({
        p1: gameState.scores[player1Name] || 0,
        p2: gameState.scores[player2Name] || 0
      });

      setRoundWinner(gameState.round_winner);
      setIsGameOver(gameState.is_game_over);
      setFinalWinnerMessage(gameState.final_message || '');
    });

    return () => {
      // Bersihkan pendengar saat komponen ditutup
      socket.off('tictactoe_update');
    };
  }, [player1Name, player2Name]);

  // 2. KIRIM KLIK KE SERVER
  const handleCellClick = (index) => {
    // Jangan izinkan klik jika kotak sudah terisi, ronde selesai, game over, ATAU BUKAN GILIRANMU
    if (board[index] || roundWinner || isGameOver || currentTurn !== currentUser) return;

    // Perintahkan backend untuk memproses langkah ini
    socket.emit('tictactoe_move', {
      room_code: roomCode,
      index: index
    });
  };

  // 3. TOMBOL KONTROL JUGA DIKIRIM KE SERVER
  const handleNextAction = () => {
    socket.emit('tictactoe_action', { room_code: roomCode, action: 'next_round' });
  };

  const handleResetGame = () => {
    socket.emit('tictactoe_action', { room_code: roomCode, action: 'rematch' });
  };

  return (
    <div className="screen-container start-screen-bg ttt-layout">
      <div className="crt-overlay"></div>

      {/* 2. BUNGKUSAN BARU: game-match-wrapper menyatukan Papan Game & Kotak Chat berdampingan */}
      <div className="game-match-wrapper">
        
        {/* SISI KIRI: Papan Utama Tic Tac Toe */}
        <div className="ttt-container-box">
          <h2 className="ttt-title">TIC TAC TOE</h2>
          
          {/* SCOREBOARD BOARD */}
          <div className="ttt-scoreboard">
            <div className={`score-card ${currentTurn === player1Name && !roundWinner ? 'active-turn' : ''}`}>
              <span className="player-tag">[X] {player1Name.toUpperCase()}</span>
              <span className="player-points">{scores.p1} PTS</span>
            </div>
            <div className="round-display">
              <span>ROUND</span>
              <span className="round-number">{round} / 3</span>
            </div>
            <div className={`score-card ${currentTurn === player2Name && !roundWinner ? 'active-turn' : ''}`}>
              <span className="player-tag">[O] {player2Name.toUpperCase()}</span>
              <span className="player-points">{scores.p2} PTS</span>
            </div>
          </div>

          {/* STATUS TURN ATAU WINNER RONDE */}
          <div className="ttt-status-bar">
            {!roundWinner && !isGameOver && (
              <p className="status-text">
                {currentTurn === currentUser ? "YOUR TURN" : `${currentTurn?.toUpperCase()}'S TURN`}
              </p>
            )}
            {roundWinner && roundWinner !== 'DRAW' && (
              <p className="status-text winner-highlight">
                {roundWinner === player1Name ? `${player1Name.toUpperCase()} WINS ROUND ${round}!` : `${player2Name.toUpperCase()} WINS ROUND ${round}!`}
              </p>
            )}
            {roundWinner === 'DRAW' && <p className="status-text draw-highlight">ROUND {round} IS A DRAW!</p>}
          </div>

          {/* PAPAN GAME 3X3 */}
          <div className="ttt-grid-board">
            {board.map((cell, index) => (
              <button 
                key={index} 
                className={`ttt-cell ${cell === 'X' ? 'color-x' : cell === 'O' ? 'color-o' : ''}`}
                onClick={() => handleCellClick(index)}
              >
                {cell}
              </button>
            ))}
          </div>

          {/* KONTROL ACTION BUTTONS */}
          <div className="ttt-controls">
            {roundWinner && !isGameOver && (
              <button className="ttt-action-btn next-btn" onClick={handleNextAction}>
                {round < 3 ? "[ NEXT ROUND ]" : "[ SEE RESULT ]"}
              </button>
            )}

            {isGameOver && (
              <div className="game-over-overlay">
                <div className="game-over-box">
                  <h3 className="game-over-title">MATCH OVER</h3>
                  <p className="final-winner-text">{finalWinnerMessage}</p>
                  <div className="game-over-actions">
                    <button className="ttt-action-btn reset-btn" onClick={handleResetGame}>
                      [ REMATCH ]
                    </button>
                    <button className="ttt-action-btn exit-btn" onClick={onBackToDashboard}>
                      [ LEAVE ]
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SISI KANAN: Kotak Chat Modular */}
        <ChatBox currentUser={currentUser} gameRoomId={roomCode} />

      </div>
    </div>
  );
}

export default TicTacToe;