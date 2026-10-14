import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';
import express from 'express';
import { restClient } from './clients.js';
import { createLoaders, resolvers } from './resolvers.js';
import { typeDefs } from './schema.js';

export function createApolloServer() {
  return new ApolloServer({ typeDefs, resolvers, introspection: true });
}

/** Builds the per-request context: fresh DataLoaders, shared HTTP clients. */
export function contextFactory({ schedulingUrl, crewUrl, publisher, fetchImpl }) {
  const scheduling = restClient(schedulingUrl, { fetchImpl, service: 'scheduling-service' });
  const crew = restClient(crewUrl, { fetchImpl, service: 'crew-service' });
  return () => ({ scheduling, crew, publisher, loaders: createLoaders({ crew }) });
}

export async function createApp({ corsOrigin, ...config }) {
  const server = createApolloServer();
  await server.start();
  const app = express();
  app.disable('x-powered-by');
  app.get('/health', (_req, res) => res.json({ status: 'UP' }));
  const context = contextFactory(config);
  app.use('/graphql', cors({ origin: corsOrigin ?? true }), express.json({ limit: '1mb' }),
    expressMiddleware(server, { context: async () => context() }));
  return { app, server };
}
