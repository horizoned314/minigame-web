import React from 'react';

const PixelHeart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" className="pixel-heart-icon">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>
);

function StartScreen({ onNewGame, onLoadGame }) {
  return (
    <div className="screen-container start-screen-bg">
      <div className="crt-overlay"></div>
      
      <div className="arcade-hud">
        <div className="hud-item">
          <span className="hud-label player-cyan">1P</span>
          <div className="heart-container">
            <PixelHeart />
            <PixelHeart />
            <PixelHeart />
          </div>
        </div>
        
        <div className="hud-item">
          <span className="hud-label highscore-color">HIGH SCORE</span>
          <span className="hud-score">9999</span>
        </div>
        
        <div className="hud-item">
          <span className="hud-label player-cyan">2P</span>
          <div className="heart-container">
            <PixelHeart />
            <PixelHeart />
            <PixelHeart />
          </div>
        </div>
      </div>

      <div className="content-wrapper">
        <h1 className="retro-main-title">
          PLAY<br/>GROUND
        </h1>
    
        <div className="menu-options">
          <button className="menu-btn" onClick={onNewGame}>
            <span className="cursor">&gt;</span> 
            NEW GAME <span className="auth-hint">(SIGN UP)</span>
          </button>
          
          <button className="menu-btn" onClick={onLoadGame}>
            <span className="cursor">&gt;</span> 
            LOAD GAME <span className="auth-hint">(LOGIN)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default StartScreen;