import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';

// KATALOG FRAME GAMBAR DARI FOLDER public/frames/
const FRAME_OPTIONS = [
  { id: 'pink', name: 'PASTEL PINK', src: '/frames/frame-pink.png', color: '#ffb3c1' },
  { id: 'grey', name: 'GREY CLASSIC', src: '/frames/frame-grey.png', color: '#8d99ae' },
  { id: 'blue', name: 'OCEAN BLUE', src: '/frames/frame-blue.png', color: '#a2d2ff' },
  { id: 'red', name: 'CRIMSON RED', src: '/frames/frame-red.png', color: '#ff4d6d' },
];

function Photobooth({ currentUser, opponentName, roomCode, initialGameState, onBackToDashboard }) {
  const player1Name = currentUser || "Salsabila";
  const player2Name = opponentName || "Teman";

  // DETEKSI ROLE CLIENT SAAT INI ('p1' ATAU 'p2')
  const isP1 = currentUser === player1Name;
  const myRole = isP1 ? 'p1' : 'p2';

  // STATE FASE PHOTOBOOTH: 'tutorial' -> 'frame_select' -> 'shooting' -> 'result'
  const [phase, setPhase] = useState(initialGameState?.phase || 'tutorial');

  // STATE KESIAPAN TUTORIAL
  const [p1Ready, setP1Ready] = useState(initialGameState?.p1_ready || false);
  const [p2Ready, setP2Ready] = useState(initialGameState?.p2_ready || false);

  // STATE PEMILIHAN FRAME
  const [proposedFrame, setProposedFrame] = useState(null); 
  const [proposedBy, setProposedBy] = useState(null); 
  const [selectedFrame, setSelectedFrame] = useState(FRAME_OPTIONS[0]); 

  // CAMERA & WEBCAM REF
  const localVideoRef1 = useRef(null);
  const localVideoRef2 = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);

  // STATE FOTO & TIMER SHOOTING
  const [photoCount, setPhotoCount] = useState(1);
  const [countdown, setCountdown] = useState(10);
  const [shootingSubPhase, setShootingSubPhase] = useState('countdown'); // 'countdown' | 'review_snap'
  const [reviewTimer, setReviewTimer] = useState(5);
  const [capturedPhotos, setCapturedPhotos] = useState([]); 
  const [isFlash, setIsFlash] = useState(false);

  // RESULT STATE
  const [finalPhotostripUrl, setFinalPhotostripUrl] = useState(null);

  const readyCount = (p1Ready ? 1 : 0) + (p2Ready ? 1 : 0);
  const isCurrentClientReady = isP1 ? p1Ready : p2Ready;

  // 1. DENGARKAN AKSI SOCKET DARI BACKEND
  useEffect(() => {
    socket.on('photobooth_update', (data) => {
      if (data.phase) setPhase(data.phase);
      if (data.p1_ready !== undefined) setP1Ready(data.p1_ready);
      if (data.p2_ready !== undefined) setP2Ready(data.p2_ready);
      if (data.proposed_frame) setProposedFrame(data.proposed_frame);
      if (data.proposed_by) setProposedBy(data.proposed_by);
      if (data.selected_frame) setSelectedFrame(data.selected_frame);
      
      if (data.action === 'retake_current_shot') {
        handleLocalRetakeCurrentShot();
      } else if (data.action === 'next_shot') {
        handleLocalNextShot();
      } else if (data.action === 'retake_all') {
        handleLocalRetakeAll();
      }
    });

    return () => {
      socket.off('photobooth_update');
    };
  }, []);

  // 2. MANAGEMENT KAMERA
  useEffect(() => {
    if (phase === 'shooting') {
      async function setupCamera() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: false
          });
          streamRef.current = stream;
          setCameraActive(true);
        } catch (err) {
          console.error("Gagal mengakses kamera:", err);
        }
      }
      setupCamera();
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setCameraActive(false);
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [phase]);

  // RE-ATTACH MEDIASTREAM KE ELEMENT VIDEO
  useEffect(() => {
    if (phase === 'shooting' && cameraActive && streamRef.current && shootingSubPhase === 'countdown') {
      if (localVideoRef1.current) {
        localVideoRef1.current.srcObject = streamRef.current;
      }
      if (localVideoRef2.current) {
        localVideoRef2.current.srcObject = streamRef.current;
      }
    }
  }, [phase, cameraActive, shootingSubPhase]);

  // 3. LOGIKA TRANSISI TUTORIAL -> FRAME SELECT
  useEffect(() => {
    if (phase === 'tutorial' && p1Ready && p2Ready) {
      setPhase('frame_select');
    }
  }, [p1Ready, p2Ready, phase]);

  // 4. TIMER COUNTDOWN PEMOTRETAN (10 DETIK)
  useEffect(() => {
    let timer = null;
    if (phase === 'shooting' && cameraActive && shootingSubPhase === 'countdown') {
      if (countdown > 0) {
        timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      } else {
        triggerSnapPhoto();
      }
    }
    return () => clearTimeout(timer);
  }, [phase, cameraActive, shootingSubPhase, countdown]);

  // 5. TIMER REVIEW PAUSE PER FOTO (5 DETIK UNTUK KEPUTUSAN RETAKE)
  useEffect(() => {
    let timer = null;
    if (phase === 'shooting' && shootingSubPhase === 'review_snap') {
      if (reviewTimer > 0) {
        timer = setTimeout(() => setReviewTimer(prev => prev - 1), 1000);
      } else {
        triggerNextShotAction();
      }
    }
    return () => clearTimeout(timer);
  }, [phase, shootingSubPhase, reviewTimer]);

  // HELPER CROP OBJECT-FIT UNTUK CANVAS
  const drawImageCover = (ctx, img, x, y, targetWidth, targetHeight) => {
    const imgRatio = img.width / img.height;
    const targetRatio = targetWidth / targetHeight;
    let sx, sy, sw, sh;

    if (imgRatio > targetRatio) {
      sh = img.height;
      sw = img.height * targetRatio;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      sw = img.width;
      sh = img.width / targetRatio;
      sx = 0;
      sy = (img.height - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, x, y, targetWidth, targetHeight);
  };

  // FUNGSI JEPRET FOTO
  const triggerSnapPhoto = () => {
    setIsFlash(true);
    setTimeout(() => setIsFlash(false), 200);

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    const activeVideo = localVideoRef1.current || localVideoRef2.current;

    if (activeVideo) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(activeVideo, 0, 0, canvas.width, canvas.height);
    }
    const snapUrl = canvas.toDataURL('image/png');

    const updatedSnaps = [...capturedPhotos];
    updatedSnaps[photoCount - 1] = { a: snapUrl, b: snapUrl };
    setCapturedPhotos(updatedSnaps);

    setShootingSubPhase('review_snap');
    setReviewTimer(5);
  };

  // LOGIKA RETAKE FOTO SAAT INI
  const handleLocalRetakeCurrentShot = () => {
    setCountdown(10);
    setShootingSubPhase('countdown');
  };

  const triggerRetakeCurrentShot = () => {
    handleLocalRetakeCurrentShot();
    socket.emit('photobooth_action', { room_code: roomCode, action: 'retake_current_shot' });
  };

  // LOGIKA LANJUT KE FOTO BERIKUTNYA / FINISH
  const handleLocalNextShot = () => {
    if (photoCount < 3) {
      setPhotoCount(prev => prev + 1);
      setCountdown(10);
      setShootingSubPhase('countdown');
    } else {
      setPhase('result');
      generateFinalPhotostrip(capturedPhotos, selectedFrame);
    }
  };

  const triggerNextShotAction = () => {
    handleLocalNextShot();
    socket.emit('photobooth_action', { room_code: roomCode, action: 'next_shot' });
  };

  // RETAKE ALL DARI RESULT
  const handleLocalRetakeAll = () => {
    setPhotoCount(1);
    setCountdown(10);
    setCapturedPhotos([]);
    setFinalPhotostripUrl(null);
    setShootingSubPhase('countdown');
    setPhase('shooting');
  };

  const triggerRetakeAllAction = () => {
    handleLocalRetakeAll();
    socket.emit('photobooth_action', { room_code: roomCode, action: 'retake_all' });
  };

  const loadImage = (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = src;
    });
  };

  // GABUNGKAN HASIL AKHIR PHOTOSTRIP
  const generateFinalPhotostrip = async (snaps, frameObj) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 1800;
      const ctx = canvas.getContext('2d');

      const frameImgPromise = loadImage(frameObj.src);
      const snapsPromises = snaps.slice(0, 3).map(async (snap) => {
        const imgA = await loadImage(snap.a);
        const imgB = await loadImage(snap.b);
        return { imgA, imgB };
      });

      const [frameImg, loadedSnaps] = await Promise.all([
        frameImgPromise,
        Promise.all(snapsPromises)
      ]);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const slotYPositions = [75, 531, 987];
      const photoW = 270;
      const photoH = 440;

      loadedSnaps.forEach(({ imgA, imgB }, idx) => {
        const y = slotYPositions[idx];
        drawImageCover(ctx, imgA, 35, y, photoW, photoH);
        drawImageCover(ctx, imgB, 295, y, photoW, photoH);
      });

      ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
      setFinalPhotostripUrl(canvas.toDataURL('image/png'));
    } catch (err) {
      console.error("Gagal membuat photostrip:", err);
    }
  };

  const handleConfirmTutorial = () => {
    socket.emit('photobooth_action', { room_code: roomCode, action: 'ready' });
  };

  const handleProposeFrame = (frame) => {
    socket.emit('photobooth_action', { room_code: roomCode, action: 'propose_frame', frame_id: frame.id });
  };

  const handleConfirmFrame = (isAgreed) => {
    if (isAgreed) {
      setSelectedFrame(proposedFrame);
      setPhase('shooting'); 
      setCountdown(10);
      setPhotoCount(1);
      setCapturedPhotos([]);
      setShootingSubPhase('countdown');
      socket.emit('photobooth_action', { room_code: roomCode, action: 'confirm_frame', agreed: true });
    } else {
      setProposedFrame(null);
      setProposedBy(null);
      socket.emit('photobooth_action', { room_code: roomCode, action: 'confirm_frame', agreed: false });
    }
  };

  const proposerName = proposedBy === 'p1' ? player1Name : player2Name;
  const currentSnap = capturedPhotos[photoCount - 1];

  return (
    <div className="screen-container start-screen-bg photobooth-layout">
      {isFlash && <div style={{ position: 'fixed', inset: 0, backgroundColor: '#fff', zIndex: 9999 }} />}

      {/* POP-UP TUTORIAL */}
      {phase === 'tutorial' && (
        <div className="game-over-overlay">
          <div className="game-over-box tutorial-box" style={{ maxWidth: '480px' }}>
            <h3 className="game-over-title">[ HOW TO PLAY PHOTOBOOTH ]</h3>
            <div className="tutorial-text-content" style={{ fontFamily: 'monospace', fontSize: '0.65rem', textAlign: 'left', lineHeight: '1.4', color: '#fff', margin: '15px 0' }}>
              <p style={{ color: 'var(--color-cyan)', fontWeight: 'bold' }}>1. PILIH FRAME BERSAMA</p>
              <p style={{ marginBottom: '10px' }}>Pilih style frame favorit kalian. Temanmu harus setuju sebelum mulai.</p>
              
              <p style={{ color: 'var(--color-cyan)', fontWeight: 'bold' }}>2. PEMOTRETAN (3 FOTO @ 10 DETIK)</p>
              <p style={{ marginBottom: '10px' }}>Setiap foto ada timer 10 detik. Posisikan wajah kalian di dalam box dual kamera!</p>

              <p style={{ color: 'var(--color-cyan)', fontWeight: 'bold' }}>3. RETAKE SETIAP FOTO</p>
              <p style={{ marginBottom: '10px' }}>Jika hasil foto kurang bagus, kalian bisa langsung klik [ RETAKE ] di tiap akhir jepretan!</p>
              
              <p style={{ color: 'var(--color-cyan)', fontWeight: 'bold' }}>4. DOWNLOAD PHOTOSTRIP</p>
              <p>Simpan hasil akhir photostrip langsung ke laptop kamu!</p>
            </div>

            <div style={{ marginTop: '20px' }}>
              <button 
                className="ttt-action-btn next-btn" 
                onClick={handleConfirmTutorial}
                disabled={isCurrentClientReady}
                style={{ opacity: isCurrentClientReady ? 0.5 : 1 }}
              >
                {isCurrentClientReady ? `[ WAITING... ] (${readyCount}/2)` : `[ MENGERTI ] (${readyCount}/2)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP KONFIRMASI FRAME */}
      {phase === 'frame_select' && proposedFrame && (
        <div className="game-over-overlay">
          <div className="game-over-box" style={{ maxWidth: '400px' }}>
            <h3 className="game-over-title">[ FRAME PROPOSAL ]</h3>
            <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#fff', margin: '15px 0' }}>
              {proposedBy === myRole 
                ? `Kamu mengusulkan frame "${proposedFrame.name}". Menunggu persetujuan teman...`
                : `${proposerName.toUpperCase()} memilih frame "${proposedFrame.name}". Gunakan bingkai ini?`
              }
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '15px 0' }}>
              <img 
                src={proposedFrame.src} 
                alt={proposedFrame.name} 
                style={{ height: '160px', borderRadius: '4px', border: `2px solid ${proposedFrame.color}` }}
                onError={(e) => { e.target.style.display = 'none'; }} 
              />
            </div>

            {proposedBy !== myRole ? (
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
                <button className="ttt-action-btn next-btn" onClick={() => handleConfirmFrame(true)}>
                  [ YES / SETUJU ]
                </button>
                <button className="ttt-action-btn exit-btn" onClick={() => handleConfirmFrame(false)}>
                  [ NO / PILIH LAIN ]
                </button>
              </div>
            ) : (
              <p style={{ fontSize: '0.65rem', color: '#ffb703', fontFamily: 'monospace' }}>
                [ WAITING FOR FRIEND CONFIRMATION... ]
              </p>
            )}
          </div>
        </div>
      )}

      {/* MONITOR UTAMA STUDIO */}
      <div className="game-match-wrapper" style={{ justifyContent: 'center', width: '100%', maxWidth: '900px', padding: '10px' }}>
        <div className="gartic-container-box" style={{ width: '100%', boxSizing: 'border-box' }}>
          
          <header className="gartic-header">
            <div className="gartic-score">
              <span>PLAYER 1: {player1Name.toUpperCase()}</span>
            </div>
            
            <div className="gartic-round-info" style={{ textAlign: 'center' }}>
              <div>VIRTUAL PHOTOBOOTH</div>
              <div style={{ color: '#02c39a', marginTop: '4px', fontSize: '0.7rem' }}>
                STATUS: {phase.toUpperCase().replace('_', ' ')}
              </div>
            </div>

            <div className="gartic-score">
              <span>PLAYER 2: {player2Name.toUpperCase()}</span>
            </div>
          </header>

          <div className="gartic-status-bar">
            {phase === 'tutorial' && <p className="status-text blink-text">WAITING FOR ALL PLAYERS TO READ TUTORIAL...</p>}
            {phase === 'frame_select' && <p className="status-text" style={{ color: 'var(--color-cyan)' }}>CHOOSE A FRAME TO CONTINUE</p>}
            {phase === 'shooting' && <p className="status-text winner-highlight">PHOTO {photoCount} OF 3 - {shootingSubPhase === 'countdown' ? 'GET READY!' : 'PREVIEW & DECIDE'}</p>}
            {phase === 'result' && <p className="status-text" style={{ color: 'var(--color-cyan)' }}>PHOTOSTRIP READY TO DOWNLOAD!</p>}
          </div>

          <div className="canvas-work-area" style={{ 
            display: 'flex', 
            justify: 'center', 
            alignItems: 'center', 
            padding: '20px', 
            minHeight: phase === 'result' ? '520px' : '380px', 
            boxSizing: 'border-box', 
            width: '100%' 
          }}>
            
            {/* 1. FASE FRAME SELECT */}
            {phase === 'frame_select' && (
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ 
                  display: 'flex',
                  justify: 'center',
                  alignItems: 'center',
                  gap: '20px',
                  flexWrap: 'wrap',
                  width: '100%',
                  maxWidth: '750px'
                }}>
                  {FRAME_OPTIONS.map((frame) => (
                    <div 
                      key={frame.id}
                      onClick={() => handleProposeFrame(frame)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        cursor: 'pointer',
                        padding: '12px',
                        backgroundColor: '#16213e',
                        border: `2px solid ${frame.color}`,
                        borderRadius: '6px',
                        width: '135px',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
                      }}
                    >
                      <img 
                        src={frame.src} 
                        alt={frame.name} 
                        style={{ height: '180px', objectFit: 'contain', marginBottom: '10px' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <span style={{ color: frame.color, fontFamily: 'monospace', fontSize: '0.65rem', textAlign: 'center', fontWeight: 'bold' }}>
                        [ {frame.name} ]
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. FASE SHOOTING */}
            {phase === 'shooting' && (
              <div style={{ display: 'flex', gap: '25px', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: '800px' }}>
                
                {/* A. SISI KIRI: MAIN DUAL CAMERA / PREVIEW BOX */}
                <div style={{ flex: '1 1 480px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  
                  <div style={{
                    width: '100%',
                    maxWidth: '480px',
                    height: '280px',
                    backgroundColor: '#000',
                    border: '3px solid var(--color-cyan)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    display: 'flex',
                    position: 'relative',
                    boxShadow: '0 0 15px rgba(76, 201, 240, 0.3)'
                  }}>
                    
                    {shootingSubPhase === 'countdown' ? (
                      <>
                        <div style={{ flex: 1, position: 'relative', borderRight: '2px solid #222', overflow: 'hidden' }}>
                          <video 
                            ref={localVideoRef1} 
                            autoPlay 
                            playsInline 
                            muted 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                          />
                          <div style={{ position: 'absolute', bottom: '8px', left: '8px', backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.6rem', padding: '2px 8px', fontFamily: 'monospace', borderRadius: '3px' }}>
                            [ {player1Name.toUpperCase()} ]
                          </div>
                        </div>

                        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                          <video 
                            ref={localVideoRef2} 
                            autoPlay 
                            playsInline 
                            muted 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                          />
                          <div style={{ position: 'absolute', bottom: '8px', left: '8px', backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.6rem', padding: '2px 8px', fontFamily: 'monospace', borderRadius: '3px' }}>
                            [ {player2Name.toUpperCase()} ]
                          </div>
                        </div>
                      </>
                    ) : (
                      currentSnap && (
                        <div style={{ display: 'flex', width: '100%', height: '100%' }}>
                          <img src={currentSnap.a} alt="Snap A" style={{ width: '50%', height: '100%', objectFit: 'cover', borderRight: '1px solid #222' }} />
                          <img src={currentSnap.b} alt="Snap B" style={{ width: '50%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )
                    )}

                  </div>
                  
                  <p style={{ marginTop: '10px', fontSize: '0.65rem', color: '#8d99ae', fontFamily: 'monospace' }}>
                    FRAME STYLE ACTIVE: <span style={{ color: selectedFrame.color, fontWeight: 'bold' }}>{selectedFrame.name}</span>
                  </p>
                </div>

                {/* B. SISI KANAN: SIDE PANEL TIMER & CONTROLS */}
                <div style={{ 
                  width: '230px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  backgroundColor: '#111827', 
                  border: '2px solid var(--color-cyan)', 
                  borderRadius: '8px', 
                  padding: '20px 15px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.6)'
                }}>
                  
                  <div style={{ fontSize: '0.7rem', color: '#8d99ae', fontFamily: 'monospace', marginBottom: '5px' }}>
                    POSING SESSION
                  </div>
                  <div style={{ fontSize: '1.2rem', color: '#02c39a', fontFamily: 'monospace', fontWeight: 'bold', marginBottom: '15px' }}>
                    FOTO {photoCount} / 3
                  </div>

                  {shootingSubPhase === 'countdown' ? (
                    <>
                      <div style={{ 
                        fontSize: '3rem', 
                        fontFamily: 'monospace', 
                        fontWeight: 'bold', 
                        color: countdown <= 3 ? '#F72585' : '#02c39a', 
                        margin: '10px 0',
                        textShadow: countdown <= 3 ? '0 0 10px #F72585' : '0 0 10px #02c39a'
                      }}>
                        {countdown}s
                      </div>
                      <p style={{ fontSize: '0.6rem', color: '#fff', fontFamily: 'monospace', textAlign: 'center', opacity: 0.8 }}>
                        Siap-siap bergaya! Kamera akan menjepret otomatis.
                      </p>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '0.65rem', color: '#ffb703', fontFamily: 'monospace', marginBottom: '10px', textAlign: 'center' }}>
                        FOTO {photoCount} TERTANGKAP!
                      </div>
                      
                      <button 
                        onClick={triggerRetakeCurrentShot}
                        className="ttt-action-btn exit-btn"
                        style={{ width: '100%', padding: '8px 5px', fontSize: '0.6rem', marginBottom: '8px' }}
                      >
                        [ RETAKE FOTO INI ]
                      </button>

                      <button 
                        onClick={triggerNextShotAction}
                        className="ttt-action-btn next-btn"
                        style={{ width: '100%', padding: '8px 5px', fontSize: '0.6rem' }}
                      >
                        {photoCount < 3 ? '[ LANJUT FOTO ' + (photoCount + 1) + ' ]' : '[ LIHAT HASIL AKHIR ]'} ({reviewTimer}s)
                      </button>
                    </>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                    {[0, 1, 2].map((idx) => (
                      <div 
                        key={idx} 
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: idx < photoCount - 1 ? '#02c39a' : (idx === photoCount - 1 ? '#F72585' : '#333'),
                          border: '1px solid #555'
                        }}
                      />
                    ))}
                  </div>

                </div>

              </div>
            )}

            {/* 3. HASIL FINISH & DOWNLOAD */}
            {phase === 'result' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', width: '100%' }}>
                {finalPhotostripUrl ? (
                  <>
                    <div style={{ 
                      display: 'flex', 
                      justify: 'center', 
                      alignItems: 'center', 
                      maxHeight: '420px', 
                      overflow: 'hidden',
                      padding: '10px'
                    }}>
                      <img 
                        src={finalPhotostripUrl} 
                        alt="Final Photostrip" 
                        style={{ 
                          maxHeight: '400px', 
                          height: 'auto', 
                          width: 'auto', 
                          border: '2px solid var(--color-cyan)', 
                          borderRadius: '4px', 
                          boxShadow: '0 0 12px rgba(76, 201, 240, 0.4)' 
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <a 
                        href={finalPhotostripUrl} 
                        download={`Photostrip_${selectedFrame.id}.png`}
                        className="ttt-action-btn next-btn"
                        style={{ textDecoration: 'none', padding: '10px 15px', display: 'inline-block' }}
                      >
                        [ DOWNLOAD PHOTOSTRIP ]
                      </a>
                      <button 
                        onClick={triggerRetakeAllAction}
                        className="ttt-action-btn exit-btn"
                        style={{ padding: '10px 15px' }}
                      >
                        [ RETAKE ]
                      </button>
                    </div>
                  </>
                ) : (
                  <p style={{ color: '#fff', fontFamily: 'monospace' }}>PROCESSING PHOTOSTRIP...</p>
                )}
              </div>
            )}

          </div>

          <div className="gartic-bottom-controls">
            <button className="ttt-action-btn exit-btn" onClick={onBackToDashboard}>[ LEAVE ]</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Photobooth;