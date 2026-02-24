import { defineBackend } from '@aws-amplify/backend';
import { BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
});

// Cheapest DynamoDB: on-demand (pay per request, no minimum) for hobby use
const { cfnResources } = backend.data.resources;
for (const table of Object.values(cfnResources.amplifyDynamoDbTables)) {
  table.billingMode = BillingMode.PAY_PER_REQUEST;
}