import { io } from "socket.io-client";

export const API_BASE_URL = "https://api.playgrounds.web.id";

export const socket = io(API_BASE_URL, {
    autoConnect: false,
    // WebSocket lebih cepat, tapi polling dipakai sebagai fallback kalau
    // jaringan/proxy memblokir WebSocket (sering terjadi di jaringan kampus/kantor).
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
});
