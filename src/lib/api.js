import { supabase } from './supabase';

export const API_URL = ''; // Deprecated, will not be used
export const getCurrentUser = () => {
  const userStr = sessionStorage.getItem('currentUser');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const logoutUser = async () => {
  await supabase.auth.signOut();
  sessionStorage.removeItem('currentUser');
  window.location.href = import.meta.env.BASE_URL;
};
