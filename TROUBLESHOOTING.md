# Login Troubleshooting Guide

## Quick Test

1. **Test API directly:**
   ```bash
   curl -X POST http://localhost:3001/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"phone":"9999999999","password":"owner123"}'
   ```

2. **Check browser console:**
   - Open http://localhost:3000/login
   - Open browser DevTools (F12)
   - Go to Console tab
   - Try to login and check for errors

3. **Check Network tab:**
   - In DevTools, go to Network tab
   - Try to login
   - Check the login request:
     - Status code (should be 200)
     - Response body
     - Request payload

## Common Issues

### Issue: "Invalid credentials" error
**Solution:** Make sure you're using the exact credentials:
- Owner: `9999999999` / `owner123`
- Manager: `8888888888` / `manager123`
- Cashier: `7777777777` / `cashier123`
- Driver: `6666666666` / `driver123`

### Issue: Network error / CORS error
**Solution:** 
1. Make sure API server is running on port 3001
2. Check `.env` file has: `NEXT_PUBLIC_API_URL="http://localhost:3001"`
3. Restart both servers: `pnpm dev`

### Issue: API not responding
**Solution:**
1. Check if API is running: `curl http://localhost:3001/health`
2. Check API logs for errors
3. Verify database connection in `.env`

### Issue: Form validation errors
**Solution:**
- Phone must be at least 10 characters
- Password must be at least 6 characters
- Check browser console for validation errors

## Debug Steps

1. **Check API server logs:**
   ```bash
   tail -f /tmp/clean-start.log | grep -i "login\|error"
   ```

2. **Verify database users:**
   ```bash
   psql -U postgres -d azela_pos -c "SELECT phone, role FROM \"User\";"
   ```

3. **Test login endpoint:**
   ```bash
   curl -v -X POST http://localhost:3001/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"phone":"9999999999","password":"owner123"}'
   ```

4. **Check frontend API configuration:**
   - Open browser console
   - Type: `localStorage.getItem('accessToken')` (should be null before login)
   - Check Network tab for API calls

## Reset Everything

If nothing works, reset the database:
```bash
# Drop and recreate database
psql -U postgres -c "DROP DATABASE IF EXISTS azela_pos;"
psql -U postgres -c "CREATE DATABASE azela_pos;"

# Run migrations and seed
export DATABASE_URL="postgresql://postgres@localhost:5432/azela_pos?schema=public"
pnpm db:migrate
pnpm db:seed
```

