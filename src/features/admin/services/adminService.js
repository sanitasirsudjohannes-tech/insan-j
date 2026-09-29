import { supabase } from '../../../lib/supabase';

export const listUsers = () => supabase.from('profiles').select('id, username, nama, role').order('nama', { ascending: true });
export const readUserSettings = keys => supabase.from('app_settings').select('key, value').in('key', keys);
export const readSetting = key => supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
export const migrateUserSettings = settings => supabase.from('app_settings').upsert(settings, { onConflict: 'key', ignoreDuplicates: true });
export const saveSetting = (key, value) => supabase.from('app_settings').upsert({ key, value }, { onConflict: 'key' });
export const saveUserSettings = settings => supabase.from('app_settings').upsert(settings, { onConflict: 'key' });
export const listRooms = () => supabase.from('ruangan').select('id, nama_ruangan, created_at').order('nama_ruangan', { ascending: true });
export const addRoom = name => supabase.from('ruangan').insert([{ nama_ruangan: name }]);
export const deleteRoom = id => supabase.from('ruangan').delete().eq('id', id);
export const resetUserPassword = (id, password) => supabase.rpc('admin_reset_user_password', { target_user_id: id, new_password: password });
export const deleteUser = id => supabase.functions.invoke('admin-delete-user', { body: { userId: id } });
export const createUser = body => supabase.functions.invoke('admin-create-user', { body });
