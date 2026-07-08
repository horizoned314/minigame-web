import React, { useState } from 'react';
import './App.css';
import StartScreen from './components/StartScreen';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';

function App() {
  const [screen, setScreen] = useState('start'); 
  const [authMode, setAuthMode] = useState(''); 
  const [currentUser, setCurrentUser] = useState('');

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
    </div>
  ); 
}

export default App;