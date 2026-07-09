import React, { useState, useEffect } from 'react';
import { socket } from '../socket';

const MailIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" className="pixel-mail-icon">
    <path d="M2 4h20v16H2V4zm2 4v10h16V8l-8 5-8-5zm0-2l8 5 8-5H4z" />
  </svg>
);

// Tambahkan onStartGame di baris props bawah ini
function Dashboard({ currentUser, onLogout, onStartGame, socket }) {
  const minigames = [
    { id: 'ttt', name: 'TIC TAC TOE', desc: 'CONNECT 3 TO WIN' },
    { id: 'gartic', name: 'GARTIC', desc: 'DRAW AND GUESS' },
    { id: 'tod', name: 'TRUTH OR DARE', desc: 'CHOOSE YOUR FATE' },
    { id: 'photo', name: 'PHOTOBOOTH', desc: 'RETRO SNAPSHOT' }
  ];

  const [activeInviteInput, setActiveInviteInput] = useState(null);
  const [friendName, setFriendName] = useState('');
  const [showMailDropdown, setShowMailDropdown] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [targetFriend, setTargetFriend] = useState('');

  const [invitations, setInvitations] = useState([]);

  useEffect(() => {
    const fetchInvites = async () => {
      try {
        // Asumsi currentUser adalah username yang sedang login (misal: "ruuna")
        const response = await fetch(`http://127.0.0.1:8000/invites/${currentUser.toUpperCase()}`);
        if (response.ok) {
          const data = await response.json();
          // Backend mengembalikan format camelCase/snake_case, kita sesuaikan
          const formattedData = data.map(inv => ({
            id: inv.id,
            fromUser: inv.from_user,
            gameName: inv.game_name
          }));
          setInvitations(formattedData);
        }
      } catch (error) {
        console.error("Gagal mengambil pesan:", error);
      }
    };

    fetchInvites();
    
    // Polling: Cek pesan baru setiap 5 detik
    const interval = setInterval(fetchInvites, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

// Tambahkan useEffect khusus Socket ini di dalam Dashboard
  useEffect(() => {
    socket.connect(); // Nyalakan mesin socket saat masuk dashboard

    socket.on("teleport_to_game", (data) => {
      // Cek apakah panggilan ini untuk SAYA?
      if (data.inviter === currentUser || data.invitee === currentUser) {
        
        // Tentukan siapa musuh saya
        const myOpponent = data.inviter === currentUser ? data.invitee : data.inviter;
        
        // Masuk ke ruangan socket
        socket.emit("join_room", { room_code: data.room_code });
        
        // Pindah layar secara paksa! (Pastikan App.jsx Anda menerima 2 argumen ini)
        onStartGame(myOpponent, data.room_code); 
      }
    });

    return () => {
      socket.off("teleport_to_game");
    };
  }, [currentUser]);

  const handleInviteFriend = async (e, gameName) => {
    e.preventDefault();
    if (!friendName.trim()) {
      alert('ENTER A VALID USERNAME!');
      return;
    }
    
    const cleanName = friendName.toUpperCase();
    setTargetFriend(cleanName);
    setIsWaiting(true);
    
    try {
      const response = await fetch("http://127.0.0.1:8000/invites/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_user: currentUser,
          to_user: cleanName,
          game_name: gameName
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`INVITATION SENT TO [${cleanName}]!`);
        setIsWaiting(false);
        setFriendName('');
        setActiveInviteInput(null);
        // Catatan: onStartGame tidak otomatis dipanggil di sini. 
        // Anda baru masuk game setelah teman meng-Accept.
      } else {
        alert("ERROR: " + data.detail.toUpperCase());
        setIsWaiting(false);
      }
    } catch (error) {
      console.error("Gagal mengirim undangan:", error);
      setIsWaiting(false);
    }
  };

  const handleCancelInvite = () => {
    setIsWaiting(false);
    setTargetFriend('');
  };

  const handleAcceptInvite = async (id, fromUser, gameName) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/invites/${id}/accept`, {
        method: "PUT"
      });
      
      if (response.ok) {
        setInvitations(invitations.filter((invite) => invite.id !== id));
        
        // --- TAMBAHAN BARU: Picu Sinyal Teleport via Socket ---
        // Kita jadikan ID undangan (uuid) sebagai Room Code
        socket.emit("trigger_game_start", {
          inviter: fromUser,      // Yang mengirim (P2)
          invitee: currentUser,   // Yang menerima (P1)
          room_code: id 
        });
        
        // HAPUS onStartGame() dari sini, biarkan useEffect Socket yang memindahkannya
      }
    } catch (error) {
      console.error("Gagal menerima undangan:", error);
    }
  };

  const handleRejectInvite = async (id) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/invites/${id}/reject`, {
        method: "PUT"
      });
      
      if (response.ok) {
        setInvitations(invitations.filter((invite) => invite.id !== id));
      }
    } catch (error) {
      console.error("Gagal menolak undangan:", error);
    }
  };

  return (
    <div className="screen-container start-screen-bg dashboard-layout">
      <div className="crt-overlay"></div>

      {isWaiting && (
        <div className="modal-overlay">
          <div className="retro-modal-box">
            <div className="pixel-spinner"></div>
            <p className="modal-loading-text">
              {"WAITING FOR " + targetFriend + " TO ACCEPT YOUR INVITATION..."}
            </p>
            <button className="modal-cancel-btn" onClick={handleCancelInvite}>
              {"[ CANCEL ]"}
            </button>
          </div>
        </div>
      )}

      <header className="dashboard-header">
        <div className="header-logo">PLAY GROUND</div>
        
        <div className="header-status-zone">
          <div className="mail-container-wrapper">
            <button className="mail-btn" onClick={() => setShowMailDropdown(!showMailDropdown)}>
              <MailIcon />
              {invitations.length > 0 && <span className="notification-dot"></span>}
            </button>

            {showMailDropdown && (
              <div className="mail-dropdown-box">
                <div className="dropdown-title">INVITATIONS</div>
                {invitations.length === 0 ? (
                  <p className="no-invites-text">NO NEW REQUESTS</p>
                ) : (
                  <div className="invites-list">
                    {invitations.map((invite) => (
                      <div key={invite.id} className="invite-item">
                        <div className="invite-info">
                          <span className="invite-sender">[{invite.fromUser}]</span>
                          <span className="invite-game">INVITED YOU TO PLAY {invite.gameName}</span>
                        </div>
                        <div className="invite-actions">
                          <button 
                            className="invite-btn accept" 
                            onClick={() => handleAcceptInvite(invite.id, invite.fromUser, invite.gameName)}
                          >
                            [ACC]
                          </button>
                          <button 
                            className="invite-btn reject" 
                            onClick={() => handleRejectInvite(invite.id)}
                          >
                            [X]
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="user-online-container">
            <span className="user-online-tag">[{currentUser}] ONLINE</span>
            <span className="blinking-green-dot"></span>
          </div>
          
          <button className="dash-logout-btn" onClick={onLogout}>[EXIT]</button>
        </div>
      </header>

      <main className="games-section">
        <h2 className="select-game-title">SELECT CHALLENGE</h2>
        
        <div className="games-grid">
          {minigames.map((game) => (
            <div key={game.id} className="game-card">
              <div className="game-card-info">
                <h3 className="game-name">{game.name}</h3>
                <p className="game-desc">{game.desc}</p>
              </div>

              <div className="game-modes-drawer">
                {activeInviteInput !== game.id ? (
                  <div className="mode-options-row">
                    <button className="mode-select-btn" onClick={() => setActiveInviteInput(game.id)}>
                      {" > PLAY"}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={(e) => handleInviteFriend(e, game.name)} className="friend-input-form">
                    <input 
                      type="text" 
                      className="friend-retro-input"
                      placeholder="FRIEND ID"
                      maxLength={10}
                      value={friendName}
                      onChange={(e) => setFriendName(e.target.value.replace(/\s/g, ''))}
                    />
                    <div className="form-controls">
                      <button type="submit" className="form-action-btn submit-color">[OK]</button>
                      <button type="button" className="form-action-btn cancel-color" onClick={() => setActiveInviteInput(null)}>[X]</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="dashboard-footer">
        <p>made by ruuna & horizon.</p>
      </footer>
    </div>
  );
}

export default Dashboard;