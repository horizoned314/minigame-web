import React, { useState, useEffect } from 'react';
import ChatBox from './ChatBox'; // <-- 1. Kita impor ChatBox secara modular di sini

function TicTacToe({ player1Name, player2Name, onBackToDashboard }) {
  // P1 kita anggap 'X', P2 kita anggap 'O'
  const [board, setBoard] = useState(Array(9).fill(null));
  const [currentTurn, setCurrentTurn] = useState(null); // 'X' atau 'O'
  const [round, setRound] = useState(1);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [roundWinner, setRoundWinner] = useState(null); // 'X', 'O', 'DRAW', atau null
  const [isGameOver, setIsGameOver] = useState(false);
  const [finalWinnerMessage, setFinalWinnerMessage] = useState('');

  // Kombinasi kemenangan Tic Tac Toe
  const winningLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Horisontal
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Vertikal
    [0, 4, 8], [2, 4, 6]             // Diagonal
  ];

  // Efek untuk memulai ronde baru & mengacak giliran pertama
  useEffect(() => {
    startNewRound();
  }, [round]);

  const startNewRound = () => {
    setBoard(Array(9).fill(null));
    setRoundWinner(null);
    // Mengacak siapa yang jalan duluan ('X' atau 'O')
    const randomFirstTurn = Math.random() < 0.5 ? 'X' : 'O';
    setCurrentTurn(randomFirstTurn);
  };

  // Logika ketika kotak papan diklik
  const handleCellClick = (index) => {
    // Jangan izinkan klik jika kotak sudah terisi, ronde selesai, atau game over
    if (board[index] || roundWinner || isGameOver) return;

    const newBoard = [...board];
    newBoard[index] = currentTurn;
    setBoard(newBoard);

    checkRoundStatus(newBoard);
  };

  // Cek apakah ada yang menang ronde atau seri
  const checkRoundStatus = (currentBoard) => {
    let hasWinner = false;

    for (let line of winningLines) {
      const [a, b, c] = line;
      if (currentBoard[a] && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
        hasWinner = true;
        const winner = currentBoard[a]; // 'X' atau 'O'
        setRoundWinner(winner);
        
        // Update Skor Sementara
        if (winner === 'X') {
          setScores(prev => ({ ...prev, p1: prev.p1 + 1 }));
        } else {
          setScores(prev => ({ ...prev, p2: prev.p2 + 1 }));
        }
        return;
      }
    }

    // Jika tidak ada yang menang dan papan sudah penuh, berarti seri (DRAW)
    if (!hasWinner && !currentBoard.includes(null)) {
      setRoundWinner('DRAW');
    } else {
      // Ganti giliran jika permainan ronde ini masih berlanjut
      setCurrentTurn(currentTurn === 'X' ? 'O' : 'X');
    }
  };

  // Logika tombol "NEXT ROUND" atau "SEE FINAL RESULT"
  const handleNextAction = () => {
    if (round < 3) {
      // Lanjut ke ronde berikutnya
      setRound(prev => prev + 1);
    } else {
      // Sudah menyelesaikan ronde 3, tentukan pemenang akhir berdasarkan skor terbanyak
      setIsGameOver(true);
      if (scores.p1 > scores.p2) {
        setFinalWinnerMessage(`${player1Name.toUpperCase()} WINS THE MATCH!`);
      } else if (scores.p2 > scores.p1) {
        setFinalWinnerMessage(`${player2Name.toUpperCase()} WINS THE MATCH!`);
      } else {
        setFinalWinnerMessage("MATCH ENDS IN A TIE!");
      }
    }
  };

  // Reset ulang seluruh game dari awal ronde 1
  const handleResetGame = () => {
    setScores({ p1: 0, p2: 0 });
    setIsGameOver(false);
    setFinalWinnerMessage('');
    if (round === 1) {
      startNewRound();
    } else {
      setRound(1);
    }
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
            <div className={`score-card ${currentTurn === 'X' && !roundWinner ? 'active-turn' : ''}`}>
              <span className="player-tag">[X] {player1Name.toUpperCase()}</span>
              <span className="player-points">{scores.p1} PTS</span>
            </div>
            <div className="round-display">
              <span>ROUND</span>
              <span className="round-number">{round} / 3</span>
            </div>
            <div className={`score-card ${currentTurn === 'O' && !roundWinner ? 'active-turn' : ''}`}>
              <span className="player-tag">[O] {player2Name.toUpperCase()}</span>
              <span className="player-points">{scores.p2} PTS</span>
            </div>
          </div>

          {/* STATUS TURN ATAU WINNER RONDE */}
          <div className="ttt-status-bar">
            {!roundWinner && !isGameOver && (
              <p className="status-text">
                {currentTurn === 'X' ? `${player1Name.toUpperCase()}'S TURN` : `${player2Name.toUpperCase()}'S TURN`}
              </p>
            )}
            {roundWinner && roundWinner !== 'DRAW' && (
              <p className="status-text winner-highlight">
                {roundWinner === 'X' ? `${player1Name.toUpperCase()} WINS ROUND ${round}!` : `${player2Name.toUpperCase()} WINS ROUND ${round}!`}
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
        {/* Kita oper nama kamu (player1Name) ke prop currentUser agar logikanya tahu siapa pengirimnya */}
        <ChatBox currentUser={player1Name} gameRoomId="room-ttt-01" />

      </div>
    </div>
  );
}

export default TicTacToe;