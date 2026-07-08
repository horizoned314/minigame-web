import React, { useState } from 'react';
import './App.css';
import StartScreen from './components/StartScreen';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import TicTacToe from './components/TicTacToe'; // <-- Import game barumu

function App() {
  const [screen, setScreen] = useState('start'); 
  const [authMode, setAuthMode] = useState(''); 
  const [currentUser, setCurrentUser] = useState('');
  const [opponent, setOpponent] = useState(''); // <-- State untuk simpan nama musuh

  const handleNewGame = () => {
    setAuthMode('register');
    setScreen('auth');
  };

  const handleLoadGame = () => {
    setAuthMode('login');
    setScreen('auth');
  };

  const handleAuthSuccess = (username) => {
    setCurrentUser(username);
    setScreen('dashboard');
  };

  const handleBackToMenu = () => {
    setScreen('start');
  };

  // FUNGSI BARU: Untuk pindah dari dashboard ke game Tic Tac Toe
  const handleStartGame = (opponentName) => {
    setOpponent(opponentName);
    setScreen('ttt'); // Pindah ke screen game
  };

  const handleBackToDashboard = () => {
    setScreen('dashboard');
  };

  return (
    <div className="app-wrapper">
      {screen === 'start' && (
        <StartScreen 
          onNewGame={handleNewGame} 
          onLoadGame={handleLoadGame} 
        />
      )}
      
      {screen === 'auth' && (
        <AuthScreen 
          authMode={authMode}
          onAuthSuccess={handleAuthSuccess}
          onBack={handleBackToMenu}
        />
      )}

      {screen === 'dashboard' && (
        <Dashboard 
          currentUser={currentUser} 
          onLogout={handleBackToMenu} 
          onStartGame={handleStartGame} // <-- Oper fungsi ini ke Dashboard
        />
      )}

      {/* RENDER SCREEN TIC TAC TOE */}
      {screen === 'ttt' && (
        <TicTacToe 
          player1Name={currentUser || "PLAYER 1"} 
          player2Name={opponent || "PLAYER 2"} 
          onBackToDashboard={handleBackToDashboard}
        />
      )}
    </div>
  ); 
}

export default App;