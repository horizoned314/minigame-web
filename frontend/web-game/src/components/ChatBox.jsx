import React, { useState } from 'react';

function ChatBox({ currentUser, gameRoomId }) {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'SYSTEM', text: 'WELCOME TO THE ROOM!' },
    { id: 2, sender: 'OPPONENT', text: 'GLHF! Semoga menang ya haha' }
  ]);
  const [inputText, setInputText] = useState('');

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // Simulasi Chat Lokal (Nanti bagian ini yang dihubungkan ke Backend/Socket.io)
    const newMessage = {
      id: Date.now(),
      sender: currentUser.toUpperCase(),
      text: inputText
    };

    setMessages([...messages, newMessage]);
    setInputText(''); // Kosongkan input setelah kirim
  };

  return (
    <div className="chat-box-container">
      <div className="chat-header">
        <span>ROOM CHAT</span>
      </div>

      {/* AREA DAFTAR PESAN */}
      <div className="chat-messages-area">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble ${msg.sender === currentUser.toUpperCase() ? 'chat-me' : 'chat-others'}`}>
            <span className="chat-sender">[{msg.sender}]</span>
            <p className="chat-text">{msg.text}</p>
          </div>
        ))}
      </div>

      {/* FORM INPUT CHAT */}
      <form onSubmit={handleSendMessage} className="chat-input-form">
        <input
          type="text"
          className="chat-retro-input"
          placeholder="TYPE MESSAGE..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          maxLength={50}
        />
        <button type="submit" className="chat-send-btn">[SEND]</button>
      </form>
    </div>
  );
}

export default ChatBox;