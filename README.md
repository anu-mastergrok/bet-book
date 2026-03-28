# Bet Book Platform

A comprehensive full-stack digital ledger for tracking cricket/sports betting records, calculating profit/loss, and managing settlements.

## Features

- **User Management**: Registration and authentication with JWT tokens
- **Bet Tracking**: Record and manage betting entries with detailed information
- **P&L Calculation**: Automatic profit/loss calculations with breakdown by series, match, and client
- **Settlement Management**: Track settlement status and link bets to other matches when needed
- **Admin Dashboard**: Comprehensive admin interface with series/match management
- **User Dashboard**: Personal dashboard showing individual betting records and performance
- **Reports**: P&L reports with charts and analytics
- **Dark Mode Support**: Built-in dark mode for comfortable viewing
- **Responsive Design**: Mobile-friendly interface

## Tech Stack

### Frontend
- React 18 with TypeScript
- Next.js 14 for full-stack development
- Tailwind CSS for styling
- Recharts for data visualization
- Lucide React for icons

### Backend
- Node.js with Next.js API routes
- Express.js-style routing
- JWT authentication with access and refresh tokens

### Database
- PostgreSQL with Prisma ORM
- Type-safe database operations

### Deployment
- Docker and Docker Compose
- Ready for cloud deployment

## Project Structure

```
.
├── app/                          # Next.js app directory
│   ├── api/                     # API routes
│   │   ├── auth/               # Authentication endpoints
│   │   ├── series/             # Series management
│   │   ├── matches/            # Matches management
│   │   ├── bets/               # Bet entries CRUD
│   │   ├── reports/            # P&L reports
│   │   └── admin/              # Admin endpoints
│   ├── admin/                   # Admin pages
│   ├── dashboard/               # User dashboard pages
│   ├── login/                   # Login page
│   ├── register/                # Registration page
│   ├── globals.css              # Global styles
│   └── layout.tsx               # Root layout
├── components/                  # Reusable React components
│   ├── Toast.tsx                # Toast notifications
│   └── Modal.tsx                # Modal dialogs
├── context/                     # React context providers
│   └── AuthContext.tsx          # Authentication context
├── lib/                         # Utility functions
│   ├── auth.ts                  # JWT utilities
│   ├── validators.ts            # Zod validation schemas
│   ├── errors.ts                # Error handling
│   ├── pnl.ts                   # P&L calculation logic
│   ├── middleware.ts            # API middleware
│   └── db.ts                    # Prisma client
├── prisma/                      # Database schema and migrations
│   ├── schema.prisma            # Prisma schema
│   └── seed.js                  # Database seeding script
├── package.json                 # Dependencies
├── tsconfig.json                # TypeScript config
├── next.config.js               # Next.js config
├── tailwind.config.ts           # Tailwind CSS config
├── docker-compose.yml           # Docker Compose setup
├── Dockerfile                   # Docker image
└── README.md                    # This file
```

## Installation

### Prerequisites
- Node.js 18+ or Docker
- PostgreSQL 12+ (or use Docker)
- npm or yarn package manager

