import { useCallback, useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth";

interface WsMessage {
  notification?: {
    createdAt: string;
    id: string;
    job?: { id: string; jobCode: string } | null;
    message: string;
    readAt: string | null;
    type: string;
  };
  type: string;
}

type MessageHandler = (msg: WsMessage) => void;

const subscribers = new Set<MessageHandler>();
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

const WS_URL_REPLACE = /^http/;

function getWsUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL || "";
  if (base) {
    const wsBase = base.replace(WS_URL_REPLACE, "ws");
    return `${wsBase}/ws`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

function connect() {
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  const url = getWsUrl();
  // Same-origin WS connections automatically include cookies;
  // the server validates the session via getSessionFromRequest.
  socket = new WebSocket(url);

  socket.onopen = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data) as WsMessage;
      for (const handler of subscribers) {
        handler(msg);
      }
    } catch {
      // ignore non-JSON messages
    }
  };

  socket.onclose = () => {
    reconnectTimer = setTimeout(connect, 5000);
  };
}

function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
}

function scheduleDisconnect() {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
  }
  disconnectTimer = setTimeout(disconnect, 100);
}

function cancelDisconnect() {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
}

export function useWs(handler: MessageHandler) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const stableHandler = useRef(handler);
  stableHandler.current = handler;

  const wrappedHandler = useCallback((msg: WsMessage) => {
    stableHandler.current(msg);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnect();
      return;
    }

    cancelDisconnect();
    subscribers.add(wrappedHandler);

    if (!socket || socket.readyState === WebSocket.CLOSED) {
      connect();
    }

    return () => {
      subscribers.delete(wrappedHandler);
      if (subscribers.size === 0) {
        scheduleDisconnect();
      }
    };
  }, [isAuthenticated, wrappedHandler]);
}
