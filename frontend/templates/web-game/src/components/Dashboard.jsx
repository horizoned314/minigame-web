import React, { useState } from 'react';

const MailIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" className="pixel-mail-icon">
    <path d="M2 4h20v16H2V4zm2 4v10h16V8l-8 5-8-5zm0-2l8 5 8-5H4z"/>
  </svg>
);

function Dashboard({ currentUser, onLogout }) {
  const minigames = [
    { id: 'ttt', name: 'TIC TAC TOE', desc: 'CONNECT 3 TO WIN' },
    { id: 'gartic', name: 'GARTIC', desc: 'DRAW AND GUESS' },
    { id: 'tod', name: 'TRUTH OR DARE', desc: 'CHOOSE YOUR FATE' },
    { id: 'photo', name: 'PHOTOBOOTH', desc: 'RETRO SNAPSHOT' }
  ];

  const [active2PInput, setActive2PInput] = useState(null);
  const [friendName, setFriendName] = useState('');

  const handlePlay1P = (gameName) => {
    alert(`LAUNCHING ${gameName} [1P MODE]...`);
  };

  const handleInviteFriend = (e, gameName) => {
    e.preventDefault();
    if (!friendName.trim()) {
      alert('ENTER A VALID USERNAME!');
      return;
    }
    alert(`INVITATION SENT TO [${friendName.toUpperCase()}] FOR ${gameName}!`);
    setFriendName('');
    setActive2PInput(null);
  };

  return (
    <div className="screen-container start-screen-bg dashboard-layout">
      <div className="crt-overlay"></div>

      <header className="dashboard-header">
        <div className="header-logo">PLAY GROUND</div>
        <div className="header-status-zone">
          <button className="mail-btn" onClick={() => alert('NO NEW MABAR INVITES AT THE MOMENT.')}>
            <MailIcon />
            <span className="notification-dot"></span>
          </button>
          
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
                {active2PInput !== game.id ? (
                  <div className="mode-options-row">
                    <button className="mode-select-btn" onClick={() => handlePlay1P(game.name)}>
                      &gt; 1P
                    </button>
                    <button className="mode-select-btn" onClick={() => setActive2PInput(game.id)}>
                      &gt; 2P
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
                      <button type="button" className="form-action-btn cancel-color" onClick={() => setActive2PInput(null)}>[X]</button>
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