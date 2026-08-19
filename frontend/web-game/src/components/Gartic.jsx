import React, { useState, useEffect, useRef } from 'react';
import ChatBox from './ChatBox';
import { socket } from '../socket';

function Gartic({ currentUser, opponentName, roomCode, initialGameState, onBackToDashboard }) {
  // 1. DETERMINASI ROLE P1 DAN P2 SECARA KONSISTEN DI KEDUA LAPTOP
  const p1Determined = initialGameState?.p1_name || initialGameState?.p1 || 
    (currentUser && opponentName ? (currentUser < opponentName ? currentUser : opponentName) : currentUser);

  const player1Name = p1Determined || "P1";
  const player2Name = (player1Name === currentUser ? opponentName : currentUser) || "P2";

  const isP1 = currentUser === player1Name;
  const myRole = isP1 ? 'p1' : 'p2';

  // STATE PENJAGA SPAM KLIK
  const [localReadySent, setLocalReadySent] = useState(false);

  // GAME STATE UTAMA
  const [round, setRound] = useState(initialGameState?.round || 1);
  const [scores, setScores] = useState(initialGameState?.scores || { p1: 0, p2: 0 });
  const [phase, setPhase] = useState(initialGameState?.phase || 'tutorial'); 
  const [isGameOver, setIsGameOver] = useState(initialGameState?.is_game_over || false);
  const [timer, setTimer] = useState(initialGameState?.timer || 0); 

  // STATE KESIAPAN TUTORIAL
  const [readyPlayers, setReadyPlayers] = useState(initialGameState?.ready_players || []);
  const [p1Ready, setP1Ready] = useState(initialGameState?.p1_ready || false);
  const [p2Ready, setP2Ready] = useState(initialGameState?.p2_ready || false);

  // KATA RAHASIA & STATUS JAWABAN
  const [secretWord, setSecretWord] = useState(initialGameState?.secret_word || '');
  const [customWordInput, setCustomWordInput] = useState('');
  const [hasGuessedCorrectly, setHasGuessedCorrectly] = useState(initialGameState?.has_guessed || false);

  // LOGIKA PEMILIHAN DRAWER BERDASARKAN ROLE KONSISTEN
  const drawerId = round % 2 !== 0 ? 'p1' : 'p2';
  const drawerName = drawerId === 'p1' ? player1Name : player2Name;
  const isMeDrawer = currentUser === drawerName;

  const isMeReady = readyPlayers.includes(currentUser) || (isP1 ? p1Ready : p2Ready);
  const readyCount = readyPlayers.length > 0 ? readyPlayers.length : ((p1Ready ? 1 : 0) + (p2Ready ? 1 : 0));

  // CANVAS SETTINGS & REFS
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [currentColor, setCurrentColor] = useState('#4CC9F0'); 
  const [brushSize, setBrushSize] = useState(5);

  // RESET KANVAS OTOMATIS SAAT GANTI RONDE / PHASE SETUP
  useEffect(() => {
    if (phase === 'setup' || phase === 'drawing') {
      clearCanvasLocal();
    }
  }, [round, phase]);

  // SOCKET LISTENERS
  useEffect(() => {
    socket.on('gartic_update', (gameState) => {
      console.log("📥 [GARTIC UPDATE DARI SERVER]:", gameState);
      if (gameState.round !== undefined) setRound(gameState.round);
      if (gameState.phase) setPhase(gameState.phase);
      if (gameState.timer !== undefined) setTimer(gameState.timer);
      if (gameState.is_game_over !== undefined) setIsGameOver(gameState.is_game_over);
      if (gameState.secret_word !== undefined) setSecretWord(gameState.secret_word || '');
      if (gameState.has_guessed !== undefined) setHasGuessedCorrectly(gameState.has_guessed || false);
      
      if (gameState.scores) setScores(gameState.scores);
      if (gameState.ready_players) setReadyPlayers(gameState.ready_players);
      if (gameState.p1_ready !== undefined) setP1Ready(gameState.p1_ready);
      if (gameState.p2_ready !== undefined) setP2Ready(gameState.p2_ready);

      if (gameState.should_clear_canvas) {
        clearCanvasLocal();
      }
    });

    socket.on('gartic_draw_receive', (data) => {
      if (isMeDrawer) return; // Penggambar tidak perlu menggambar ulang apa yang dikirim sendiri
      
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;

      if (data.type === 'start') {
        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
      } else if (data.type === 'draw') {
        ctx.lineTo(data.x, data.y);
        ctx.strokeStyle = data.color;
        ctx.lineWidth = data.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      } else if (data.type === 'stop') {
        ctx.closePath();
      } else if (data.type === 'clear') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });

    return () => {
      socket.off('gartic_update');
      socket.off('gartic_draw_receive');
    };
  }, [isMeDrawer]);

  // TIMER COUNTDOWN LOKAL
  useEffect(() => {
    let countdownInterval = null;
    if (timer > 0 && (phase === 'drawing' || phase === 'guessing' || phase === 'round_over')) {
      countdownInterval = setInterval(() => {
        setTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(countdownInterval);
  }, [phase, timer]);

  // HELPER UNTUK MENDAPATKAN KOORDINAT PRESISI KANVAS TERKECUALI CSS SCALING
  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  // HANDLER MENGGAMBAR
  const startDrawing = (e) => {
    if (!isMeDrawer || phase !== 'drawing') return;
    const { x, y } = getCanvasCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;

    socket.emit('gartic_draw', { 
      room_code: roomCode, 
      x, 
      y, 
      type: 'start', 
      color: currentColor, 
      size: brushSize,
      sender: currentUser,
      role: myRole
    });
  };

  const draw = (e) => {
    if (!isDrawingRef.current || !isMeDrawer || phase !== 'drawing') return;
    const { x, y } = getCanvasCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    socket.emit('gartic_draw', { 
      room_code: roomCode, 
      x, 
      y, 
      type: 'draw', 
      color: currentColor, 
      size: brushSize,
      sender: currentUser,
      role: myRole
    });
  };

  const stopDrawing = () => { 
    if (isDrawingRef.current && isMeDrawer) {
      isDrawingRef.current = false;
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) ctx.closePath();
      socket.emit('gartic_draw', { 
        room_code: roomCode, 
        type: 'stop',
        sender: currentUser,
        role: myRole
      });
    }
  };
  
  const clearCanvasLocal = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleClearCanvasAction = () => {
    if (!isMeDrawer) return;
    clearCanvasLocal();
    socket.emit('gartic_draw', { 
      room_code: roomCode, 
      type: 'clear',
      sender: currentUser,
      role: myRole
    });
  };

  const handleSetupCustomWord = (e) => {
    e.preventDefault();
    if (!customWordInput.trim()) return;
    
    socket.emit('gartic_action', {
      room_code: roomCode,
      action: 'set_custom_word',
      word: customWordInput.toUpperCase().trim(),
      sender: currentUser,
      role: myRole
    });
    setCustomWordInput('');
  };

  const handleChatSendMessage = (text) => {
    socket.emit('gartic_guess', {
      room_code: roomCode,
      sender: currentUser,
      message: text,
      role: myRole
    });
  };

  const renderWordHint = () => {
    if (round === 3 || round === 4) return "MISTERI (FREE ROUND)";
    if (!secretWord) return "...";
    return secretWord.split('').map(() => '_ ').join('');
  };

  const handleConfirmTutorial = () => {
    if (localReadySent) return;
    setLocalReadySent(true);

    // Optimistic Update lokal
    if (isP1) setP1Ready(true);
    else setP2Ready(true);

    console.log("🚀 MENGIRIM KESIAPAN DATA TUTORIAL GARTIC KE SERVER...");
    socket.emit('gartic_action', { 
      room_code: roomCode, 
      action: 'ready',
      sender: currentUser,
      role: myRole
    });
  };

  return (
    <div className="screen-container start-screen-bg gartic-layout">
      <div className="crt-overlay"></div>

      {phase === 'tutorial' && (
        <div className="game-over-overlay">
          <div className="game-over-box tutorial-box" style={{ maxWidth: '450px' }}>
            <h3 className="game-over-title">[ HOW TO PLAY ]</h3>
            <div className="tutorial-text-content" style={{ fontFamily: 'monospace', fontSize: '0.65rem', textAlign: 'left', lineHeight: '1.4', color: '#fff', margin: '15px 0' }}>
              <p style={{ color: 'var(--color-cyan)', fontWeight: 'bold' }}>1. SISTEM BERGILIRAN</p>
              <p style={{ marginBottom: '10px' }}>Satu pemain bertugas menggambar, pemain lain menebak melalui kolom chat.</p>
              
              <p style={{ color: 'var(--color-cyan)', fontWeight: 'bold' }}>2. DUA FASE RONDE</p>
              <p style={{ marginBottom: '4px' }}>- DRAWING TIME (30 DETIK): Waktu murni bagi pelukis untuk menggambar. Kanvas penebak akan dikunci.</p>
              <p style={{ marginBottom: '10px' }}>- GUESSING TIME: Kanvas terbuka! Penebak diberi waktu mengirimkan jawaban.</p>
              
              <p style={{ color: 'var(--color-cyan)', fontWeight: 'bold' }}>3. FREE ROUND (RONDE 3 & 4)</p>
              <p>Penggambar dibebaskan mengetik kata rahasia sendiri secara manual sebelum menggambar.</p>
            </div>

            <div style={{ marginTop: '20px' }}>
              <button 
                className="ttt-action-btn next-btn" 
                onClick={handleConfirmTutorial}
                disabled={localReadySent || isMeReady}
                style={{ opacity: (localReadySent || isMeReady) ? 0.5 : 1 }}
              >
                {(localReadySent || isMeReady) ? `[ WAITING ] (${readyCount}/2)` : `[ MENGERTI ] (${readyCount}/2)`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="game-match-wrapper">
        <div className="gartic-container-box">
          <header className="gartic-header">
            <div className="gartic-score">
              <span>{player1Name.toUpperCase()}: {scores.p1} PTS</span>
            </div>
            
            <div className="gartic-round-info" style={{ textAlign: 'center' }}>
              <div>ROUND {round} / 4</div>
              {(phase === 'drawing' || phase === 'guessing') && (
                <div style={{ color: phase === 'guessing' ? '#F72585' : '#02c39a', marginTop: '4px', fontSize: '0.75rem' }}>
                  {phase === 'drawing' ? '[ DRAWING TIME ] ' : '[ GUESS NOW ] '}{timer}s
                </div>
              )}
              {phase === 'round_over' && (
                <div style={{ color: '#ffb703', marginTop: '4px', fontSize: '0.75rem' }}>
                  [ TRANSITION ] {timer}s
                </div>
              )}
            </div>

            <div className="gartic-score">
              <span>{player2Name.toUpperCase()}: {scores.p2} PTS</span>
            </div>
          </header>

          <div className="gartic-status-bar">
            {phase === 'setup' && (
              <p className="status-text blink-text">WAITING FOR {drawerName.toUpperCase()} TO CHOOSE A WORD...</p>
            )}
            {phase === 'drawing' && (
              <p className="status-text" style={{ color: 'var(--color-cyan)' }}>
                {isMeDrawer 
                  ? `YOUR TURN TO DRAW! KATA: ${secretWord}` 
                  : `${drawerName.toUpperCase()} IS DRAWING... PREPARE YOURSELF!`
                }
              </p>
            )}
            {phase === 'guessing' && (
              <div className="status-word-hint">
                <span className="role-tag" style={{ color: '#F72585' }}>&gt;&gt; TIME TO GUESS &lt;&lt;</span>
                <h3 className="the-word">
                  {isMeDrawer ? `THEY ARE GUESSING: ${secretWord}` : `HINT: ${renderWordHint()}`}
                </h3>
              </div>
            )}
            {phase === 'round_over' && (
              <p className="status-text winner-highlight">
                {hasGuessedCorrectly ? `[SUCCESS] CORRECT! ANSWER IS: ${secretWord}` : `[FAILED] TIME'S UP! THE WORD WAS: ${secretWord}`}
                <span style={{ display: 'block', fontSize: '0.55rem', marginTop: '4px', color: '#ffb703', letterSpacing: '1px' }}>
                  NEXT ROUND WILL START AUTOMATICALLY IN {timer} SECONDS...
                </span>
              </p>
            )}
          </div>

          <div className="canvas-work-area">
            {phase === 'setup' ? (
              <div className="custom-word-setup-zone">
                {isMeDrawer ? (
                  <form onSubmit={handleSetupCustomWord} className="retro-word-form">
                    <p>ENTER A CUSTOM WORD TO DRAW:</p>
                    <input 
                      type="text" 
                      className="friend-retro-input"
                      maxLength={12} 
                      placeholder="E.G. MABASTRES"
                      value={customWordInput}
                      onChange={(e) => setCustomWordInput(e.target.value.replace(/[^A-Za-z\s]/g, ''))}
                    />
                    <button type="submit" className="form-action-btn submit-color">[ START ]</button>
                  </form>
                ) : (
                  <div className="loading-holder-box">
                    <p>THE DRAWER IS TYPING A WORD...</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {phase === 'drawing' && !isMeDrawer ? (
                  <div className="canvas-hidden-overlay">
                    <div className="pixel-lock-box">
                      <div className="lock-inner-line"></div>
                      <span>DRAWING LOCKED</span>
                    </div>
                    <p style={{ fontSize: '0.55rem', color: '#ffb703', marginTop: '15px', letterSpacing: '1px' }}>
                      THE DRAWING WILL BE REVEALED IN THE NEXT GUESSING TIME!
                    </p>
                  </div>
                ) : (
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={320}
                    className={`gartic-canvas ${phase !== 'drawing' || !isMeDrawer ? 'canvas-locked' : ''}`}
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onPointerLeave={stopDrawing}
                    style={{ touchAction: 'none' }}
                  />
                )}
              </>
            )}
          </div>

          {phase === 'drawing' && isMeDrawer && (
            <div className="canvas-tools-bar">
              <div className="color-pickers">
                {['#4CC9F0', '#F72585', '#FFFFFF', '#000000'].map((color) => (
                  <button 
                    key={color} 
                    className="color-dot" 
                    style={{ backgroundColor: color, border: currentColor === color ? '3px solid gold' : '1px solid #fff' }}
                    onClick={() => setCurrentColor(color)}
                  />
                ))}
              </div>
              <button className="clear-canvas-btn" onClick={handleClearCanvasAction}>[ CLEAR ]</button>
            </div>
          )}

          <div className="gartic-bottom-controls">
            {isGameOver && (
              <div className="game-over-overlay">
                <div className="game-over-box">
                  <h3 className="game-over-title">GARTIC OVER</h3>
                  <p className="final-winner-text">
                    {scores.p1 === scores.p2 ? "MATCH ENDS IN A TIE!" : 
                     scores.p1 > scores.p2 ? `${player1Name.toUpperCase()} WINS!` : `${player2Name.toUpperCase()} WINS!`}
                  </p>
                  <button className="ttt-action-btn exit-btn" onClick={onBackToDashboard}>[ BACK ]</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <ChatBox currentUser={currentUser} gameRoomId={roomCode} onSendMessage={handleChatSendMessage} gameType="GARTIC" />
      </div>
    </div>
  );
}

export default Gartic;