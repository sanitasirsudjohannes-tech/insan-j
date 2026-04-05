import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pwfwtorgtzghpklfrmiw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3Znd0b3JndHpnaHBrbGZybWl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTcwNjIsImV4cCI6MjA5MDczMzA2Mn0.RqiykXT4qlMW8NmkRhQOZtJf7IsdUauRAMRJDgJ3rUA';

export const supabase = createClient(supabaseUrl, supabaseKey);
