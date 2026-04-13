import type { FastifyPluginAsync } from "fastify";

export const jobRoutes: FastifyPluginAsync = async (app) => {
	await app;
	app.get("/", (_req, reply) => {
		return reply.send({ message: "jobs list" });
	});
};
