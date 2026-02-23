import type { Schema } from '../resource';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';

export const handler: Schema['deleteTripMedia']['functionHandler'] = async (event) => {
  const mediaId = event.arguments.mediaId;
  const userId = (event.identity as { sub?: string })?.sub;
  if (!userId) {
    return { success: false, message: 'Not authenticated' };
  }

  const env = process.env as Record<string, string>;
  const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
  const { Amplify } = await import('aws-amplify');
  Amplify.configure(resourceConfig, libraryOptions);

  const client = generateClient<Schema>({ authMode: 'iam' });

  const { data: media } = await client.models.Media.get({ id: mediaId });
  if (!media) {
    return { success: false, message: 'Media not found' };
  }

  const { data: trip } = await client.models.Trip.get({ id: media.tripId });
  if (!trip) {
    return { success: false, message: 'Trip not found' };
  }

  const isUploader = media.uploadedBy === userId;
  const allowAny = trip.allowAnyMemberToDelete === true;

  if (isUploader) {
    await client.models.Media.delete({ id: mediaId });
    return { success: true, message: 'Deleted' };
  }

  if (!allowAny) {
    return { success: false, message: 'Only the uploader can delete this media' };
  }

  const { data: members } = await client.models.TripMember.list({
    filter: { tripId: { eq: media.tripId }, userId: { eq: userId } },
  });
  if (!members?.length) {
    return { success: false, message: 'You are not a member of this trip' };
  }

  await client.models.Media.delete({ id: mediaId });
  return { success: true, message: 'Deleted' };
};
