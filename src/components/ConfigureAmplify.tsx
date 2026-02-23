'use client';

import { Amplify } from 'aws-amplify';
import outputs from '../../amplify_outputs.json';

// This is the "Engine Start" button. 
// It needs to run before anything else renders.
Amplify.configure(outputs, { ssr: true });

export default function ConfigureAmplifyClientSide() {
  return null;
}