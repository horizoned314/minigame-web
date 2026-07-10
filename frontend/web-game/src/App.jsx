import React, { useState, useEffect } from 'react';
import { socket } from "./socket";
import './App.css';
import StartScreen from './components/StartScreen';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import TicTacToe from './components/TicTacToe';
import Gartic from './components/Gartic';

function App() {
  const [screen, setScreen] = useState('start'); 
  const [authMode, setAuthMode] = useState(''); 
  const [currentUser, setCurrentUser] = useState('');

  const [opponent, setOpponent] = useState(''); 
  const [roomCode, setRoomCode] = useState('');
  const [initialGameState, setInitialGameState] = useState(null);

  // EFFECT SOCKET: Menangkap sinyal start game dari backend temenmu
  useEffect(() => {
    socket.on("game_start", (data) => {
      console.log("GAME START VIA SOCKET", data);

      setRoomCode(data.room_code);

      const opp = data.players.find((p) => p !== currentUser) || "";
      setOpponent(opp);

      // FITUR BARU: Cek kiriman jenis game dari backend temenmu (misal data.game atau data.game_type)
      if (data.game === 'gartic' || data.game_type === 'gartic') {
        setScreen("gartic");
      } else {
        setScreen("ttt"); // Default ke Tic Tac Toe jika tidak ada keterangan
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
    setScreen('start');
  };

  // UPDATE FUNGSI: Menambahkan parameter gameType di akhir agar fleksibel
  const handleStartGame = (opponentName, currentRoomCode, gameState, gameType = 'ttt') => {
    setOpponent(opponentName);
    setRoomCode(currentRoomCode);
    
    // Cek halaman mana yang harus dibuka
    if (gameType === 'gartic') {
      setScreen('gartic');
    } else {
      setInitialGameState(gameState);
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

      {/* RENDER SCREEN GARTIC (BARU) */}
      {screen === 'gartic' && (
        <Gartic 
          player1Name={currentUser || "PLAYER 1"} 
          player2Name={opponent || "PLAYER 2"} 
          onBackToDashboard={handleBackToDashboard}
        />
      )}
    </div>
  ); 
}

export default App;