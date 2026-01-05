#!/bin/bash

# Helper script to set DATABASE_URL from Vercel or Supabase
# Usage: source ./scripts/set-database-url.sh

echo "🔧 DATABASE_URL Setup Helper"
echo ""
echo "Choose your database provider:"
echo "1. Vercel Postgres"
echo "2. Supabase"
echo "3. Neon"
echo "4. Other (enter manually)"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
  1)
    echo ""
    echo "📋 Steps to get Vercel Postgres URL:"
    echo "1. Go to Vercel Dashboard"
    echo "2. Select your API project"
    echo "3. Go to Storage tab"
    echo "4. Click on your Postgres database"
    echo "5. Go to .env.local tab"
    echo "6. Copy the POSTGRES_URL or DATABASE_URL value"
    echo ""
    read -p "Paste your DATABASE_URL here: " db_url
    export DATABASE_URL="$db_url"
    echo "✅ DATABASE_URL set!"
    ;;
  2)
    echo ""
    echo "📋 Steps to get Supabase URL:"
    echo "1. Go to Supabase Dashboard"
    echo "2. Select your project"
    echo "3. Go to Settings → Database"
    echo "4. Copy the Connection String (URI format)"
    echo "   Use the NON-POOLING connection for migrations/scripts"
    echo ""
    read -p "Paste your DATABASE_URL here: " db_url
    export DATABASE_URL="$db_url"
    echo "✅ DATABASE_URL set!"
    ;;
  3)
    echo ""
    echo "📋 Steps to get Neon URL:"
    echo "1. Go to Neon Dashboard"
    echo "2. Select your project"
    echo "3. Copy the connection string"
    echo ""
    read -p "Paste your DATABASE_URL here: " db_url
    export DATABASE_URL="$db_url"
    echo "✅ DATABASE_URL set!"
    ;;
  4)
    echo ""
    read -p "Enter your DATABASE_URL: " db_url
    export DATABASE_URL="$db_url"
    echo "✅ DATABASE_URL set!"
    ;;
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "🧪 Testing connection..."
if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
  echo "✅ Connection successful!"
  echo ""
  echo "You can now run:"
  echo "  ./scripts/check-user-role.sh"
else
  echo "❌ Connection failed. Please check your DATABASE_URL."
  echo "   Make sure it includes: postgres://user:password@host:port/database"
fi

