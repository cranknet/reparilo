import type { FastifyPluginAsync } from "fastify";

export const usersRoutes: FastifyPluginAsync = async (app) => {
	await app;
	app.get("/", (_req, reply) => {
		return reply.send({ message: "users list" });
	});
};
