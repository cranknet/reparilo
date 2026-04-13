import type { FastifyPluginAsync } from "fastify";

export const partsRoutes: FastifyPluginAsync = async (app) => {
	await app;
	app.get("/", (_req, reply) => {
		return reply.send({ message: "parts list" });
	});
};
