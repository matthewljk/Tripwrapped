import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'tripPhotos',
  access: (allow) => ({
    'media/{entity_id}/*': [
      allow.authenticated.to(['read', 'write', 'delete'])
    ],
  })
});