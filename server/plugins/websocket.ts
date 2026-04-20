import type { FastifyPluginAsync } from "fastify";
import { getSessionFromRequest } from "../lib/auth.js";

interface WsClient {
  role: string;
  socket: import("ws").WebSocket;
  userId: string;
}

const connections = new Set<WsClient>();

export function wsBroadcast(
  predicate: (client: WsClient) => boolean,
  payload: Record<string, unknown>
) {
  const data = JSON.stringify(payload);
  for (const client of connections) {
    if (predicate(client) && client.socket.readyState === 1) {
      client.socket.send(data);
    }
  }
}

// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync requires async
export const websocketPlugin: FastifyPluginAsync = async (app) => {
  app.get("/ws", { websocket: true }, async (socket, req) => {
    const session = await getSessionFromRequest(app.auth, req);
    if (!session) {
      app.log.warn("WS connection rejected — invalid session");
      socket.close(4001, "Unauthorized");
      return;
    }

    const client: WsClient = {
      role: session.user.role,
      socket: socket as import("ws").WebSocket,
      userId: session.user.id,
    };

    connections.add(client);
    app.log.info(
      { role: client.role, userId: client.userId },
      "WS client connected"
    );

    socket.on("close", () => {
      connections.delete(client);
      app.log.info("WS client disconnected");
    });

    socket.on("message", (msg: Buffer) => {
      app.log.debug(`WS message: ${msg.toString()}`);
    });
  });
};
