import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Provide fallback values for build time
const url = supabaseUrl || 'https://placeholder.supabase.co';
const key = serviceRoleKey || 'placeholder-service-key';

if (!supabaseUrl || !serviceRoleKey) {
  // Intentionally avoid throwing to keep server booting; endpoints can check.
}

export const supabaseAdmin = createClient(url, key);


