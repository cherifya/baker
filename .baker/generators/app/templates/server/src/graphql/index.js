import parseGraphQLHTTP from 'parse-graphql-server';
import schema from './schema';

export default {
  setup(app, settings, graphiql = false) {
    app.use('/graphql', parseGraphQLHTTP({ schema, settings, graphiql }));
  },
};
