import React, { useState } from 'react';

const MailIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" className="pixel-mail-icon">
    <path d="M2 4h20v16H2V4zm2 4v10h16V8l-8 5-8-5zm0-2l8 5 8-5H4z" />
  </svg>
);

// Tambahkan onStartGame di baris props bawah ini
function Dashboard({ currentUser, onLogout, onStartGame }) {
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

  const [invitations, setInvitations] = useState([
    { id: 1, fromUser: 'DEKU_99', gameName: 'TIC TAC TOE' },
    { id: 2, fromUser: 'KACCHAN', gameName: 'GARTIC' }
  ]);

  const handleInviteFriend = (e, gameName) => {
    e.preventDefault();
    if (!friendName.trim()) {
      alert('ENTER A VALID USERNAME!');
      return;
    }
    
    const cleanName = friendName.toUpperCase();
    setTargetFriend(cleanName);
    setIsWaiting(true);
    
    // SIMULASI TIMER (BACKEND PALSU): 
    // Ceritanya nunggu 2 detik, lalu musuh menerima invite, dan game dimulai!
    setTimeout(() => {
      setIsWaiting(false);
      setFriendName('');
      setActiveInviteInput(null);
      
      // Pindah ke halaman TicTacToe bawa nama temanmu
      onStartGame(cleanName); 
    }, 2000); 
  };

  const handleCancelInvite = () => {
    setIsWaiting(false);
    setTargetFriend('');
  };

  const handleAcceptInvite = (id, fromUser, gameName) => {
    setInvitations(invitations.filter((invite) => invite.id !== id));
    
    // Langsung masuk ke game bawa nama orang yang nginvite kamu
    onStartGame(fromUser.toUpperCase());
  };

  const handleRejectInvite = (id) => {
    setInvitations(invitations.filter((invite) => invite.id !== id));
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