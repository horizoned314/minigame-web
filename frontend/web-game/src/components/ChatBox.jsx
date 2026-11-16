import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';

// ChatBox menerima onSendMessage kalau game punya jalur chat sendiri (Gartic),
// supaya pesan tidak terkirim dua kali lewat event yang berbeda.
function ChatBox({ currentUser, gameRoomId, onSendMessage }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Ambil histori chat saat komponen pertama kali muncul
    socket.emit('get_chat_history', { room_code: gameRoomId }, (res) => {
      if (res && res.status === 'success') {
        setMessages(res.history || []);
      }
    });

    // Dengarkan pesan baru
    function handleReceiveMessage(payload) {
      setMessages((prev) => [...prev, payload]);
    }
    socket.on('receive_message', handleReceiveMessage);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
    };
  }, [gameRoomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    if (onSendMessage) {
      // Game-specific chat (Gartic): server akan broadcast ke kedua pemain
      onSendMessage(text);
    } else {
      // Chat biasa (Tic Tac Toe)
      socket.emit('send_message', {
        room_code: gameRoomId,
        message: text
      }, (res) => {
        if (res && res.status !== 'success') {
          console.error('Gagal kirim pesan:', res.message);
        }
      });
    }

    setInputText('');
  };

  return (
    <div className="chat-box-container">
      <div className="chat-header">
        <span>ROOM CHAT</span>
      </div>

      <div className="chat-messages-area">
        {messages.map((msg, idx) => {
          const messageText = msg.message ?? msg.text ?? '';
          const sender = String(msg.sender || 'SYSTEM');

          return (
            <div
              key={idx}
              className={`chat-bubble ${sender.toUpperCase() === String(currentUser).toUpperCase() ? 'chat-me' : 'chat-others'}`}
            >
              <span className="chat-sender">[{sender.toUpperCase()}]</span>
              <p className="chat-text">{messageText}</p>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

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