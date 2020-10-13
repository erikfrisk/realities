import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { ApolloServer } from 'apollo-server-express';
import expressJwt from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import neo4jDriver from './db/neo4jDriver';
import schema from './graphql/schema';
import startSchedulers from './services/scheduler';

// Max listeners for a pub/sub
require('events').EventEmitter.defaultMaxListeners = 15;

const { NODE_ENV, PORT } = process.env;
const API_PORT = NODE_ENV && NODE_ENV.includes('prod') ? PORT || 3000 : 3100;
const app = express();

if (!NODE_ENV || NODE_ENV.includes('dev')) {
  app.use(cors());
}

app.use(expressJwt({
  credentialsRequired: false,
  // Dynamically provide a signing key based on the kid in the header
  // and the singing keys provided by the JWKS endpoint
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: 'https://platoproject.eu.auth0.com/.well-known/jwks.json',
  }),
}));

function getUser(user) {
  if (!user) return null;
  return Object.assign(
    {},
    user,
    {
      email: user['https://realities.platoproject.org/email'],
      role: user['https://realities.platoproject.org/role'],
      tenantId: 'placeholder',
    },
  );
}

const server = new ApolloServer({
  schema,
  context: async ({ req }) => ({
    user: getUser(req && req.user),
    driver: neo4jDriver,
  }),
  tracing: true,
});
server.applyMiddleware({ app, path: '/graphql' });

const httpServer = createServer(app);
server.installSubscriptionHandlers(httpServer);

httpServer.listen(API_PORT, () => {
  console.log(`GraphQL Server is now running on http://localhost:${API_PORT}/graphql`);
  console.log(`View GraphQL Playground at http://localhost:${API_PORT}/graphql`);
});

// Start the schedulers that download data from various APIs.
startSchedulers();
