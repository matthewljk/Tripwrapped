'use client';

import { Amplify } from 'aws-amplify';
import outputsFile from '../../amplify_outputs.json';

/**
 * Single source of config for both local and production:
 * - Local: copy sandbox output to repo root (amplify_outputs.json).
 * - Production: commit production amplify_outputs.json at root, or set
 *   NEXT_PUBLIC_AMPLIFY_OUTPUTS (stringified JSON) in Amplify Hosting build env.
 */
const outputs =
  typeof process.env.NEXT_PUBLIC_AMPLIFY_OUTPUTS === 'string'
    ? (JSON.parse(process.env.NEXT_PUBLIC_AMPLIFY_OUTPUTS) as typeof outputsFile)
    : outputsFile;

Amplify.configure(outputs, { ssr: true });

export default function ConfigureAmplifyClientSide() {
  return null;
}