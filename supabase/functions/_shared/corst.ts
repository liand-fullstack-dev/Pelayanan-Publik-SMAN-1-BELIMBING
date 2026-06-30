// Official Supabase CORS headers for Edge Functions
// Source: https://supabase.com/docs/guides/functions/cors
// Auto-synced with Supabase SDK updates

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

