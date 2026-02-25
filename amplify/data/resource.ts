import { type ClientSchema, a, defineData, defineFunction } from '@aws-amplify/backend';

const deleteTripMediaHandler = defineFunction({
  entry: './delete-media-handler/handler.ts',
  memoryMB: 128,
  timeoutSeconds: 15,
});

const schema = a.schema({
  Trip: a
    .model({
      tripCode: a.string().required(),
      name: a.string(),
      allowAnyMemberToDelete: a.boolean(),
      startDate: a.string(),
      baseCurrency: a.string(),
      budgetPerPax: a.float(),
    })
    .secondaryIndexes((index) => [index('tripCode')])
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create']),
      allow.owner().to(['update', 'delete']),
    ]),

  Transaction: a
    .model({
      tripId: a.id().required(),
      amount: a.float().required(),
      currency: a.string().required(),
      description: a.string(),
      paidBy: a.string().required(),
      splitBetween: a.string().array().required(),
      timestamp: a.string().required(),
      categoryId: a.string(),
      customSplitAmountsJson: a.string(),
    })
    .secondaryIndexes((index) => [index('tripId')])
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create']),
      allow.ownerDefinedIn('paidBy').to(['update', 'delete']),
    ]),

  TripMember: a
    .model({
      tripId: a.id().required(),
      userId: a.string().required(),
      role: a.string().required(),
    })
    .secondaryIndexes((index) => [index('tripId'), index('userId')])
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create']),
      allow.owner().to(['update', 'delete']),
    ]),

  Media: a
    .model({
      tripId: a.id().required(),
      storagePath: a.string().required(),
      uploadedBy: a.string().required(),
      uploadedByUsername: a.string(),
      lat: a.float(),
      lng: a.float(),
      timestamp: a.string(),
      isFavorite: a.boolean(),
      locationName: a.string(),
      googlePlaceId: a.string(),
      rating: a.integer(),
      review: a.string(),
      visited: a.boolean(),
    })
    .secondaryIndexes((index) => [index('tripId')])
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create', 'update']),
      allow.ownerDefinedIn('uploadedBy').to(['update', 'delete']),
    ]),

  UserProfile: a
    .model({
      userId: a.string().required(),
      username: a.string().required(),
    })
    .secondaryIndexes((index) => [index('userId')])
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      allow.owner().to(['create', 'update', 'delete']),
    ]),

  UserPreference: a
    .model({
      activeTripId: a.id(),
    })
    .authorization((allow) => [allow.owner()]),

  SavedLocation: a
    .model({
      userId: a.string().required(),
      lat: a.float().required(),
      lng: a.float().required(),
      name: a.string().required(),
    })
    .secondaryIndexes((index) => [index('userId')])
    .authorization((allow) => [
      allow.authenticated().to(['create']),
      allow.ownerDefinedIn('userId').to(['read', 'update', 'delete']),
    ]),

  DeleteTripMediaResult: a.customType({
    success: a.boolean(),
    message: a.string(),
  }),

  deleteTripMedia: a
    .mutation()
    .arguments({ mediaId: a.id().required() })
    .returns(a.ref('DeleteTripMediaResult'))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(deleteTripMediaHandler)),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({ schema });
