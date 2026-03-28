const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clear existing data
  await prisma.betEntry.deleteMany()
  await prisma.match.deleteMany()
  await prisma.series.deleteMany()
  await prisma.user.deleteMany()

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin@123456', 10)
  const admin = await prisma.user.create({
    data: {
      id: 'admin-001',
      name: 'Admin User',
      phone: '9999999999',
      email: 'admin@betbook.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  })
  console.log('✓ Admin created:', admin.phone)

  // Create regular users
  const userPassword = await bcrypt.hash('User@12345', 10)
  const users = await Promise.all([
    prisma.user.create({
      data: {
        id: 'user-001',
        name: 'Raj Kumar',
        phone: '9876543210',
        email: 'raj@example.com',
        password: userPassword,
        role: 'USER',
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-002',
        name: 'Priya Singh',
        phone: '8765432109',
        email: 'priya@example.com',
        password: userPassword,
        role: 'USER',
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-003',
        name: 'Arjun Patel',
        phone: '7654321098',
        email: 'arjun@example.com',
        password: userPassword,
        role: 'USER',
      },
    }),
  ])
  console.log('✓ Users created:', users.map(u => u.phone).join(', '))

  // Create series
  const series = await Promise.all([
    prisma.series.create({
      data: {
        name: 'IPL 2025',
        startDate: new Date('2025-03-01'),
        endDate: new Date('2025-06-01'),
        status: 'active',
      },
    }),
    prisma.series.create({
      data: {
        name: 'Asia Cup 2025',
        startDate: new Date('2025-08-01'),
        endDate: new Date('2025-09-15'),
        status: 'active',
      },
    }),
  ])
  console.log('✓ Series created:', series.map(s => s.name).join(', '))

  // Create matches
  const matches = await Promise.all([
    prisma.match.create({
      data: {
        seriesId: series[0].id,
        teamA: 'Mumbai Indians',
        teamB: 'Chennai Super Kings',
        matchDate: new Date('2025-03-15 19:30'),
        venue: 'Wankhede Stadium, Mumbai',
        status: 'upcoming',
      },
    }),
    prisma.match.create({
      data: {
        seriesId: series[0].id,
        teamA: 'Delhi Capitals',
        teamB: 'Royal Challengers Bangalore',
        matchDate: new Date('2025-03-16 19:30'),
        venue: 'Arun Jaitley Stadium, Delhi',
        status: 'completed',
      },
    }),
    prisma.match.create({
      data: {
        seriesId: series[0].id,
        teamA: 'Kolkata Knight Riders',
        teamB: 'Sunrisers Hyderabad',
        matchDate: new Date('2025-03-17 19:30'),
        venue: 'Eden Gardens, Kolkata',
        status: 'completed',
      },
    }),
    prisma.match.create({
      data: {
        seriesId: series[1].id,
        teamA: 'India',
        teamB: 'Pakistan',
        matchDate: new Date('2025-08-20 19:30'),
        venue: 'Dubai International Cricket Stadium',
        status: 'upcoming',
      },
    }),
    prisma.match.create({
      data: {
        seriesId: series[1].id,
        teamA: 'India',
        teamB: 'Sri Lanka',
        matchDate: new Date('2025-08-25 15:30'),
        venue: 'Sharjah Cricket Ground',
        status: 'upcoming',
      },
    }),
  ])
  console.log('✓ Matches created:', matches.length)

  // Create bet entries
  const bets = await Promise.all([
    // Bets for user-001
    prisma.betEntry.create({
      data: {
        matchId: matches[0].id,
        userId: users[0].id,
        clientName: 'Vikram',
        clientUserId: users[1].id,
        betOnTeam: 'teamA',
        betAmount: 10000,
        odds: 1.8,
        betType: 'match winner',
        result: 'pending',
        profitLoss: 0,
        settlementStatus: 'pending',
        notes: 'Backing Mumbai Indians',
      },
    }),
    prisma.betEntry.create({
      data: {
        matchId: matches[1].id,
        userId: users[0].id,
        clientName: 'Anonymous Client',
        betOnTeam: 'teamB',
        betAmount: 15000,
        odds: 2.1,
        betType: 'match winner',
        result: 'win',
        profitLoss: 16500,
        settlementStatus: 'pending',
        notes: 'RCB wins',
      },
    }),
    prisma.betEntry.create({
      data: {
        matchId: matches[2].id,
        userId: users[0].id,
        clientName: 'Raghav',
        clientUserId: users[2].id,
        betOnTeam: 'teamA',
        betAmount: 20000,
        odds: 1.5,
        betType: 'match winner',
        result: 'loss',
        profitLoss: -20000,
        settlementStatus: 'collected',
        notes: 'KKR loss',
      },
    }),

    // Bets for user-002
    prisma.betEntry.create({
      data: {
        matchId: matches[0].id,
        userId: users[1].id,
        clientName: 'Raj',
        clientUserId: users[0].id,
        betOnTeam: 'teamB',
        betAmount: 8000,
        odds: 2.2,
        betType: 'match winner',
        result: 'pending',
        profitLoss: 0,
        settlementStatus: 'pending',
        notes: 'CSK to win',
      },
    }),
    prisma.betEntry.create({
      data: {
        matchId: matches[1].id,
        userId: users[1].id,
        clientName: 'Client XYZ',
        betOnTeam: 'teamA',
        betAmount: 5000,
        odds: 1.9,
        betType: 'match winner',
        result: 'loss',
        profitLoss: -5000,
        settlementStatus: 'settled',
        notes: 'DC loss',
      },
    }),

    // Bets for user-003
    prisma.betEntry.create({
      data: {
        matchId: matches[2].id,
        userId: users[2].id,
        clientName: 'Arjun',
        betOnTeam: 'teamB',
        betAmount: 12000,
        odds: 2.0,
        betType: 'match winner',
        result: 'win',
        profitLoss: 12000,
        settlementStatus: 'pending',
        notes: 'SRH wins',
      },
    }),
    prisma.betEntry.create({
      data: {
        matchId: matches[3].id,
        userId: users[2].id,
        clientName: 'International Client',
        betOnTeam: 'teamA',
        betAmount: 25000,
        odds: 1.6,
        betType: 'match winner',
        result: 'pending',
        profitLoss: 0,
        settlementStatus: 'pending',
        notes: 'India vs Pakistan',
      },
    }),

    // Additional bets for variety
    prisma.betEntry.create({
      data: {
        matchId: matches[1].id,
        userId: users[0].id,
        clientName: 'Lucky Bettor',
        betOnTeam: 'teamA',
        betAmount: 5000,
        odds: 2.5,
        betType: 'match winner',
        result: 'loss',
        profitLoss: -5000,
        settlementStatus: 'pending',
        notes: 'Delhi loss',
      },
    }),
    prisma.betEntry.create({
      data: {
        matchId: matches[2].id,
        userId: users[1].id,
        clientName: 'Bold Backer',
        betOnTeam: 'teamB',
        betAmount: 30000,
        odds: 1.4,
        betType: 'match winner',
        result: 'win',
        profitLoss: 12000,
        settlementStatus: 'collected',
        notes: 'SRH strong backing',
      },
    }),
    prisma.betEntry.create({
      data: {
        matchId: matches[0].id,
        userId: users[1].id,
        clientName: 'Test Client',
        betOnTeam: 'teamA',
        betAmount: 3000,
        odds: 1.95,
        betType: 'match winner',
        result: 'pending',
        profitLoss: 0,
        settlementStatus: 'pending',
        notes: '',
      },
    }),
    prisma.betEntry.create({
      data: {
        matchId: matches[3].id,
        userId: users[0].id,
        clientName: 'Asia Cup Fan',
        betOnTeam: 'teamB',
        betAmount: 15000,
        odds: 2.8,
        betType: 'match winner',
        result: 'pending',
        profitLoss: 0,
        settlementStatus: 'pending',
        notes: 'Pakistan upset chance',
      },
    }),
  ])
  console.log('✓ Bets created:', bets.length)

  console.log('✅ Database seeded successfully!')
  console.log('\nDemo Credentials:')
  console.log('Admin: 9999999999 / Admin@123456')
  console.log('User 1: 9876543210 / User@12345')
  console.log('User 2: 8765432109 / User@12345')
  console.log('User 3: 7654321098 / User@12345')
}

main()
  .catch(e => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
