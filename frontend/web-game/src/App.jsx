import React, { useState, useEffect } from 'react';
import { socket } from "./socket";
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

  const [initialGameState, setInitialGameState] = useState(null);

  useEffect(() => {
  socket.on("game_start", (data) => {
    console.log("GAME START", data);

    setRoomCode(data.room_code);

    const opp =
      data.players.find((p) => p !== currentUser) || "";

    setOpponent(opp);

    setScreen("ttt");
  });

  return () => {
    socket.off("game_start");
    };
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
  const handleStartGame = (opponentName, currentRoomCode, tictactoeState) => {
    setOpponent(opponentName);
    setRoomCode(currentRoomCode);
    setInitialGameState(tictactoeState); // Simpan kode room agar TicTacToe tahu harus masuk ruangan mana
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
          currentUser={currentUser}       // Nama Anda (yang sedang login)
          opponentName={opponent} // Nama musuh
          roomCode={roomCode}
          initialGameState={initialGameState}       // Kode unik room (misal ID undangan)
          onBackToDashboard={handleBackToDashboard}
        />
      )}
    </div>
  ); 
}

export default App;