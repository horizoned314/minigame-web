import { io } from 'socket.io-client';

// Sesuaikan URL ini dengan alamat backend FastAPI Anda
const URL = 'http://127.0.0.1:8000'; 

export const socket = io(URL, {
  autoConnect: false, // Kita atur false agar connect-nya manual saat user login saja
});