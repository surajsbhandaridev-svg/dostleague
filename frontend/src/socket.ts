import { io } from "socket.io-client"; import { getToken } from "./api";
export const connect = () => io(import.meta.env.VITE_SOCKET_URL ?? "http://localhost:10000", { auth: { token: getToken() } });
