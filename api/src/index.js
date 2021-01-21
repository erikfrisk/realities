import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { ApolloServer } from 'apollo-server-express';
import Keycloak from 'keycloak-connect';
import { KeycloakContext, KeycloakSubscriptionContext, KeycloakSubscriptionHandler } from 'keycloak-connect-graphql';
import createDriver from './db/neo4jDriver';
import schema from './graphql/schema';
import { getCoreModels, createOrgMembership } from './services/platoCore';
import { createOrg } from './graphql/connectors';

// copying how cra loads .env files
// https://github.com/facebook/create-react-app/blob/7e4949a20fc828577fb7626a3262832422f3ae3b/packages/react-scripts/config/env.js#L25-L49
// https://create-react-app.dev/docs/adding-custom-environment-variables/#what-other-env-files-can-be-used
const NODE_ENV = process.env.NODE_ENV || 'development';
const dotenvPath = path.resolve(process.cwd(), '.env');
const dotenvFiles = [
  `${dotenvPath}.${NODE_ENV}.local`,
  NODE_ENV !== 'test' && `${dotenvPath}.local`,
  `${dotenvPath}.${NODE_ENV}`,
  dotenvPath,
].filter(Boolean);
dotenvFiles.forEach((dotenvFile) => {
  if (fs.existsSync(dotenvFile)) {
    // eslint-disable-next-line global-require
    require('dotenv').config({
      path: dotenvFile,
    });
  }
});

// Max listeners for a pub/sub
require('events').EventEmitter.defaultMaxListeners = 15;

const { PORT } = process.env;
const API_PORT = PORT || 3100;
const app = express();

if (NODE_ENV.includes('prod')) {
  app.use(cors());
}

const keycloak = new Keycloak({}, {
  realm: process.env.KEYCLOAK_REALM,
  'auth-server-url': process.env.KEYCLOAK_SERVER_URL,
  'ssl-required': 'external',
  resource: process.env.KEYCLOAK_CLIENT,
  'public-client': true,
  'confidential-port': 0,
});

app.use('/graphql', keycloak.middleware());

async function createContext(kauth, orgSlug, neo4jDriver) {
  const coreModels = await getCoreModels();
  const userId = kauth.accessToken && kauth.accessToken.content.sub;

  const viewedOrg = await coreModels.Organization.findOne({
    subdomain: orgSlug,
  });
  const viewedOrgId = viewedOrg && viewedOrg.id;

  if (viewedOrgId) {
    // make sure that the org exists in neo4j
    await createOrg(neo4jDriver, { orgId: viewedOrgId });
  }

  // for now we'll let all users automatically join all orgs
  // and we only call this if the user is actually viewing an org
  const orgMembership = viewedOrg
    && await createOrgMembership({ coreModels, userId, orgId: viewedOrgId });

  return {
    kauth,
    user: {
      email: kauth.accessToken && kauth.accessToken.content.email,
      userId,
      role: 'user',
    },
    viewedOrg: {
      orgId: viewedOrgId,
      userIsMemberOf: (orgMembership && orgMembership.organizationId) === viewedOrgId,
    },
    driver: neo4jDriver,
    coreModels,
  };
}

const keycloakSubscriptionHandler = new KeycloakSubscriptionHandler({ keycloak, protect: false });

createDriver().then((neo4jDriver) => {
  const server = new ApolloServer({
    schema,
    subscriptions: {
      onConnect: async (connectionParams) => {
        const { orgSlug } = connectionParams;

        const token = await keycloakSubscriptionHandler.onSubscriptionConnect(connectionParams);
        const kauth = new KeycloakSubscriptionContext(token);

        return createContext(kauth, orgSlug, neo4jDriver);
      },
    },
    context: async ({ req, connection }) => {
      if (req) {
        const kauth = new KeycloakContext({ req });

        const orgSlug = req.get('orgSlug');

        return createContext(kauth, orgSlug, neo4jDriver);
      }
      return connection.context;
    },
    tracing: true,
  });

  server.applyMiddleware({ app, path: '/graphql' });

  const httpServer = createServer(app);
  server.installSubscriptionHandlers(httpServer);

  httpServer.listen(API_PORT, () => {
    console.log(`GraphQL Server is now running on http://localhost:${API_PORT}/graphql`);
    console.log(`View GraphQL Playground at http://localhost:${API_PORT}/graphql`);
  });
});
