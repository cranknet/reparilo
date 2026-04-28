import type { FastifyReply } from "fastify";

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  error: string,
  message: string,
  details?: Record<string, unknown>
) {
  const payload: Record<string, unknown> = { statusCode, error, message };
  if (details !== undefined) {
    payload.details = details;
  }
  return reply.status(statusCode).send(payload);
}
