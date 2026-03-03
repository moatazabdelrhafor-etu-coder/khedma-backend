import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    logger.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment');
    process.exit(1);
}

// Client using anon key — respects RLS policies
// Use this for user-context operations
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Client using service role key — bypasses RLS
// Use this for admin operations (creating users, managing data, etc.)
// Falls back to anon key if service role key is not set (with a warning)
let supabaseAdmin: SupabaseClient;
if (supabaseServiceRoleKey && supabaseServiceRoleKey !== 'your_service_role_key_here') {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
} else {
    logger.warn('SUPABASE_SERVICE_ROLE_KEY not set — admin client using anon key (limited access)');
    supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabaseAdmin };
