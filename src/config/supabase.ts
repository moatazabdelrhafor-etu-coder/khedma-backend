import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client using anon key — respects RLS policies
// Use this for user-context operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client using service role key — bypasses RLS
// Use this for admin operations (creating users, managing data, etc.)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
