import { defineAuth, secret } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['email', 'profile', 'openid'],
        attributeMapping: {
          email: 'email',
          fullname: 'name', // Cognito key; Google claim is "name"
        },
      },
      callbackUrls: [
        'http://localhost:3000/',
        'https://trip-wrapped.com/',
        'https://www.trip-wrapped.com/',
      ],
      logoutUrls: [
        'http://localhost:3000/',
        'https://trip-wrapped.com/',
        'https://www.trip-wrapped.com/',
      ],
    },
  },
});
