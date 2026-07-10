import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';

// 1. Tambahkan prop onSendMessage dan gameType di sini
function ChatBox({ currentUser, gameRoomId, onSendMessage, gameType }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Ambil histori chat saat komponen pertama kali muncul
    socket.emit('get_chat_history', { room_code: gameRoomId }, (res) => {
      if (res && res.status === 'success') {
        setMessages(res.history);
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
    if (!inputText.trim()) return;

    // 2. HUBUNGKAN KE GARTIC: Lempar teks ke fungsi checker di Gartic.jsx
    if (onSendMessage) {
      onSendMessage(inputText);
    }

    // Kirim ke backend melalui socket (untuk Tic Tac Toe & Gartic asli nanti)
    socket.emit('send_message', {
      room_code: gameRoomId,
      message: inputText
    }, (res) => {
      if (res && res.status !== 'success') {
        console.error('Gagal kirim pesan:', res.message);
      }
    });

    // 🛠️ HACK KHUSUS LOCAL TESTING GARTIC:
    // Karena backend Gartic belum ada untuk membalas 'receive_message',
    // kita masukkan pesannya langsung ke layar secara lokal agar kamu bisa melihat tebakanmu sendiri.
    if (gameType === 'GARTIC') {
      const mockPayload = {
        sender: currentUser,
        message: inputText
      };
      setMessages((prev) => [...prev, mockPayload]);
    }

    setInputText('');
  };

  return (
    <div className="chat-box-container">
      <div className="chat-header">
        <span>ROOM CHAT</span>
      </div>

      <div className="chat-messages-area">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`chat-bubble ${msg.sender.toUpperCase() === currentUser.toUpperCase() ? 'chat-me' : 'chat-others'}`}
          >
            <span className="chat-sender">[{msg.sender.toUpperCase()}]</span>
            <p className="chat-text">{msg.message}</p>
          </div>
        ))}
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