### Local Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bet-book-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and configure:
   - `DATABASE_URL`: PostgreSQL connection string
   - `JWT_SECRET`: Secret key for JWT signing
   - `JWT_REFRESH_SECRET`: Secret key for refresh tokens
   - `NEXT_PUBLIC_API_URL`: API URL (http://localhost:3000 for development)

4. **Set up the database**
   ```bash
   # Create database schema
   npm run db:push
   
   # Seed with test data
   npm run db:seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Docker Setup

1. **Ensure Docker and Docker Compose are installed**

2. **Update environment variables in docker-compose.yml** (optional)

3. **Start all services**
   ```bash
   docker-compose up
   ```
   
   The application will be available at [http://localhost:3000](http://localhost:3000)

## Database Schema

### Users
- `id`: Unique identifier
- `name`: Full name
- `phone`: Unique phone number (10 digits)
- `email`: Optional email address
- `password`: Hashed password
- `role`: USER or ADMIN
- `isActive`: Account status

### Series
- `id`: Unique identifier
- `name`: Series name (e.g., "IPL 2025")
- `startDate`: Start date
- `endDate`: End date
- `status`: active or completed

### Matches
- `id`: Unique identifier
- `seriesId`: Foreign key to Series
- `teamA`: First team name
- `teamB`: Second team name
- `matchDate`: Match datetime
- `venue`: Venue name
- `status`: upcoming, live, or completed

### Bet Entries
- `id`: Unique identifier
- `matchId`: Foreign key to Match
- `userId`: Foreign key to User (bookmaker)
- `clientName`: Client name
- `clientUserId`: Optional FK to User (if client is registered)
- `betOnTeam`: teamA or teamB
- `betAmount`: Bet amount (decimal)
- `odds`: Odds multiplier
- `betType`: Bet type (e.g., "match winner")
- `result`: win, loss, or pending
- `profitLoss`: Calculated field
- `settlementStatus`: pending, collected, settled, or lost_in_another_match
- `linkedMatchId`: Optional FK to Match (for lost_in_another_match settlement)
- `notes`: Additional notes

## API Endpoints

### Authentication
- `POST /api/auth/register`: User registration
- `POST /api/auth/login`: User login

### Series Management
- `GET /api/series`: Get all series
- `POST /api/series`: Create new series (admin only)

### Match Management
- `GET /api/matches`: Get all matches
- `POST /api/matches`: Create new match (admin only)

### Bet Management
- `GET /api/bets`: Get user's bets (filtered for regular users)
- `POST /api/bets`: Create new bet
- `GET /api/bets/:id`: Get specific bet
- `PUT /api/bets/:id`: Update bet
- `DELETE /api/bets/:id`: Delete bet
- `PUT /api/bets/:id/settlement`: Update bet settlement

### Reports
- `GET /api/reports/pnl`: Get P&L report (supports matchId, seriesId, userId params)

### Admin
- `GET /api/admin/summary`: Get admin dashboard summary (admin only)

## Demo Credentials

After running the seed script, you can log in with:

### Admin
- **Phone**: 9999999999
- **Password**: Admin@123456

### Users
- **Phone**: 9876543210 | **Password**: User@12345
- **Phone**: 8765432109 | **Password**: User@12345
- **Phone**: 7654321098 | **Password**: User@12345

## Key Features Explained

### P&L Calculation
- **Win**: Profit = (betAmount × odds) - betAmount
- **Loss**: Loss = -betAmount
- **Pending**: P&L = 0 (until result is determined)

### Settlement Workflow
1. **Pending**: Initial state when bet is created
2. **Collected**: Amount received from client
3. **Settled**: Amount paid to client
4. **Lost in Another Match**: Amount carried over and lost in another match; can be linked to show the chain

### User Roles
- **ADMIN**: Full access to all features, can manage series/matches/bets
- **USER**: Can only view and manage their own betting records

## Development

### Running Tests
```bash
npm test
```

### Building for Production
```bash
npm run build
npm start
```

### Linting
```bash
npm run lint
```

### Database Migration
```bash
# Generate migration
npx prisma migrate dev --name <migration-name>

# Deploy migrations
npm run db:migrate
```

### Regenerate Prisma Client
```bash
npm run db:generate
```

## Deployment

### Environment Variables for Production
Ensure these are set in your production environment:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Strong secret key (change from default)
- `JWT_REFRESH_SECRET`: Strong refresh secret (change from default)
- `NEXT_PUBLIC_API_URL`: Production API URL
- `NODE_ENV`: Set to "production"

### Docker Deployment
```bash
docker-compose -f docker-compose.yml up -d
```

### Vercel Deployment
1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

## Security Notes

- All passwords are hashed using bcryptjs
- JWT tokens expire after 1 hour (configurable)
- Refresh tokens expire after 7 days (configurable)
- Admin-only endpoints are protected with role-based authorization
- Input validation using Zod on all endpoints
- CORS configuration recommended for production

## Troubleshooting

### Database Connection Error
- Verify PostgreSQL is running
- Check `DATABASE_URL` environment variable
- Ensure database exists and is accessible

### Port Already in Use
```bash
# Kill process using port 3000
lsof -ti:3000 | xargs kill -9
```

### Prisma Client Issues
```bash
# Regenerate Prisma client
npm run db:generate

# Clear cache and reinstall
rm -rf node_modules .next
npm install
```

### Authentication Issues
- Clear browser cookies and localStorage
- Verify JWT_SECRET matches in .env
- Check token expiration time

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues, questions, or suggestions, please open an issue on the repository.

## Future Enhancements

- [ ] Real-time notifications using WebSockets
- [ ] Mobile app using React Native
- [ ] Advanced analytics and reporting
- [ ] Betting odds API integration
- [ ] Multi-currency support
- [ ] Audit logs and compliance reporting
- [ ] Two-factor authentication
- [ ] Advanced filtering and search
- [ ] Export to CSV/PDF
- [ ] Settlement reminders and notifications
