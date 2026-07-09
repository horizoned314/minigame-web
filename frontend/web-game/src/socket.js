import { io } from "socket.io-client";

export const socket = io("https://electrocratic-debatable-joannie.ngrok-free.dev", {
    autoConnect: false,
    transports: ["websocket"]
});