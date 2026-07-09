import React, { useState, useEffect } from 'react';
import ChatBox from './ChatBox';
import { socket } from '../socket'; 

// 1. TAMBAHKAN initialGameState DI PROPS
function TicTacToe({ currentUser, opponentName, roomCode, initialGameState, onBackToDashboard }) {
  
  // 2. GUNAKAN initialGameState SEBAGAI INGATAN AWAL AGAR TIDAK AMNESIA
  const [board, setBoard] = useState(initialGameState?.board || Array(9).fill(null));
  const [playerX, setPlayerX] = useState(initialGameState?.player_x || null);
  const [playerO, setPlayerO] = useState(initialGameState?.player_o || null);
  const [currentTurn, setCurrentTurn] = useState(initialGameState?.current_turn || null); 
  const [round, setRound] = useState(initialGameState?.round || 1);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [roundWinner, setRoundWinner] = useState(initialGameState?.round_winner || null); 
  const [isGameOver, setIsGameOver] = useState(initialGameState?.is_game_over || false);
  const [finalWinnerMessage, setFinalWinnerMessage] = useState(initialGameState?.final_message || '');

  const player1Name = currentUser || "P1";
  const player2Name = opponentName || "P2";

  useEffect(() => {
    // Sinkronisasi skor awal jika ada data dari backend
    if (initialGameState?.scores) {
      setScores({
        p1: initialGameState.scores[player1Name] || initialGameState.scores[player1Name.toLowerCase()] || 0,
        p2: initialGameState.scores[player2Name] || initialGameState.scores[player2Name.toLowerCase()] || 0
      });
    }

    // Dengarkan update selanjutnya dari server
    socket.on('tictactoe_update', (gameState) => {
      console.log("📥 [UPDATE DARI SERVER]:", gameState);
      setBoard(gameState.board);
      setCurrentTurn(gameState.current_turn);
      setRound(gameState.round);

      if (gameState.player_x) setPlayerX(gameState.player_x);
      if (gameState.player_o) setPlayerO(gameState.player_o);
      
      setScores({
        p1: gameState.scores[player1Name] || gameState.scores[player1Name.toLowerCase()] || 0,
        p2: gameState.scores[player2Name] || gameState.scores[player2Name.toLowerCase()] || 0
      });

      setRoundWinner(gameState.round_winner);
      setIsGameOver(gameState.is_game_over);
      setFinalWinnerMessage(gameState.final_message || '');
    });

    return () => {
      socket.off('tictactoe_update');
    };
  }, [player1Name, player2Name, initialGameState]);

  const handleCellClick = (index) => {
    // FUNGSI DETEKTIF: Akan muncul di F12 setiap kali Anda klik
    console.log(`\n--- KLIK KOTAK ${index} ---`);
    console.log(`Giliran Server: ${currentTurn} | Nama Saya: ${currentUser}`);

    const safeTurn = (currentTurn || "").toUpperCase();
    const safeMe = (currentUser || "").toUpperCase();

    if (board[index]) {
      console.log("❌ BLOKIR: Kotak sudah terisi.");
      return;
    }
    if (roundWinner || isGameOver) {
      console.log("❌ BLOKIR: Ronde/Game sudah selesai.");
      return;
    }
    if (safeTurn !== safeMe) {
      console.log("❌ BLOKIR: Bukan giliranmu!");
      return;
    }

    console.log("✅ KLIK SAH! Mengirim tictactoe_move...");
    socket.emit('tictactoe_move', {
      room_code: roomCode,
      index: index
    });
  };

  const handleNextAction = () => socket.emit('tictactoe_action', { room_code: roomCode, action: 'next_round' });
  const handleResetGame = () => socket.emit('tictactoe_action', { room_code: roomCode, action: 'rematch' });

  return (
    <div className="screen-container start-screen-bg ttt-layout">
      <div className="crt-overlay"></div>

      <div className="game-match-wrapper">
        <div className="ttt-container-box">
          <h2 className="ttt-title">TIC TAC TOE</h2>
          
          <div className="ttt-scoreboard">
            <div className={`score-card ${currentTurn === player1Name && !roundWinner ? 'active-turn' : ''}`}>
              <span className="player-tag">
                [{player1Name === playerX ? 'X' : 'O'}] {player1Name?.toUpperCase() || "PLAYER 1"}
              </span>
              <span className="player-points">{scores.p1} PTS</span>
            </div>
            <div className="round-display">
              <span>ROUND</span>
              <span className="round-number">{round} / 3</span>
            </div>
            <div className={`score-card ${currentTurn === player2Name && !roundWinner ? 'active-turn' : ''}`}>
              <span className="player-tag">
                [{player2Name === playerX ? 'X' : 'O'}] {player2Name?.toUpperCase() || "PLAYER 2"}
              </span>
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