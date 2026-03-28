import { z } from 'zod'

// Auth Schemas
export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
})

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Phone or email is required'),
  password: z.string().min(1, 'Password is required'),
})

// Series Schemas
export const seriesSchema = z.object({
  name: z.string().min(1, 'Series name is required'),
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
  status: z.enum(['active', 'completed']).default('active'),
})

// Match Schemas
export const matchSchema = z.object({
  seriesId: z.string().min(1, 'Series is required'),
  teamA: z.string().min(1, 'Team A is required'),
  teamB: z.string().min(1, 'Team B is required'),
  matchDate: z.string().transform(str => new Date(str)),
  venue: z.string().min(1, 'Venue is required'),
  status: z.enum(['upcoming', 'live', 'completed']).default('upcoming'),
  matchType: z.enum(['T20', 'ODI', 'Test', 'IPL', 'Domestic']).default('T20'),
})

// Bet Entry Schemas
export const betEntrySchema = z.object({
  matchId: z.string().min(1, 'Match is required'),
  clientName: z.string().min(1, 'Client name is required'),
  clientUserId: z.string().optional().or(z.literal(null)),
  betOnTeam: z.enum(['teamA', 'teamB']),
  betAmount: z.string().transform(val => parseFloat(val)),
  odds: z.string().transform(val => parseFloat(val)),
  betType: z.string().min(1, 'Bet type is required'),
  result: z.enum(['win', 'loss', 'pending']).default('pending'),
  notes: z.string().optional().or(z.literal('')),
})

export const updateBetEntrySchema = betEntrySchema.partial().extend({
  settlementStatus: z.enum(['pending', 'collected', 'settled', 'lost_in_another_match']).optional(),
  linkedMatchId: z.string().optional().or(z.literal(null)),
})

export const settlementSchema = z.object({
  settlementStatus: z.enum(['pending', 'collected', 'settled', 'lost_in_another_match']),
  linkedMatchId: z.string().optional().nullable(),
  paymentMethod: z.enum(['upi', 'cash', 'pending']).optional().nullable(),
  upiTransactionId: z.string().optional().nullable(),
  paymentNote: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.settlementStatus === 'lost_in_another_match' && !data.linkedMatchId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Linked match is required when settlement is "lost in another match"',
      path: ['linkedMatchId'],
    })
  }
})

// Client Payment Schema
export const clientPaymentSchema = z.object({
  clientName: z.string().min(1, 'Client name is required'),
  clientUserId: z.string().optional().nullable(),
  amount: z.number().positive('Amount must be positive'),
  method: z.enum(['upi', 'cash']).default('cash'),
  upiRef: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
})

// Friend schemas
export const linkFriendSchema = z.object({
  friendId: z.string().min(1, 'Friend ID is required'),
})

// Bet assign schema
export const assignFriendSchema = z.object({
  clientUserId: z.string().min(1, 'Friend user ID is required'),
})

// Dispute schemas
export const disputeSchema = z.object({
  note: z.string().min(1, 'Dispute reason is required'),
})

export const resolveDisputeSchema = z.object({
  note: z.string().min(1, 'Resolution note is required'),
})

// Notification mark-read schema
export const markNotificationsReadSchema = z.object({
  ids: z.array(z.string()).optional(),
})

// Auth enhancement schemas
export const verifyEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'Code must be 6 digits').regex(/^\d{6}$/, 'Code must be digits only'),
})

export const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type SeriesInput = z.infer<typeof seriesSchema>
export type MatchInput = z.infer<typeof matchSchema>
export type BetEntryInput = z.infer<typeof betEntrySchema>
export type UpdateBetEntryInput = z.infer<typeof updateBetEntrySchema>
export type SettlementInput = z.infer<typeof settlementSchema>
export type ClientPaymentInput = z.infer<typeof clientPaymentSchema>
export type LinkFriendInput = z.infer<typeof linkFriendSchema>
export type AssignFriendInput = z.infer<typeof assignFriendSchema>
export type DisputeInput = z.infer<typeof disputeSchema>
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>
