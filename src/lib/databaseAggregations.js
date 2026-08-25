import { supabase } from './supabase';

const unavailableFunctions = new Set();

const isMissingDatabaseFunction = (error) => (
  error?.code === 'PGRST202' ||
  error?.code === '42883' ||
  /could not find the function|function .* does not exist/i.test(error?.message || '')
);

/**
 * Jalankan agregasi Supabase tanpa memutus aplikasi sebelum SQL dipasang.
 * Error jaringan, akses, dan perhitungan tidak ditelan agar tetap terlihat.
 */
export async function fetchDatabaseAggregation(functionName, parameters = {}) {
  if (unavailableFunctions.has(functionName)) return null;

  const { data, error } = await supabase.rpc(functionName, parameters);

  if (error) {
    if (isMissingDatabaseFunction(error)) {
      unavailableFunctions.add(functionName);
      console.info(`Fungsi ${functionName} belum dipasang, menggunakan query lama.`);
      return null;
    }

    throw error;
  }

  return data;
}
