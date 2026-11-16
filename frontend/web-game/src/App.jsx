import React, { useState, useEffect } from 'react';
import { socket } from "./socket";
import './App.css';
import StartScreen from './components/StartScreen';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import TicTacToe from './components/TicTacToe';
import Gartic from './components/Gartic';
import Photobooth from './components/Photobooth';

// Satu-satunya tempat pemetaan game_type -> layar.
// Jangan pernah fallback diam-diam ke Tic Tac Toe, karena itu yang bikin
// undangan Gartic/Photobooth malah membuka Tic Tac Toe.
const GAME_TYPE_ALIASES = {
  tictactoe: 'tictactoe',
  tic_tac_toe: 'tictactoe',
  'tic-tac-toe': 'tictactoe',
  ttt: 'tictactoe',
  gartic: 'gartic',
  photobooth: 'photobooth',
  photo_booth: 'photobooth',
  'photo-booth': 'photobooth',
};

const SCREEN_BY_GAME_TYPE = {
  tictactoe: 'ttt',
  gartic: 'gartic',
  photobooth: 'photobooth',
};

function normalizeGameType(value) {
  const key = String(value || '').trim().toLowerCase();
  return GAME_TYPE_ALIASES[key] || null;
}

const sameUser = (a, b) =>
  String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();

function App() {
  const [screen, setScreen] = useState('start');
  const [authMode, setAuthMode] = useState('');
  const [currentUser, setCurrentUser] = useState('');

  const [opponent, setOpponent] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [initialGameState, setInitialGameState] = useState(null);
  const [player1Name, setPlayer1Name] = useState('');
  const [player2Name, setPlayer2Name] = useState('');

  // ==========================================
  // SATU LISTENER UNTUK SEMUA GAME ROUTING
  // (sebelumnya App dan Dashboard sama-sama punya listener,
  //  sehingga event bisa saling menimpa dan salah pindah layar)
  // ==========================================
  useEffect(() => {
    const handleGameStart = (payload) => {
      const data = payload || {};
      const gameType = normalizeGameType(data.game_type || data.game || data.type);

      if (!gameType) {
        console.error('[ROUTING] game_type tidak dikenal:', data);
        return;
      }

      const players = Array.isArray(data.players) ? data.players : [];
      const p1 = data.p1_name || players[0] || '';
      const p2 = data.p2_name || players[1] || '';

      const opponentName =
        players.find((p) => !sameUser(p, currentUser)) ||
        (sameUser(p1, currentUser) ? p2 : p1) ||
        'OPPONENT';

      const stateKey = `${gameType}_state`;
      const gameState = data[stateKey] || data.game_state || {};

      setRoomCode(data.room_code || '');
      setOpponent(opponentName);
      setPlayer1Name(p1);
      setPlayer2Name(p2);
      setInitialGameState({
        ...gameState,
        p1_name: gameState.p1_name || p1,
        p2_name: gameState.p2_name || p2,
        players,
      });

      setScreen(SCREEN_BY_GAME_TYPE[gameType]);
    };

    const handleOpponentLeft = (payload) => {
      const data = payload || {};
      // Hanya reaksi kalau kita masih berada di room yang sama
      if (roomCode && data.room_code && data.room_code !== roomCode) {
        return;
      }

      setRoomCode('');
      setOpponent('');
      setPlayer1Name('');
      setPlayer2Name('');
      setInitialGameState(null);
      setScreen('dashboard');
    };

    socket.on('trigger_game_start', handleGameStart);
    socket.on('opponent_left', handleOpponentLeft);

    return () => {
      socket.off('trigger_game_start', handleGameStart);
      socket.off('opponent_left', handleOpponentLeft);
    };
  }, [currentUser, roomCode]);

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

  const clearRoom = () => {
    setRoomCode('');
    setOpponent('');
    setPlayer1Name('');
    setPlayer2Name('');
    setInitialGameState(null);
  };

  const handleBackToMenu = () => {
    if (roomCode) {
      socket.emit('leave_room', { room_code: roomCode });
    }
    socket.disconnect();
    localStorage.removeItem('token');
    clearRoom();
    setCurrentUser('');
    setScreen('start');
  };

  const handleBackToDashboard = () => {
    if (roomCode) {
      socket.emit('leave_room', { room_code: roomCode });
    }
    clearRoom();
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
        />
      )}

      {screen === 'ttt' && (
        <TicTacToe 
          key={roomCode || 'ttt'}
          currentUser={currentUser}      
          opponentName={opponent} 
          roomCode={roomCode}
          initialGameState={initialGameState}      
          onBackToDashboard={handleBackToDashboard}
        />
      )}

      {screen === 'gartic' && (
        <Gartic 
          key={roomCode || 'gartic'}
          currentUser={currentUser}
          opponentName={opponent}
          roomCode={roomCode}
          player1Name={player1Name}
          player2Name={player2Name}
          initialGameState={initialGameState}
          onBackToDashboard={handleBackToDashboard}
        />
      )}

      {screen === 'photobooth' && (
        <Photobooth 
          key={roomCode || 'photobooth'}
          currentUser={currentUser} 
          opponentName={opponent} 
          roomCode={roomCode} 
          player1Name={player1Name}
          player2Name={player2Name}
          initialGameState={initialGameState}
          onBackToDashboard={handleBackToDashboard}
        />
      )}
    </div>
  );
}

export default App;
