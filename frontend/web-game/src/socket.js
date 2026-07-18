import { io } from "socket.io-client";

export const socket = io("https://api.playgrounds.web.id", {
    autoConnect: false,
    transports: ["websocket"]
});