# Quick Start Guide - Bet Book Platform

Get the application running in minutes!

## Option 1: Docker (Easiest)

### Prerequisites
- Docker and Docker Compose installed

### Steps

1. **Clone and navigate to the project**
   ```bash
   cd bet-book-platform
   ```

2. **Start all services**
   ```bash
   docker-compose up
   ```

3. **Wait for initialization** (first run takes a minute or two)
   ```
   Database will be created
   Schema will be pushed
   Test data will be seeded
   App will start on http://localhost:3000
   ```

4. **Open in browser**
   - Navigate to: http://localhost:3000
   - You'll be redirected to login page

5. **Login with demo credentials**
   - **Admin**: Phone: 9999999999, Password: Admin@123456
   - **User**: Phone: 9876543210, Password: User@12345

That's it! The app is now running.

## Option 2: Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL 12+ running locally

### Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local`:
   ```
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bet_book
   JWT_SECRET=your-secret-key-here
   JWT_REFRESH_SECRET=your-refresh-secret-here
   NEXT_PUBLIC_API_URL=http://localhost:3000
   ```

3. **Create database**
   ```bash
   npm run db:push
   ```

4. **Seed test data**
   ```bash
   npm run db:seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open browser**
   - Navigate to: http://localhost:3000

## Testing the Application

### As Admin
1. Login with: `9999999999` / `Admin@123456`
2. Click "Admin Dashboard" to access admin panel
3. Create new series and matches
4. View all bets and manage settlements

### As Regular User
1. Login with: `9876543210` / `User@12345`
2. View your dashboard
3. Click "New Bet" to create a betting entry
4. Select a match, enter client details, and save
5. Monitor your P&L on the dashboard

## Key Features to Explore

### Admin Features
- **Series Management**: Create sports series (IPL, Asia Cup, etc.)
- **Match Management**: Add matches to series with team details
- **Bet Oversight**: View all bets across the platform
- **Settlement Management**: Update bet results and settlement status
- **P&L Reports**: See overall platform performance

### User Features
- **My Bets**: Track your betting records
- **P&L Dashboard**: View your profit/loss with charts
- **New Bet Entry**: Record bets with clients
- **Settlement Status**: Track whether amounts have been collected/settled

## Common Tasks

### Create a Series (Admin)
1. Go to Admin Dashboard
2. Click "New Series"
3. Fill in series name, start date, end date
4. Click "Create Series"

### Add a Match (Admin)
1. Go to Admin Dashboard
2. Find the series
3. Click "Add Match"
4. Fill in team names, date, venue
5. Click "Create Match"

### Record a Bet (User)
1. Go to "My Bets" dashboard
2. Click "New Bet"
3. Select a match
4. Enter client name and bet details
5. Enter amount and odds
6. Click "Create Bet"

### Update Bet Settlement (Admin)
1. Go to "All Bets"
2. Find the bet to update
3. Click the edit icon
4. Change settlement status (Pending → Collected → Settled)
5. If "Lost in another match", select the linked match
6. Save changes

## Database Reset

If you need to reset the database:

### With Docker
```bash
docker-compose down -v
docker-compose up
```

### Local Development
```bash
npm run db:push -- --force-reset
npm run db:seed
```

## Troubleshooting

### Port 3000 Already in Use
```bash
lsof -i :3000
kill -9 <PID>
npm run dev
```

### Database Connection Error
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env.local
- Verify database exists: `psql -U postgres -c "CREATE DATABASE bet_book;"`

### Can't Login
- Clear browser cookies and cache
- Check that seed data was run: `npm run db:seed`
- Verify user exists in database

### Prisma Client Missing
```bash
npm run db:generate
npm install
```

## Next Steps

1. **Explore the Dashboard**: Get familiar with the UI
2. **Create Test Data**: Use admin panel to create series and matches
3. **Record Bets**: Switch to user account and create some bets
4. **Test P&L**: Watch profit/loss calculations update
5. **Manage Settlements**: Update bet results and settlement status

## Documentation

For detailed documentation, see:
- **README.md**: Complete project documentation
- **Database Schema**: Check `prisma/schema.prisma` for data structure
- **API Documentation**: See endpoint details in README.md

## Support

If you encounter issues:
1. Check the README.md for detailed troubleshooting
2. Review the console logs for error messages
3. Ensure all environment variables are set correctly
4. Try clearing node_modules and reinstalling: `rm -rf node_modules && npm install`

## Next: Going to Production

Once you're satisfied with the local setup:
1. Deploy database (AWS RDS, Railway, etc.)
2. Update environment variables for production
3. Deploy app (Vercel, Railway, Heroku, etc.)
4. Change JWT_SECRET and JWT_REFRESH_SECRET to strong values
5. Enable HTTPS/SSL

Happy betting! 🎉
