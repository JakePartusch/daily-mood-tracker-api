import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLString,
  GraphQLNonNull,
  GraphQLList
} from 'graphql';
import { DynamoDB } from 'aws-sdk';
import { APIGatewayEvent } from 'aws-lambda';

const dynamoDb = new DynamoDB.DocumentClient();

const getMoodData = async (user: string) => {
  const result = await dynamoDb
    .get({
      TableName: process.env.DYNAMODB_TABLE,
      Key: { user }
    })
    .promise();

  return result.Item.moodData;
};

const updateMoodData = async (user: string, moodData) => {
  await dynamoDb
    .update({
      TableName: process.env.DYNAMODB_TABLE,
      Key: { user },
      UpdateExpression: 'SET moodData = :moodData',
      ExpressionAttributeValues: {
        ':moodData': moodData
      }
    })
    .promise();
  return moodData;
};

const MoodEntryType = new GraphQLObjectType({
  name: 'MoodEntry',
  fields: {
    entryDate: {
      type: GraphQLString
    },
    status: {
      type: GraphQLString
    }
  }
});

const MoodEntryInput = new GraphQLInputObjectType({
  name: 'MoodEntryInput',
  fields: {
    entryDate: {
      type: GraphQLString
    },
    status: {
      type: GraphQLString
    }
  }
});

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootQueryType', // an arbitrary name
    fields: {
      // the query has a field called 'greeting'
      moodData: {
        // we need to know the user's name to greet them
        args: { user: { name: 'user', type: new GraphQLNonNull(GraphQLString) } },
        // the greeting message is a string
        type: new GraphQLList(MoodEntryType),
        // resolve to a greeting message
        resolve: (parent, args) => getMoodData(args.user)
      }
    }
  }),
  mutation: new GraphQLObjectType({
    name: 'RootMutationType', // an arbitrary name
    fields: {
      updateMoodData: {
        args: {
          user: { name: 'user', type: new GraphQLNonNull(GraphQLString) },
          moodData: { name: 'moodData', type: new GraphQLList(MoodEntryInput) }
        },
        type: new GraphQLList(MoodEntryType),
        resolve: (parent, args) => updateMoodData(args.user, args.moodData)
      }
    }
  })
});

// We want to make a GET request with ?query=<graphql query>
// The event properties are specific to AWS. Other providers will differ.
module.exports.query = async (event: APIGatewayEvent, _, callback) => {
  console.log(JSON.stringify(event, null, 2));
  const body = JSON.parse(event.body);
  const result = await graphql(schema, body.query);
  console.log(JSON.stringify(result, null, 2));
  callback(null, { statusCode: 200, body: JSON.stringify(result) });
};
