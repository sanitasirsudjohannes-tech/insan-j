import { useContext } from 'react';
import { LandingContentContext } from './LandingContentContext';

export function useLandingContent() {
  return useContext(LandingContentContext);
}
