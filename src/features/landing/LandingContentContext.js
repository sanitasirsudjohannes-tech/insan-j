import { createContext } from 'react';
import { DEFAULT_LANDING_CONTENT } from '../admin/landing/landingSettingsService';

export const LandingContentContext = createContext(DEFAULT_LANDING_CONTENT);
