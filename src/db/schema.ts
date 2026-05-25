import { pgTable, serial, varchar, timestamp, integer, boolean, text } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users (Admins & Staff synced from Clerk)
export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(), // Clerk User ID
  email: varchar("email", { length: 255 }), // Optional if using username
  username: varchar("username", { length: 255 }), 
  fullName: varchar("full_name", { length: 255 }),
  role: varchar("role", { length: 50 }).notNull().default("staff"), // 'admin', 'staff'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Members
export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull().unique(),
  gender: varchar("gender", { length: 10 }),
  birthDate: timestamp("birth_date"),
  avatarUrl: text("avatar_url"), // Added for profile photos
  joinDate: timestamp("join_date").defaultNow().notNull(),
  status: varchar("status", { length: 50 }).notNull().default("active"), // 'active', 'expired', 'inactive'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Membership Packages
export const membershipPackages = pgTable("membership_packages", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  price: integer("price").notNull(),
  durationMonths: integer("duration_months").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Member Subscriptions (Registered Packages)
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  packageId: integer("package_id").references(() => membershipPackages.id).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("active"), // 'active', 'expired', 'cancelled'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Check-ins
export const checkIns = pgTable("check_ins", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  checkInTime: timestamp("check_in_time").defaultNow().notNull(),
});

// Transactions
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  amount: integer("amount").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'registration', 'renewal'
  paymentMethod: varchar("payment_method", { length: 50 }).default("cash"), // 'cash', 'transfer'
  description: text("description"),
  transactionDate: timestamp("transaction_date").defaultNow().notNull(),
});

// Phase 2: Trainers & Classes
export const trainers = pgTable("trainers", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  specialty: varchar("specialty", { length: 255 }),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ptSessions = pgTable("pt_sessions", {
  id: serial("id").primaryKey(),
  trainerId: integer("trainer_id").references(() => trainers.id).notNull(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: varchar("status", { length: 50 }).default("scheduled").notNull(), // 'scheduled', 'completed', 'cancelled'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  trainerId: integer("trainer_id").references(() => trainers.id),
  capacity: integer("capacity").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const classSessions = pgTable("class_sessions", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").references(() => classes.id).notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: varchar("status", { length: 50 }).default("scheduled").notNull(),
});

export const classBookings = pgTable("class_bookings", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => classSessions.id).notNull(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  bookedAt: timestamp("booked_at").defaultNow().notNull(),
  status: varchar("status", { length: 50 }).default("booked").notNull(), // 'booked', 'attended', 'cancelled'
});

// Phase 3: Settings
export const gymSettings = pgTable("gym_settings", {
  id: serial("id").primaryKey(),
  bankId: varchar("bank_id", { length: 50 }), // e.g., 'vcb', 'mbbank'
  accountNo: varchar("account_no", { length: 50 }),
  accountName: varchar("account_name", { length: 255 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});


// Phase 4: Audit Logs
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(), // CREATE, UPDATE, DELETE
  entityType: varchar("entity_type", { length: 50 }).notNull(), // MEMBER, PACKAGE, SUBSCRIPTION, TRANSACTION
  entityId: varchar("entity_id", { length: 255 }).notNull(),
  details: text("details"), // JSON stringified details
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// Relations
export const membersRelations = relations(members, ({ many }) => ({
  subscriptions: many(subscriptions),
  checkIns: many(checkIns),
  transactions: many(transactions),
  ptSessions: many(ptSessions),
  classBookings: many(classBookings),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  member: one(members, {
    fields: [subscriptions.memberId],
    references: [members.id],
  }),
  package: one(membershipPackages, {
    fields: [subscriptions.packageId],
    references: [membershipPackages.id],
  }),
}));

export const checkInsRelations = relations(checkIns, ({ one }) => ({
  member: one(members, {
    fields: [checkIns.memberId],
    references: [members.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  member: one(members, {
    fields: [transactions.memberId],
    references: [members.id],
  }),
}));

export const trainersRelations = relations(trainers, ({ many }) => ({
  ptSessions: many(ptSessions),
  classes: many(classes),
}));

export const ptSessionsRelations = relations(ptSessions, ({ one }) => ({
  trainer: one(trainers, {
    fields: [ptSessions.trainerId],
    references: [trainers.id],
  }),
  member: one(members, {
    fields: [ptSessions.memberId],
    references: [members.id],
  }),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  trainer: one(trainers, {
    fields: [classes.trainerId],
    references: [trainers.id],
  }),
  sessions: many(classSessions),
}));

export const classSessionsRelations = relations(classSessions, ({ one, many }) => ({
  class: one(classes, {
    fields: [classSessions.classId],
    references: [classes.id],
  }),
  bookings: many(classBookings),
}));

export const classBookingsRelations = relations(classBookings, ({ one }) => ({
  session: one(classSessions, {
    fields: [classBookings.sessionId],
    references: [classSessions.id],
  }),
  member: one(members, {
    fields: [classBookings.memberId],
    references: [members.id],
  }),
}));
