import React, { useState, useEffect } from 'react';
import ChatBox from './ChatBox';
import { socket } from '../socket'; 

// 1. TAMBAHKAN initialGameState DI PROPS
function TicTacToe({ currentUser, opponentName, roomCode, initialGameState, onBackToDashboard }) {
  
  // ==========================================
  // STORES JALUR BACKEND UNTUK TUTORIAL READY
  // ==========================================
  const [readyPlayers, setReadyPlayers] = useState(initialGameState?.ready_players || []);
  const [p1Ready, setP1Ready] = useState(initialGameState?.p1_ready || false);
  const [p2Ready, setP2Ready] = useState(initialGameState?.p2_ready || false);

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

  // HITUNG STATUS KESIAPAN KOMPATIBEL DENGAN FORMAT BACKEND MANA PUN
  const isMeReady = readyPlayers.includes(currentUser) || (currentUser === player1Name ? p1Ready : p2Ready);
  const readyCount = readyPlayers.length > 0 ? readyPlayers.length : ((p1Ready ? 1 : 0) + (p2Ready ? 1 : 0));
  const showTutorial = readyCount < 2;

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
      
      // Update status tutorial dari backend agar tidak desinkronisasi
      if (gameState.ready_players) setReadyPlayers(gameState.ready_players);
      if (gameState.p1_ready !== undefined) setP1Ready(gameState.p1_ready);
      if (gameState.p2_ready !== undefined) setP2Ready(gameState.p2_ready);

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

  // EMIT UNTUK TUTORIAL (Ikut struktur kiriman aksi kawan backend kita)
  const handleConfirmTutorial = () => {
    console.log("🚀 MENGIRIM KESIAPAN TUTORIAL KE BACKEND...");
    socket.emit('tictactoe_action', { 
      room_code: roomCode, 
      action: 'ready' 
    });
  };

  const handleNextAction = () => socket.emit('tictactoe_action', { room_code: roomCode, action: 'next_round' });
  const handleResetGame = () => socket.emit('tictactoe_action', { room_code: roomCode, action: 'rematch' });

  return (
    <div className="screen-container start-screen-bg ttt-layout">
      <div className="crt-overlay"></div>

      {/* POP-UP HOW TO PLAY - DIKENDALIKAN OLEH STATE SERVER */}
      {showTutorial && (
        <div className="game-over-overlay">
          <div className="game-over-box tutorial-box" style={{ maxWidth: '450px' }}>
            <h3 className="game-over-title">[ HOW TO PLAY ]</h3>
            <div className="tutorial-text-content" style={{ fontFamily: 'monospace', fontSize: '0.65rem', textAlign: 'left', lineHeight: '1.4', color: '#fff', margin: '15px 0' }}>
              <p style={{ color: 'var(--color-cyan)', fontWeight: 'bold' }}>1. ATURAN GILIRAN</p>
              <p style={{ marginBottom: '10px' }}>Pemain bertindak secara bergantian untuk menaruh tanda [X] atau [O] pada petak grid 3x3 yang masih kosong.</p>
              
              <p style={{ color: 'var(--color-cyan)', fontWeight: 'bold' }}>2. FORMASI KEMENANGAN</p>
              <p style={{ marginBottom: '10px' }}>Berhasil sejajarkan 3 tanda yang sama secara Horizontal, Vertikal, atau Diagonal untuk mengamankan kemenangan ronde.</p>
              
              <p style={{ color: 'var(--color-cyan)', fontWeight: 'bold' }}>3. SISTEM MATCH (3 RONDE)</p>
              <p>Kumpulkan total kemenangan terbanyak sepanjang 3 ronde penuh untuk keluar sebagai pemenang turnamen sejati!</p>
            </div>

            <div style={{ marginTop: '20px' }}>
              <button 
                className="ttt-action-btn next-btn" 
                onClick={handleConfirmTutorial}
                disabled={isMeReady}
                style={{ opacity: isMeReady ? 0.5 : 1 }}
              >
                {isMeReady ? `[ WAITING... ] (${readyCount}/2)` : `[ MENGERTI ] (${readyCount}/2)`}
              </button>
            </div>
          </div>
        </div>
      )}

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