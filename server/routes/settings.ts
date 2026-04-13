import type { FastifyPluginAsync } from "fastify";

export const settingsRoutes: FastifyPluginAsync = async (app) => {
	await app;
	app.get("/", (_req, reply) => {
		return reply.send({ message: "settings" });
	});
};
