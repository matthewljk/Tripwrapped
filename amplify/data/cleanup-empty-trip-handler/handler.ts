import type { Schema } from '../resource';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';

/**
 * When a trip has zero members (e.g. last member left), delete all associated
 * Media, Transactions, and the Trip. Only runs when trip has 0 TripMembers.
 */
export const handler: Schema['cleanupEmptyTrip']['functionHandler'] = async (event) => {
  const tripId = event.arguments.tripId;

  const env = process.env as Record<string, string>;
  const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
  const { Amplify } = await import('aws-amplify');
  Amplify.configure(resourceConfig, libraryOptions);

  const client = generateClient<Schema>({ authMode: 'iam' });

  const { data: members } = await client.models.TripMember.list({
    filter: { tripId: { eq: tripId } },
  });
  if (members && members.length > 0) {
    return { success: false, message: 'Trip still has members; cannot cleanup' };
  }

  let mediaNext: string | undefined;
  do {
    const mediaPage = await client.models.Media.list({
      filter: { tripId: { eq: tripId } },
      nextToken: mediaNext,
    });
    for (const m of mediaPage.data ?? []) {
      await client.models.Media.delete({ id: m.id });
    }
    mediaNext = mediaPage.nextToken ?? undefined;
  } while (mediaNext);

  let nextToken: string | undefined;
  do {
    const txPage = await client.models.Transaction.list({
      filter: { tripId: { eq: tripId } },
      nextToken,
    });
    for (const tx of txPage.data ?? []) {
      await client.models.Transaction.delete({ id: tx.id });
    }
    nextToken = txPage.nextToken ?? undefined;
  } while (nextToken);

  await client.models.Trip.delete({ id: tripId });

  return { success: true, message: 'Trip and resources deleted' };
};
