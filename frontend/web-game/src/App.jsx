import React, { useState, useEffect } from 'react';
import { io } from "socket.io-client";
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
  const [roomCode, setRoomCode] = useState('');

  const [socket, setSocket] = useState(null);
  const [roomCode, setRoomCode] = useState('');

  useEffect(() => {
    const s = io();
    setSocket(s);
    s.on('game_start', (d)=>{ 
      console.log('game_start', d);
      setRoomCode(d.room_code); 
    const opp = d.players.find(p=>p!==currentUser)||d.players[1]; 
    setOpponent(opp); 
    setScreen('ttt'); });
    return ()=> s.disconnect();
  }, [currentUser]);

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
  const handleStartGame = (opponentName, currentRoomCode) => {
    setOpponent(opponentName);
    setRoomCode(currentRoomCode); // Simpan kode room agar TicTacToe tahu harus masuk ruangan mana
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
          socket={socket}
        />
      )}

      {/* RENDER SCREEN TIC TAC TOE */}
      {screen === 'ttt' && (
        <TicTacToe 
          currentUser={currentUser}       // Nama Anda (yang sedang login)
          opponentName={opponent} // Nama musuh
          socket={socket}
          roomCode={roomCode}       // Kode unik room (misal ID undangan)
          onBackToDashboard={handleBackToDashboard}
        />
      )}
    </div>
  ); 
}

export default App;