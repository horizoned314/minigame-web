import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';

const MailIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" className="pixel-mail-icon">
    <path d="M2 4h20v16H2V4zm2 4v10h16V8l-8 5-8-5zm0-2l8 5 8-5H4z" />
  </svg>
);

function Dashboard({ currentUser, onLogout }) {
  const API_BASE_URL = 'https://api.playgrounds.web.id';

  const minigames = [
    { id: 'tictactoe', name: 'TIC TAC TOE', desc: 'CONNECT 3 TO WIN' },
    { id: 'gartic', name: 'GARTIC', desc: 'DRAW AND GUESS' },
    { id: 'photobooth', name: 'PHOTOBOOTH', desc: 'RETRO SNAPSHOT' }
  ];

  const [activeInviteInput, setActiveInviteInput] = useState(null);
  const [friendName, setFriendName] = useState('');
  const [showMailDropdown, setShowMailDropdown] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [targetFriend, setTargetFriend] = useState('');
  const [createdRoomCode, setCreatedRoomCode] = useState('');
  const [createdInviteId, setCreatedInviteId] = useState(null);
  const inviteFlowRef = useRef(0);

  const [invitations, setInvitations] = useState([]);

  useEffect(() => {
    const fetchInvites = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/invites/${encodeURIComponent(currentUser.toUpperCase())}`, {
        });
        if (response.ok) {
          const data = await response.json();
          const formattedData = data.map(inv => ({
            id: inv.id,
            roomCode: inv.room_code,
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
    
    const interval = setInterval(fetchInvites, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleInviteFriend = async (e, gameName, gameId) => {
    e.preventDefault();

    if (!friendName.trim()) {
      alert("ENTER A VALID USERNAME!");
      return;
    }

    const cleanName = friendName.trim().toUpperCase();

    if (cleanName === String(currentUser).toUpperCase()) {
      alert("YOU CANNOT INVITE YOURSELF!");
      return;
    }

    // Setiap alur undangan punya id sendiri. Kalau user menekan CANCEL saat
    // request masih berjalan, hasil request yang telat tidak boleh membuat
    // room/undangan yatim.
    const flowId = ++inviteFlowRef.current;

    setTargetFriend(cleanName);
    setIsWaiting(true);

    socket.timeout(8000).emit("create_room", { game_type: gameId }, async (err, res) => {
      if (flowId !== inviteFlowRef.current) {
        if (res?.status === "success" && res.room_code) {
          socket.emit("leave_room", { room_code: res.room_code });
        }
        return;
      }

      if (err || !res || res.status !== "success") {
        alert(err ? "Server tidak merespons. Coba lagi." : (res?.message || "Gagal membuat room"));
        setIsWaiting(false);
        return;
      }

      const roomCode = res.room_code;
      setCreatedRoomCode(roomCode);

      try {
        const response = await fetch(`${API_BASE_URL}/invites/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from_user: currentUser,
            to_user: cleanName,
            game_name: gameName,
            room_code: roomCode
          })
        });

        const data = await response.json();

        if (flowId !== inviteFlowRef.current) {
          // User sudah membatalkan; bersihkan undangan + room yang telat dibuat.
          if (response.ok && data.id) {
            fetch(`${API_BASE_URL}/invites/${data.id}`, { method: "DELETE" }).catch(() => {});
          }
          socket.emit("leave_room", { room_code: roomCode });
          return;
        }

        if (!response.ok) {
          alert(data.detail || "ERROR");
          socket.emit("leave_room", { room_code: roomCode });
          setCreatedRoomCode('');
          setIsWaiting(false);
          return;
        }

        setCreatedInviteId(data.id || null);
        alert(`INVITATION SENT TO [${cleanName}]!`);

        setFriendName("");
        setActiveInviteInput(null);

      } catch (err) {
        console.error(err);
        socket.emit("leave_room", { room_code: roomCode });
        setCreatedRoomCode('');
        setIsWaiting(false);
        alert("Gagal mengirim undangan. Coba lagi.");
      }
    });
  };

  const handleCancelInvite = async () => {
    // Invalidate alur undangan yang mungkin masih menunggu respons.
    inviteFlowRef.current += 1;

    const inviteId = createdInviteId;

    // Hapus undangan yang masih pending supaya tidak muncul di kotak masuk teman
    if (inviteId) {
      try {
        await fetch(`${API_BASE_URL}/invites/${inviteId}`, { method: "DELETE" });
      } catch (err) {
        console.error("Gagal membatalkan undangan:", err);
      }
    }

    // Keluar dari room supaya event dari room lama tidak nyasar ke layar game
    if (createdRoomCode) {
      socket.emit("leave_room", { room_code: createdRoomCode });
    }

    setCreatedInviteId(null);
    setCreatedRoomCode('');
    setIsWaiting(false);
    setTargetFriend('');
  };

  const handleLogout = async () => {
    // Jangan tinggalkan undangan pending / room yatim saat keluar.
    if (createdInviteId || createdRoomCode || isWaiting) {
      await handleCancelInvite();
    }
    onLogout();
  };

  const handleAcceptInvite = async (inviteId, roomCode, inviter) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/invites/${inviteId}/accept`,
        {
          method: "PUT"
        }
      );

      if (!response.ok) {
        alert("Undangan sudah tidak valid.");
        setInvitations((prev) => prev.filter((inv) => inv.id !== inviteId));
        return;
      }

      // Gunakan room_code dari server. Kalau pengundang sempat memperbarui
      // undangan (room baru), data lama di inbox bisa menunjuk room yang salah.
      const accepted = await response.json().catch(() => ({}));
      const activeRoomCode = accepted.room_code || roomCode;

      setInvitations((prev) =>
        prev.filter((inv) => inv.id !== inviteId)
      );

      socket.timeout(8000).emit("join_room", {
        room_code: activeRoomCode,
        inviter: inviter,
        invitee: currentUser
      }, (err, res) => {
        if (err || !res || res.status !== "success") {
          alert(err ? "Server tidak merespons. Coba lagi." : (res?.message || "Gagal masuk ke room. Mungkin room sudah ditutup."));
        }
      });

    } catch (err) {
      console.error(err);
      alert("Gagal menerima undangan.");
    }
  };

  const handleRejectInvite = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/invites/${id}/reject`, {
        method: "PUT"
      });
      
      if (response.ok) {
        setInvitations(prev =>
          prev.filter(invite => invite.id !== id)
        );
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
                            onClick={() =>
                              handleAcceptInvite(
                                  invite.id,
                                  invite.roomCode,
                                  invite.fromUser
                              )
                            }
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
          
          <button className="dash-logout-btn" onClick={handleLogout}>[EXIT]</button>
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
                  <form onSubmit={(e) => handleInviteFriend(e, game.name, game.id)} className="friend-input-form">
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