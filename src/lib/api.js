export const API_URL = 'https://script.google.com/macros/s/AKfycbztXaymY7J461OyfQa4ELS3H9llrowg84pHdxNiKcz38MZ_WkYf9GXW7NoqHSBPYT5x/exec';

export const getCurrentUser = () => {
  const userStr = sessionStorage.getItem('currentUser');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const logoutUser = () => {
  sessionStorage.removeItem('currentUser');
  window.location.href = import.meta.env.BASE_URL;
};
