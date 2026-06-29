#!/bin/bash
# Deploy Backend Supabase

set -e

echo "🚀 Deploying Supabase Backend..."

echo "🔗 Linking project..."
supabase link \
  --project-ref "$SUPABASE_PROJECT_ID" \
  --password "$SUPABASE_DB_PASSWORD"

echo "🗄️ Applying database migrations..."
supabase db push

echo "⚡ Deploying Edge Functions..."
supabase functions deploy appointments
supabase functions deploy stats
supabase functions deploy admin-auth

echo "✅ Backend deployment completed!"