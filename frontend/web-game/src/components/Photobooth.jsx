import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';

const FRAME_OPTIONS = [
  { id: 'pink', name: 'PASTEL PINK', src: '/frames/frame-pink.png', color: '#ffb3c1' },
  { id: 'grey', name: 'GREY CLASSIC', src: '/frames/frame-grey.png', color: '#8d99ae' },
  { id: 'blue', name: 'OCEAN BLUE', src: '/frames/frame-blue.png', color: '#a2d2ff' },
  { id: 'red', name: 'CRIMSON RED', src: '/frames/frame-red.png', color: '#ff4d6d' },
];

const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

function Photobooth({ currentUser, opponentName, roomCode, initialGameState, onBackToDashboard }) {
  const cleanCurrent = currentUser?.toUpperCase() || "PLAYER";
  const cleanOpponent = opponentName?.toUpperCase() || "FRIEND";
  
  const sortedPlayers = [cleanCurrent, cleanOpponent].sort();
  const p1Name = sortedPlayers[0];
  const p2Name = sortedPlayers[1];
  
  const isOfferer = cleanCurrent === p1Name;

  const [localReadySent, setLocalReadySent] = useState(false);
  const [iProposed, setIProposed] = useState(false); 

  const [phase, setPhase] = useState(initialGameState?.phase || 'tutorial');
  const [p1Ready, setP1Ready] = useState(initialGameState?.p1_ready || false);
  const [p2Ready, setP2Ready] = useState(initialGameState?.p2_ready || false);

  const [proposedFrame, setProposedFrame] = useState(null); 
  const [selectedFrame, setSelectedFrame] = useState(FRAME_OPTIONS[0]); 

  const localVideoRef1 = useRef(null); 
  const localVideoRef2 = useRef(null); 
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());
  const pcRef = useRef(null);

  const [photoCount, setPhotoCount] = useState(1);
  const [countdown, setCountdown] = useState(10);
  const [shootingSubPhase, setShootingSubPhase] = useState('countdown'); 
  const [reviewTimer, setReviewTimer] = useState(5);
  const [capturedPhotos, setCapturedPhotos] = useState([]); 
  const [isFlash, setIsFlash] = useState(false);
  const [finalPhotostripUrl, setFinalPhotostripUrl] = useState(null);

  const readyCount = (p1Ready ? 1 : 0) + (p2Ready ? 1 : 0);

  // ==========================================
  // WEBRTC PEER CONNECTION SETUP
  // ==========================================
  const createPeerConnection = () => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc_ice_candidate', {
          room_code: roomCode,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStreamRef.current.addTrack(track);
      });
      const remoteVideoElem = isOfferer ? localVideoRef2.current : localVideoRef1.current;
      if (remoteVideoElem) {
        remoteVideoElem.srcObject = remoteStreamRef.current;
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pcRef.current = pc;
    return pc;
  };

  // ==========================================
  // SOCKET LISTENERS
  // ==========================================
  useEffect(() => {
    socket.on('photobooth_update', (data) => {
      if (data.phase) setPhase(data.phase);
      if (data.p1_ready !== undefined) setP1Ready(data.p1_ready);
      if (data.p2_ready !== undefined) setP2Ready(data.p2_ready);
      
      if (data.proposed_frame !== undefined) {
        setProposedFrame(data.proposed_frame);
        if (data.proposed_frame === null) {
          setIProposed(false); 
        }
      }
      
      if (data.selected_frame) setSelectedFrame(data.selected_frame);
      
      if (data.action === 'retake_current_shot') handleLocalRetakeCurrentShot();
      else if (data.action === 'next_shot') handleLocalNextShot();
      else if (data.action === 'retake_all') handleLocalRetakeAll();
    });

    socket.on('webrtc_offer', async ({ offer }) => {
      if (!isOfferer) {
        const pc = createPeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_answer', { room_code: roomCode, answer: answer });
      }
    });

    socket.on('webrtc_answer', async ({ answer }) => {
      if (isOfferer && pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('webrtc_ice_candidate', async ({ candidate }) => {
      if (pcRef.current && candidate) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("ICE Error:", err);
        }
      }
    });

    return () => {
      socket.off('photobooth_update');
      socket.off('webrtc_offer');
      socket.off('webrtc_answer');
      socket.off('webrtc_ice_candidate');
    };
  }, [isOfferer, roomCode]);

  // ==========================================
  // START KAMERA & CALL WEBRTC
  // ==========================================
  useEffect(() => {
    if (phase === 'shooting') {
      async function startCameraAndWebRTC() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: false
          });
          localStreamRef.current = stream;

          const myVideoElem = isOfferer ? localVideoRef1.current : localVideoRef2.current;
          if (myVideoElem) myVideoElem.srcObject = stream;

          const remoteVideoElem = isOfferer ? localVideoRef2.current : localVideoRef1.current;
          if (remoteVideoElem && remoteStreamRef.current.getTracks().length > 0) {
            remoteVideoElem.srcObject = remoteStreamRef.current;
          }

          const pc = createPeerConnection();

          if (isOfferer) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('webrtc_offer', { room_code: roomCode, offer: offer });
          }
        } catch (err) {
          console.error("Camera/WebRTC failed:", err);
          // Alert dimunculkan agar user tahu kamera terblokir
          alert("Gagal mengakses kamera! Harap izinkan akses kamera di browser Anda lalu refresh halaman.");
        }
      }
      startCameraAndWebRTC();
    } else {
      cleanupMedia();
    }
    return () => cleanupMedia();
  }, [phase]);

  const cleanupMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
  };

  // ==========================================
  // GAME LOGIC & TIMERS
  // ==========================================
  useEffect(() => {
    if (phase === 'tutorial' && p1Ready && p2Ready) setPhase('frame_select');
  }, [p1Ready, p2Ready, phase]);

  useEffect(() => {
    let timer = null;
    if (phase === 'shooting' && shootingSubPhase === 'countdown') {
      if (countdown > 0) timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      else triggerSnapPhoto();
    }
    return () => clearTimeout(timer);
  }, [phase, shootingSubPhase, countdown]);

  useEffect(() => {
    let timer = null;
    if (phase === 'shooting' && shootingSubPhase === 'review_snap') {
      if (reviewTimer > 0) timer = setTimeout(() => setReviewTimer(prev => prev - 1), 1000);
      else triggerNextShotAction();
    }
    return () => clearTimeout(timer);
  }, [phase, shootingSubPhase, reviewTimer]);

  useEffect(() => {
    if (phase === 'result' && capturedPhotos.length >= 3) {
      generateFinalPhotostrip(capturedPhotos, selectedFrame);
    }
  }, [phase, capturedPhotos]);

  // ==========================================
  // SNAPSHOT & STRIP GENERATOR
  // ==========================================
  const triggerSnapPhoto = () => {
    setIsFlash(true);
    setTimeout(() => setIsFlash(false), 200);

    const canvas1 = document.createElement('canvas');
    canvas1.width = 640; canvas1.height = 480;
    const ctx1 = canvas1.getContext('2d');
    
    // Fallback warna hitam jika video gagal dimuat
    ctx1.fillStyle = '#111';
    ctx1.fillRect(0, 0, canvas1.width, canvas1.height);
    
    if (localVideoRef1.current && localVideoRef1.current.readyState >= 2) {
      ctx1.translate(canvas1.width, 0); ctx1.scale(-1, 1);
      ctx1.drawImage(localVideoRef1.current, 0, 0, canvas1.width, canvas1.height);
    }

    const canvas2 = document.createElement('canvas');
    canvas2.width = 640; canvas2.height = 480;
    const ctx2 = canvas2.getContext('2d');
    
    // Fallback warna hitam jika video gagal dimuat
    ctx2.fillStyle = '#111';
    ctx2.fillRect(0, 0, canvas2.width, canvas2.height);

    if (localVideoRef2.current && localVideoRef2.current.readyState >= 2) {
      ctx2.translate(canvas2.width, 0); ctx2.scale(-1, 1);
      ctx2.drawImage(localVideoRef2.current, 0, 0, canvas2.width, canvas2.height);
    }

    const snapA = canvas1.toDataURL('image/png');
    const snapB = canvas2.toDataURL('image/png');

    setCapturedPhotos((prevSnaps) => {
      const updated = [...prevSnaps];
      updated[photoCount - 1] = { a: snapA, b: snapB };
      return updated;
    });

    setShootingSubPhase('review_snap');
    setReviewTimer(5);
  };

  const handleLocalRetakeCurrentShot = () => {
    setCountdown(10);
    setShootingSubPhase('countdown');
  };

  const triggerRetakeCurrentShot = () => {
    handleLocalRetakeCurrentShot();
    socket.emit('photobooth_action', { room_code: roomCode, action: 'retake_current_shot' });
  };

  const handleLocalNextShot = () => {
    setPhotoCount((prevCount) => {
      if (prevCount < 3) {
        setCountdown(10);
        setShootingSubPhase('countdown');
        return prevCount + 1;
      } else {
        setPhase('result');
        return prevCount;
      }
    });
  };

  const triggerNextShotAction = () => {
    handleLocalNextShot();
    socket.emit('photobooth_action', { room_code: roomCode, action: 'next_shot' });
  };

  const handleLocalRetakeAll = () => {
    setPhotoCount(1); setCountdown(10); setCapturedPhotos([]);
    setFinalPhotostripUrl(null); setShootingSubPhase('countdown'); setPhase('shooting');
  };

  const triggerRetakeAllAction = () => {
    handleLocalRetakeAll();
    socket.emit('photobooth_action', { room_code: roomCode, action: 'retake_all' });
  };

  const drawImageCover = (ctx, img, x, y, targetWidth, targetHeight) => {
    const imgRatio = img.width / img.height;
    const targetRatio = targetWidth / targetHeight;
    let sx, sy, sw, sh;
    if (imgRatio > targetRatio) {
      sh = img.height; sw = img.height * targetRatio;
      sx = (img.width - sw) / 2; sy = 0;
    } else {
      sw = img.width; sh = img.width / targetRatio;
      sx = 0; sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, targetWidth, targetHeight);
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

const generateFinalPhotostrip = async (snaps, frameObj) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 600; 
      canvas.height = 1800;
      const ctx = canvas.getContext('2d');
      
      // Load frame dengan error handling
      const frameImgPromise = loadImage(frameObj.src).catch(() => null);
      
      // PERBAIKAN: Paksa perulangan tepat 3 kali (Index 0, 1, 2)
      // Ini mencegah crash jika array 'snaps' memiliki slot kosong (undefined)
      const snapsPromises = [0, 1, 2].map(async (i) => {
        const snap = snaps[i]; // Bisa undefined jika foto terlewat/error
        const imgA = snap?.a ? await loadImage(snap.a).catch(() => null) : null;
        const imgB = snap?.b ? await loadImage(snap.b).catch(() => null) : null;
        return { imgA, imgB };
      });
      
      const [frameImg, loadedSnaps] = await Promise.all([
        frameImgPromise, 
        Promise.all(snapsPromises)
      ]);
      
      // Beri warna dasar hitam (fallback jika ada foto yang gagal load)
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const slotYPositions = [75, 531, 987];
      const photoW = 270; 
      const photoH = 440;

      // Iterasi ke array yang sudah terjamin aman dari undefined
      loadedSnaps.forEach((loadedData, idx) => {
        // Fallback ke empty object {} jika data masih undefined
        const { imgA, imgB } = loadedData || {};
        const y = slotYPositions[idx];
        
        if (imgA) drawImageCover(ctx, imgA, 35, y, photoW, photoH);
        if (imgB) drawImageCover(ctx, imgB, 295, y, photoW, photoH);
      });
      
      // Gambar frame paling atas (jika berhasil diload)
      if (frameImg) {
        ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
      }
      
      setFinalPhotostripUrl(canvas.toDataURL('image/png'));
    } catch (err) { 
      console.error("Strip error:", err); 
    }
  };

  // ==========================================
  // BUTTON HANDLERS
  // ==========================================
  const handleConfirmTutorial = () => {
    if (localReadySent) return;
    setLocalReadySent(true);
    socket.emit('photobooth_action', { room_code: roomCode, action: 'ready' });
  };

  const handleProposeFrame = (frame) => {
    setIProposed(true);
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
      socket.emit('photobooth_action', { room_code: roomCode, action: 'confirm_frame', agreed: false });
    }
    setIProposed(false);
  };

  const currentSnap = capturedPhotos[photoCount - 1] || {};

  return (
    <div className="screen-container start-screen-bg photobooth-layout">
      {isFlash && <div style={{ position: 'fixed', inset: 0, backgroundColor: '#fff', zIndex: 9999 }} />}

      {/* TUTORIAL MODAL */}
      {phase === 'tutorial' && (
        <div className="game-over-overlay">
          <div className="game-over-box tutorial-box" style={{ maxWidth: '480px' }}>
            <h3 className="game-over-title">[ HOW TO PLAY PHOTOBOOTH ]</h3>
            <div className="tutorial-text-content" style={{ fontFamily: 'monospace', fontSize: '0.65rem', textAlign: 'left', lineHeight: '1.4', color: '#fff', margin: '15px 0' }}>
              <p style={{ color: 'var(--color-cyan)', fontWeight: 'bold' }}>1. PILIH FRAME BERSAMA</p>
              <p style={{ marginBottom: '10px' }}>Pilih style frame favorit kalian. Temanmu harus setuju sebelum mulai.</p>
              <p style={{ color: 'var(--color-cyan)', fontWeight: 'bold' }}>2. WEBRTC LIVE VIDEO</p>
              <p style={{ marginBottom: '10px' }}>Sekarang kalian bisa melihat satu sama lain secara live saat berpose!</p>
            </div>
            <div style={{ marginTop: '20px' }}>
              <button 
                className="ttt-action-btn next-btn" 
                onClick={handleConfirmTutorial} 
                disabled={localReadySent} 
                style={{ opacity: localReadySent ? 0.5 : 1 }}
              >
                {localReadySent ? `[ WAITING... ] (${readyCount}/2)` : `[ MENGERTI ] (${readyCount}/2)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FRAME PROPOSAL MODAL */}
      {phase === 'frame_select' && proposedFrame && (
        <div className="game-over-overlay">
          <div className="game-over-box" style={{ maxWidth: '400px' }}>
            <h3 className="game-over-title">[ FRAME PROPOSAL ]</h3>
            <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#fff', margin: '15px 0' }}>
              {iProposed 
                ? `Kamu mengusulkan frame "${proposedFrame.name}". Menunggu persetujuan teman...`
                : `${cleanOpponent} memilih frame "${proposedFrame.name}". Gunakan bingkai ini?`
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

            {!iProposed ? (
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
                <button className="ttt-action-btn next-btn" onClick={() => handleConfirmFrame(true)}>[ YES / SETUJU ]</button>
                <button className="ttt-action-btn exit-btn" onClick={() => handleConfirmFrame(false)}>[ NO / PILIH LAIN ]</button>
              </div>
            ) : (
              <p style={{ fontSize: '0.65rem', color: '#ffb703', fontFamily: 'monospace' }}>[ WAITING FOR CONFIRMATION... ]</p>
            )}
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="game-match-wrapper" style={{ justifyContent: 'center', width: '100%', maxWidth: '900px', padding: '10px' }}>
        <div className="gartic-container-box" style={{ width: '100%', boxSizing: 'border-box' }}>
          
          <header className="gartic-header">
            <div className="gartic-score"><span>PLAYER 1: {p1Name}</span></div>
            <div className="gartic-round-info" style={{ textAlign: 'center' }}>
              <div>VIRTUAL PHOTOBOOTH</div>
              <div style={{ color: '#02c39a', marginTop: '4px', fontSize: '0.7rem' }}>STATUS: {phase.toUpperCase().replace('_', ' ')}</div>
            </div>
            <div className="gartic-score"><span>PLAYER 2: {p2Name}</span></div>
          </header>

          <div className="canvas-work-area" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', minHeight: phase === 'result' ? '520px' : '380px', boxSizing: 'border-box', width: '100%' }}>
            
            {phase === 'frame_select' && (
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', flexWrap: 'wrap', width: '100%', maxWidth: '750px' }}>
                  {FRAME_OPTIONS.map((frame) => (
                    <div 
                      key={frame.id}
                      onClick={() => handleProposeFrame(frame)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', padding: '12px', backgroundColor: '#16213e', border: `2px solid ${frame.color}`, borderRadius: '6px', width: '135px', transition: 'transform 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}
                    >
                      <img src={frame.src} alt={frame.name} style={{ height: '180px', objectFit: 'contain', marginBottom: '10px' }} onError={(e) => { e.target.style.display = 'none'; }} />
                      <span style={{ color: frame.color, fontFamily: 'monospace', fontSize: '0.65rem', textAlign: 'center', fontWeight: 'bold' }}>[ {frame.name} ]</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {phase === 'shooting' && (
              <div style={{ display: 'flex', gap: '25px', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: '800px' }}>
                
                <div style={{ flex: '1 1 480px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '100%', maxWidth: '480px', height: '280px', backgroundColor: '#000', border: '3px solid var(--color-cyan)', borderRadius: '8px', overflow: 'hidden', display: 'flex', position: 'relative', boxShadow: '0 0 15px rgba(76, 201, 240, 0.3)' }}>
                    
                    {shootingSubPhase === 'countdown' ? (
                      <>
                        {/* BOX KIRI (P1) */}
                        <div style={{ flex: 1, position: 'relative', borderRight: '2px solid #222', overflow: 'hidden', backgroundColor: '#111' }}>
                          <video 
                            ref={localVideoRef1} 
                            autoPlay 
                            playsInline 
                            muted={isOfferer} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} 
                          />
                          <div style={{ position: 'absolute', bottom: '8px', left: '8px', backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.6rem', padding: '2px 8px', fontFamily: 'monospace', borderRadius: '3px' }}>
                            [ {p1Name} {isOfferer ? '(YOU)' : ''} ]
                          </div>
                        </div>

                        {/* BOX KANAN (P2) */}
                        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#111' }}>
                          <video 
                            ref={localVideoRef2} 
                            autoPlay 
                            playsInline 
                            muted={!isOfferer} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} 
                          />
                          <div style={{ position: 'absolute', bottom: '8px', left: '8px', backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.6rem', padding: '2px 8px', fontFamily: 'monospace', borderRadius: '3px' }}>
                            [ {p2Name} {!isOfferer ? '(YOU)' : ''} ]
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#111' }}>
                        <div style={{ width: '50%', height: '100%', borderRight: '1px solid #222', position: 'relative' }}>
                           {currentSnap.a ? <img src={currentSnap.a} alt="Snap A" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555', fontSize: '0.6rem' }}>LOADING...</div>}
                        </div>
                        <div style={{ width: '50%', height: '100%', position: 'relative' }}>
                           {currentSnap.b ? <img src={currentSnap.b} alt="Snap B" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555', fontSize: '0.6rem' }}>LOADING...</div>}
                        </div>
                      </div>
                    )}
                  </div>
                  <p style={{ marginTop: '10px', fontSize: '0.65rem', color: '#8d99ae', fontFamily: 'monospace' }}>
                    FRAME STYLE ACTIVE: <span style={{ color: selectedFrame.color, fontWeight: 'bold' }}>{selectedFrame.name}</span>
                  </p>
                </div>

                <div style={{ width: '230px', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#111827', border: '2px solid var(--color-cyan)', borderRadius: '8px', padding: '20px 15px', boxShadow: '0 4px 12px rgba(0,0,0,0.6)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#8d99ae', fontFamily: 'monospace', marginBottom: '5px' }}>POSING SESSION</div>
                  <div style={{ fontSize: '1.2rem', color: '#02c39a', fontFamily: 'monospace', fontWeight: 'bold', marginBottom: '15px' }}>FOTO {photoCount} / 3</div>

                  {shootingSubPhase === 'countdown' ? (
                    <>
                      <div style={{ fontSize: '3rem', fontFamily: 'monospace', fontWeight: 'bold', color: countdown <= 3 ? '#F72585' : '#02c39a', margin: '10px 0', textShadow: countdown <= 3 ? '0 0 10px #F72585' : '0 0 10px #02c39a' }}>{countdown}s</div>
                      <p style={{ fontSize: '0.6rem', color: '#fff', fontFamily: 'monospace', textAlign: 'center', opacity: 0.8 }}>Siap-siap bergaya! Kamera akan menjepret otomatis.</p>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '0.65rem', color: '#ffb703', fontFamily: 'monospace', marginBottom: '10px', textAlign: 'center' }}>FOTO {photoCount} TERTANGKAP!</div>
                      <button onClick={triggerRetakeCurrentShot} className="ttt-action-btn exit-btn" style={{ width: '100%', padding: '8px 5px', fontSize: '0.6rem', marginBottom: '8px' }}>[ RETAKE FOTO INI ]</button>
                      <button onClick={triggerNextShotAction} className="ttt-action-btn next-btn" style={{ width: '100%', padding: '8px 5px', fontSize: '0.6rem' }}>{photoCount < 3 ? '[ LANJUT FOTO ' + (photoCount + 1) + ' ]' : '[ LIHAT HASIL AKHIR ]'} ({reviewTimer}s)</button>
                    </>
                  )}
                </div>

              </div>
            )}

            {phase === 'result' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', width: '100%' }}>
                {finalPhotostripUrl ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', maxHeight: '420px', overflow: 'hidden', padding: '10px' }}>
                      <img src={finalPhotostripUrl} alt="Final Photostrip" style={{ maxHeight: '400px', height: 'auto', width: 'auto', border: '2px solid var(--color-cyan)', borderRadius: '4px', boxShadow: '0 0 12px rgba(76, 201, 240, 0.4)' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <a href={finalPhotostripUrl} download={`Photostrip_${selectedFrame.id}.png`} className="ttt-action-btn next-btn" style={{ textDecoration: 'none', padding: '10px 15px', display: 'inline-block' }}>[ DOWNLOAD PHOTOSTRIP ]</a>
                      <button onClick={triggerRetakeAllAction} className="ttt-action-btn exit-btn" style={{ padding: '10px 15px' }}>[ RETAKE ]</button>
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