import React, { useState, useEffect } from 'react';
import ChatBox from './ChatBox';
import { socket } from '../socket'; 

// 1. UBAH PROPS AGAR COCOK DENGAN APP.JSX
function TicTacToe({ currentUser, opponentName, roomCode, onBackToDashboard }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [currentTurn, setCurrentTurn] = useState(null); 
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [roundWinner, setRoundWinner] = useState(null); 
  const [isGameOver, setIsGameOver] = useState(false);
  const [finalWinnerMessage, setFinalWinnerMessage] = useState('');

  // 2. KITA BUAT ALIAS AGAR KODE DI BAWAHNYA TIDAK PERLU BANYAK DIUBAH
  // (Pastikan tidak undefined saat dipanggil, default ke string kosong)
  const player1Name = currentUser || "P1";
  const player2Name = opponentName || "P2";

  // DENGARKAN UPDATE DARI SERVER BACKEND
  useEffect(() => {
    socket.on('tictactoe_update', (gameState) => {
      setBoard(gameState.board);
      setCurrentTurn(gameState.current_turn);
      setRound(gameState.round);
      
      setScores({
        p1: gameState.scores[player1Name] || 0,
        p2: gameState.scores[player2Name] || 0
      });

      setRoundWinner(gameState.round_winner);
      setIsGameOver(gameState.is_game_over);
      setFinalWinnerMessage(gameState.final_message || '');
    });

    return () => {
      socket.off('tictactoe_update');
    };
  }, [player1Name, player2Name]);

  // KIRIM KLIK KE SERVER
  const handleCellClick = (index) => {
    if (board[index] || roundWinner || isGameOver || currentTurn !== currentUser) return;

    socket.emit('tictactoe_move', {
      room_code: roomCode,
      index: index
    });
  };

  // TOMBOL KONTROL
  const handleNextAction = () => {
    socket.emit('tictactoe_action', { room_code: roomCode, action: 'next_round' });
  };

  const handleResetGame = () => {
    socket.emit('tictactoe_action', { room_code: roomCode, action: 'rematch' });
  };

  return (
    <div className="screen-container start-screen-bg ttt-layout">
      <div className="crt-overlay"></div>

      <div className="game-match-wrapper">
        <div className="ttt-container-box">
          <h2 className="ttt-title">TIC TAC TOE</h2>
          
          <div className="ttt-scoreboard">
            {/* TAMBAHKAN TANDA TANYA (?.) PADA SEMUA toUpperCase UNTUK MENCEGAH CRASH */}
            <div className={`score-card ${currentTurn === player1Name && !roundWinner ? 'active-turn' : ''}`}>
              <span className="player-tag">[X] {player1Name?.toUpperCase() || "PLAYER 1"}</span>
              <span className="player-points">{scores.p1} PTS</span>
            </div>
            <div className="round-display">
              <span>ROUND</span>
              <span className="round-number">{round} / 3</span>
            </div>
            <div className={`score-card ${currentTurn === player2Name && !roundWinner ? 'active-turn' : ''}`}>
              <span className="player-tag">[O] {player2Name?.toUpperCase() || "PLAYER 2"}</span>
              <span className="player-points">{scores.p2} PTS</span>
            </div>
          </div>

          <div className="ttt-status-bar">
            {!roundWinner && !isGameOver && (
              <p className="status-text">
                {currentTurn === currentUser ? "YOUR TURN" : `${currentTurn?.toUpperCase() || "OPPONENT"}'S TURN`}
              </p>
            )}
            {roundWinner && roundWinner !== 'DRAW' && (
              <p className="status-text winner-highlight">
                {roundWinner === player1Name ? `${player1Name?.toUpperCase()} WINS ROUND ${round}!` : `${player2Name?.toUpperCase()} WINS ROUND ${round}!`}
              </p>
            )}
            {roundWinner === 'DRAW' && <p className="status-text draw-highlight">ROUND {round} IS A DRAW!</p>}
          </div>

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

        <ChatBox currentUser={currentUser} gameRoomId={roomCode} />

      </div>
    </div>
  );
}

export default TicTacToe;