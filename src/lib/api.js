import { supabase } from './supabase';

export const getCurrentUser = () => {
  const userStr = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const logoutUser = async () => {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn('Sign out offline warning:', e);
  }
  localStorage.removeItem('currentUser');
  sessionStorage.removeItem('currentUser');
  window.location.href = import.meta.env.BASE_URL;
};
