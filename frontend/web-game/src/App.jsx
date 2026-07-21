import React, { useState, useEffect } from 'react';
import { socket } from "./socket";
import './App.css';
import StartScreen from './components/StartScreen';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import TicTacToe from './components/TicTacToe';
import Gartic from './components/Gartic';
import Photobooth from './components/Photobooth';

function App() {
  // 1. DIKEMBALIKAN KE 'start' (Bukan 'photobooth' lagi)
  const [screen, setScreen] = useState('start'); 
  const [authMode, setAuthMode] = useState(''); 
  const [currentUser, setCurrentUser] = useState('');

  const [opponent, setOpponent] = useState(''); 
  const [roomCode, setRoomCode] = useState('');
  const [initialGameState, setInitialGameState] = useState(null);

  // EFFECT SOCKET: Menangkap sinyal start game dari backend
  useEffect(() => {
    socket.on("game_start", (data) => {
      console.log("GAME START VIA SOCKET", data);

      setRoomCode(data.room_code);

      const opp = data.players?.find((p) => p !== currentUser) || "";
      setOpponent(opp);

      // Cek kiriman jenis game dari backend
      if (data.game === 'gartic' || data.game_type === 'gartic') {
        setScreen("gartic");
      } else if (data.game === 'photobooth' || data.game_type === 'photobooth') {
        setScreen("photobooth");
      } else {
        setScreen("ttt"); // Default ke Tic Tac Toe
      }
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
    setCurrentUser('');
    setScreen('start');
  };

  const handleStartGame = (opponentName, currentRoomCode, gameState, gameType = 'ttt') => {
    setOpponent(opponentName);
    setRoomCode(currentRoomCode);
    setInitialGameState(gameState);
    
    // Cek halaman mana yang harus dibuka
    if (gameType === 'gartic') {
      setScreen('gartic');
    } else if (gameType === 'photobooth') {
      setScreen('photobooth');
    } else {
      setScreen('ttt');
    }
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
          onStartGame={handleStartGame} 
        />
      )}

      {/* RENDER SCREEN TIC TAC TOE */}
      {screen === 'ttt' && (
        <TicTacToe 
          currentUser={currentUser}      
          opponentName={opponent} 
          roomCode={roomCode}
          initialGameState={initialGameState}      
          onBackToDashboard={handleBackToDashboard}
        />
      )}

      {/* RENDER SCREEN GARTIC */}
      {screen === 'gartic' && (
        <Gartic 
          currentUser={currentUser}
          opponentName={opponent}
          roomCode={roomCode}
          initialGameState={initialGameState}
          onBackToDashboard={handleBackToDashboard}
        />
      )}

      {/* RENDER SCREEN PHOTOBOOTH */}
      {screen === 'photobooth' && (
        <Photobooth 
          currentUser={currentUser} 
          opponentName={opponent} 
          roomCode={roomCode} 
          initialGameState={initialGameState}
          onBackToDashboard={handleBackToDashboard}
        />
      )}
    </div>
  ); 
}

export default App;