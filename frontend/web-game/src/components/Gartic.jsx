import React, { useState, useEffect, useRef } from 'react';
import ChatBox from './ChatBox';
import { socket } from '../socket'; // Menggunakan socket yang sama dengan TicTacToe

function Gartic({ currentUser, opponentName, roomCode, initialGameState, onBackToDashboard }) {
  // SINKRONISASI NAMA PLAYER SESUAI KONDISI LOBBY MULTIPLAYER
  const player1Name = currentUser || "P1";
  const player2Name = opponentName || "P2";

  // GAME STATE UTAMA (Sinkronisasi awal dari data backend)
  const [round, setRound] = useState(initialGameState?.round || 1);
  const [scores, setScores] = useState(initialGameState?.scores || { p1: 0, p2: 0 });
  const [phase, setPhase] = useState(initialGameState?.phase || 'tutorial'); 
  const [isGameOver, setIsGameOver] = useState(initialGameState?.is_game_over || false);
  const [timer, setTimer] = useState(initialGameState?.timer || 0); 

  // STATE KESIAPAN TUTORIAL (Ikut standarisasi backend)
  const [readyPlayers, setReadyPlayers] = useState(initialGameState?.ready_players || []);
  const [p1Ready, setP1Ready] = useState(initialGameState?.p1_ready || false);
  const [p2Ready, setP2Ready] = useState(initialGameState?.p2_ready || false);

  // KATA RAHASIA & STATUS JAWABAN
  const [secretWord, setSecretWord] = useState(initialGameState?.secret_word || '');
  const [customWordInput, setCustomWordInput] = useState('');
  const [hasGuessedCorrectly, setHasGuessedCorrectly] = useState(initialGameState?.has_guessed || false);

  // LOGIKA MENENTUKAN SIAPA YANG MENGGAMBAR
  const drawerId = round % 2 !== 0 ? 'p1' : 'p2';
  const drawerName = drawerId === 'p1' ? player1Name : player2Name;
  const guesserName = drawerId === 'p1' ? player2Name : player1Name;

  const isMeDrawer = currentUser === drawerName;
  const isMeReady = readyPlayers.includes(currentUser) || (currentUser === player1Name ? p1Ready : p2Ready);
  const readyCount = readyPlayers.length > 0 ? readyPlayers.length : ((p1Ready ? 1 : 0) + (p2Ready ? 1 : 0));

  // CANVAS SETTINGS
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [currentColor, setCurrentColor] = useState('#4CC9F0'); 
  const [brushSize, setBrushSize] = useState(5);

  // ==========================================
  // JALUR PIPA UTAMA: DENGARKAN TELEMETRI SERVER
  // ==========================================
  useEffect(() => {
    // 1. Update State Game Secara Umum
    socket.on('gartic_update', (gameState) => {
      console.log("📥 [GARTIC UPDATE DARI SERVER]:", gameState);
      setRound(gameState.round);
      setPhase(gameState.phase);
      setTimer(gameState.timer);
      setIsGameOver(gameState.is_game_over);
      setSecretWord(gameState.secret_word || '');
      setHasGuessedCorrectly(gameState.has_guessed || false);
      
      if (gameState.scores) setScores(gameState.scores);
      if (gameState.ready_players) setReadyPlayers(gameState.ready_players);
      if (gameState.p1_ready !== undefined) setP1Ready(gameState.p1_ready);
      if (gameState.p2_ready !== undefined) setP2Ready(gameState.p2_ready);

      // Reset kanvas lokal setiap kali ronde atau fase berganti demi kebersihan layar
      if (gameState.should_clear_canvas) {
        clearCanvasLocal();
      }
    });

    // 2. Terima Koordinat Gambar Real-time dari Lawan
    socket.on('gartic_draw_receive', (data) => {
      if (isMeDrawer) return; // Pelukis asli tidak perlu menggambar ulang jejaknya sendiri
      
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;

      if (data.type === 'start') {
        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
      } else if (data.type === 'draw') {
        ctx.lineTo(data.x, data.y);
        ctx.strokeStyle = data.color;
        ctx.lineWidth = data.size;
        ctx.lineCap = 'round';
        ctx.stroke();
      } else if (data.type === 'stop') {
        ctx.closePath();
      } else if (data.type === 'clear') {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    });

    return () => {
      socket.off('gartic_update');
      socket.off('gartic_draw_receive');
    };
  }, [isMeDrawer]);

  // LOCAL COUNTDOWN TIMER (Sebagai kompensasi latency jaringan agar visual tetap mulus)
  useEffect(() => {
    let countdownInterval = null;
    if (timer > 0 && (phase === 'drawing' || phase === 'guessing' || phase === 'round_over')) {
      countdownInterval = setInterval(() => {
        setTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(countdownInterval);
  }, [phase, timer]);

  // ==========================================
  // CORE CANVAS LOGIC WITH SOCKET EMITTERS
  // ==========================================
  const startDrawing = ({ nativeEvent }) => {
    if (!isMeDrawer || phase !== 'drawing') return;
    const { offsetX, offsetY } = nativeEvent;
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    isDrawingRef.current = true;

    // Kirim sinyal mulai menarik garis ke backend
    socket.emit('gartic_draw', { room_code: roomCode, x: offsetX, y: offsetY, type: 'start', color: currentColor, size: brushSize });
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawingRef.current || !isMeDrawer) return;
    const { offsetX, offsetY } = nativeEvent;
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(offsetX, offsetY);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Kirim koordinat lintasan kontinu ke backend
    socket.emit('gartic_draw', { room_code: roomCode, x: offsetX, y: offsetY, type: 'draw', color: currentColor, size: brushSize });
  };

  const stopDrawing = () => { 
    if (isDrawingRef.current && isMeDrawer) {
      isDrawingRef.current = false;
      socket.emit('gartic_draw', { room_code: roomCode, type: 'stop' });
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
    socket.emit('gartic_draw', { room_code: roomCode, type: 'clear' });
  };

  // KIRIM PILIHAN KATA MANUAL KE SERVER (RONDE 3 & 4)
  const handleSetupCustomWord = (e) => {
    e.preventDefault();
    if (!customWordInput.trim()) return;
    
    console.log("🚀 MENGIRIM KATA RAHASIA PILIHAN KE SERVER...");
    socket.emit('gartic_action', {
      room_code: roomCode,
      action: 'set_custom_word',
      word: customWordInput.toUpperCase().trim()
    });
    setCustomWordInput('');
  };

  // MANIFESTASI WHATSAPP CHATBOX KE SERVER
  const handleChatSendMessage = (text) => {
    // Logic pencocokan dialihkan penuh ke backend untuk mencegah hacking inspect element F12
    socket.emit('gartic_guess', {
      room_code: roomCode,
      sender: currentUser,
      message: text
    });
  };

  const renderWordHint = () => {
    if (round === 3 || round === 4) return "MISTERI (FREE ROUND)";
    if (!secretWord) return "...";
    return secretWord.split('').map(() => '_ ').join('');
  };

  // KIRIM SINYAL SIAP UNTUK MEMULAI DARI POP-UP
  const handleConfirmTutorial = () => {
    console.log("🚀 MENGIRIM KESIAPAN DATA TUTORIAL GARTIC KE SERVER...");
    socket.emit('gartic_action', { 
      room_code: roomCode, 
      action: 'ready' 
    });
  };

  return (
    <div className="screen-container start-screen-bg gartic-layout">
      <div className="crt-overlay"></div>

      {/* POP-UP HOW TO PLAY */}
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
                disabled={isMeReady}
                style={{ opacity: isMeReady ? 0.5 : 1 }}
              >
                {isMeReady ? `[ WAITING ] (${readyCount}/2)` : `[ MENGERTI ] (${readyCount}/2)`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="game-match-wrapper">
        
        {/* SISI KIRI: Monitor Utama */}
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
              <p className="status-text blink-text">WAITING FOR {drawerName} TO CHOOSE A WORD...</p>
            )}
            {phase === 'drawing' && (
              <p className="status-text" style={{ color: 'var(--color-cyan)' }}>
                {isMeDrawer 
                  ? `YOUR TURN TO DRAW! KATA: ${secretWord}` 
                  : `${drawerName} IS DRAWING... PREPARE YOURSELF!`
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

          {/* AREA WORK KANVAS */}
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
                    className={`gartic-canvas ${phase !== 'drawing' ? 'canvas-locked' : ''}`}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                  />
                )}
              </>
            )}
          </div>

          {/* TOOLBAR WARNA */}
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

          {/* AKSI LANJUTAN */}
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

        {/* SISI KANAN: ChatBox Terintegrasi dengan RoomCode Real */}
        <ChatBox currentUser={currentUser} gameRoomId={roomCode} onSendMessage={handleChatSendMessage} gameType="GARTIC" />

      </div>
    </div>
  );
}

export default Gartic;