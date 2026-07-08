import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    // Ambil kredensial dari environment variable (Vercel)
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials');
      return res.status(500).json({ error: 'Missing Supabase credentials in environment variables' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Lakukan query yang sangat ringan (limit 1) untuk memberikan aktivitas pada database
    const { data, error } = await supabase.from('limbah_padat').select('id').limit(1);

    if (error) {
      console.error('Error pinging Supabase:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('Supabase kept alive successfully.');
    return res.status(200).json({ 
      success: true, 
      message: 'Supabase pinged successfully to prevent pause.'
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
