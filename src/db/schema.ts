import { pgTable, serial, varchar, timestamp, integer, boolean, text, uniqueIndex, index, jsonb, doublePrecision, uuid } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// Internal users (admins & staff)
export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }), // Optional if using username
  username: varchar("username", { length: 255 }),
  fullName: varchar("full_name", { length: 255 }),
  phoneNumber: varchar("phone_number", { length: 20 }),
  jobTitle: varchar("job_title", { length: 100 }),
  passwordHash: text("password_hash"),
  isLocked: boolean("is_locked").default(false).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("staff"), // 'admin', 'staff'
  sessionVersion: integer("session_version").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("users_email_unique_lower").on(sql`lower(${table.email})`),
  uniqueIndex("users_username_unique_lower").on(sql`lower(${table.username})`),
]);

// Members
export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  publicToken: uuid("public_token").defaultRandom().notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull().unique(),
  gender: varchar("gender", { length: 10 }),
  birthDate: timestamp("birth_date"),
  avatarUrl: text("avatar_url"), // Added for profile photos
  joinDate: timestamp("join_date").defaultNow().notNull(),
  status: varchar("status", { length: 50 }).notNull().default("active"), // 'active', 'expired', 'inactive'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("members_public_token_unique").on(table.publicToken),
  index("members_status_created_idx").on(table.status, table.createdAt),
]);

// AI face-recognition devices. The serial number is the identity sent by AI26
// in its initial protocol `reg` message.
export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  serialNumber: varchar("serial_number", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  modelName: varchar("model_name", { length: 100 }),
  firmware: varchar("firmware", { length: 255 }),
  status: varchar("status", { length: 30 }).notNull().default("offline"),
  isActive: boolean("is_active").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at"),
  lastIp: varchar("last_ip", { length: 100 }),
  logCapacity: integer("log_capacity"),
  usedLogCount: integer("used_log_count"),
  unsyncedLogCount: integer("unsynced_log_count"),
  logStatsAt: timestamp("log_stats_at"),
  lastLogSyncedAt: timestamp("last_log_synced_at"),
  lastLogCleanupAt: timestamp("last_log_cleanup_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("devices_serial_number_unique").on(table.serialNumber),
  index("devices_status_idx").on(table.status),
]);

// A member can be enrolled on more than one device. AI26 calls enrollId
// `enrollid`; it must be unique per physical device.
export const deviceMemberMappings = pgTable("device_member_mappings", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").references(() => devices.id, { onDelete: "cascade" }).notNull(),
  memberId: integer("member_id").references(() => members.id, { onDelete: "cascade" }).notNull(),
  enrollId: integer("enroll_id").notNull(),
  faceStatus: varchar("face_status", { length: 30 }).notNull().default("not_registered"),
  accessEnabled: boolean("access_enabled"),
  faceEnrolledAt: timestamp("face_enrolled_at"),
  lastAccessSyncedAt: timestamp("last_access_synced_at"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("device_member_unique").on(table.deviceId, table.memberId),
  uniqueIndex("device_enroll_id_unique").on(table.deviceId, table.enrollId),
  index("device_member_face_status_idx").on(table.faceStatus),
]);

// Commands are kept for auditability. Either the local Gateway or AI26's
// direct HTTP/HTTPS polling mode claims pending rows when the device is online.
export const deviceCommands = pgTable("device_commands", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").references(() => devices.id, { onDelete: "cascade" }).notNull(),
  memberId: integer("member_id").references(() => members.id, { onDelete: "set null" }),
  command: varchar("command", { length: 50 }).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  error: text("error"),
  sentAt: timestamp("sent_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("device_commands_device_status_idx").on(table.deviceId, table.status),
  index("device_commands_created_at_idx").on(table.createdAt),
]);

// Lightweight protocol audit log. Biometric templates and Base64 photos are
// deliberately stripped before data is written here.
export const deviceEvents = pgTable("device_events", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").references(() => devices.id, { onDelete: "cascade" }).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  eventKey: varchar("event_key", { length: 255 }),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("device_events_event_key_unique").on(table.eventKey),
  index("device_events_device_created_idx").on(table.deviceId, table.createdAt),
  index("device_events_created_at_idx").on(table.createdAt),
]);

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
}, (table) => [
  index("subscriptions_member_validity_idx").on(
    table.memberId,
    table.status,
    table.startDate,
    table.endDate
  ),
  index("subscriptions_status_end_date_idx").on(table.status, table.endDate),
]);

// Check-ins
export const checkIns = pgTable("check_ins", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  checkInTime: timestamp("check_in_time").defaultNow().notNull(),
  source: varchar("source", { length: 30 }).notNull().default("web"),
  deviceId: integer("device_id").references(() => devices.id, { onDelete: "set null" }),
  deviceEventKey: varchar("device_event_key", { length: 255 }),
  verificationMode: integer("verification_mode"),
  temperature: doublePrecision("temperature"),
}, (table) => [
  uniqueIndex("check_ins_device_event_key_unique").on(table.deviceEventKey),
  index("check_ins_device_time_idx").on(table.deviceId, table.checkInTime),
  index("check_ins_time_idx").on(table.checkInTime),
  index("check_ins_member_time_idx").on(table.memberId, table.checkInTime),
]);

// Rejected attempts are stored separately so attendance totals only include
// successful entries while staff can still follow up with expired members.
export const failedCheckIns = pgTable("failed_check_ins", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => members.id, { onDelete: "cascade" }),
  deviceId: integer("device_id").references(() => devices.id, { onDelete: "set null" }),
  enrollId: integer("enroll_id"),
  attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
  source: varchar("source", { length: 30 }).notNull().default("ai26"),
  reason: varchar("reason", { length: 50 }).notNull(),
  message: text("message"),
  deviceEventKey: varchar("device_event_key", { length: 255 }),
}, (table) => [
  uniqueIndex("failed_check_ins_device_event_key_unique").on(table.deviceEventKey),
  index("failed_check_ins_member_time_idx").on(table.memberId, table.attemptedAt),
  index("failed_check_ins_reason_time_idx").on(table.reason, table.attemptedAt),
]);

// Transactions
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  amount: integer("amount").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'registration', 'renewal'
  paymentMethod: varchar("payment_method", { length: 50 }).default("cash"), // 'cash', 'transfer'
  description: text("description"),
  transactionDate: timestamp("transaction_date").defaultNow().notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 100 }),
}, (table) => [
  uniqueIndex("transactions_idempotency_key_unique").on(table.idempotencyKey),
  index("transactions_date_idx").on(table.transactionDate),
  index("transactions_member_date_idx").on(table.memberId, table.transactionDate),
]);

// Phase 2: Trainers & Classes
export const trainers = pgTable("trainers", {
  id: serial("id").primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  email: varchar("email", { length: 255 }),
  specialty: varchar("specialty", { length: 255 }),
  employmentType: varchar("employment_type", { length: 30 }).default("full_time").notNull(),
  maxConcurrentClients: integer("max_concurrent_clients").default(1).notNull(),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("trainers_active_created_idx").on(table.isActive, table.createdAt),
]);

export const ptSessions = pgTable("pt_sessions", {
  id: serial("id").primaryKey(),
  trainerId: integer("trainer_id").references(() => trainers.id).notNull(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: varchar("status", { length: 50 }).default("scheduled").notNull(), // 'scheduled', 'completed', 'cancelled'
  notes: text("notes"),
  seriesId: varchar("series_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("pt_sessions_trainer_time_idx").on(table.trainerId, table.startTime, table.endTime),
  index("pt_sessions_series_idx").on(table.seriesId),
]);

export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  trainerId: integer("trainer_id").references(() => trainers.id),
  capacity: integer("capacity").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("classes_active_created_idx").on(table.isActive, table.createdAt),
]);

export const classSessions = pgTable("class_sessions", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").references(() => classes.id).notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: varchar("status", { length: 50 }).default("scheduled").notNull(),
}, (table) => [
  index("class_sessions_start_time_idx").on(table.startTime),
]);

export const classBookings = pgTable("class_bookings", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => classSessions.id).notNull(),
  memberId: integer("member_id").references(() => members.id).notNull(),
  bookedAt: timestamp("booked_at").defaultNow().notNull(),
  status: varchar("status", { length: 50 }).default("booked").notNull(), // 'booked', 'attended', 'cancelled'
}, (table) => [
  uniqueIndex("class_bookings_session_member_unique").on(table.sessionId, table.memberId),
  index("class_bookings_session_status_idx").on(table.sessionId, table.status),
]);

// Shared fixed-window counters used by public/login endpoints. Keeping these in
// Neon makes the limit effective across every Vercel instance.
export const rateLimits = pgTable("rate_limits", {
  key: varchar("key", { length: 64 }).primaryKey(),
  count: integer("count").notNull().default(1),
  windowStartedAt: timestamp("window_started_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => [
  index("rate_limits_expires_at_idx").on(table.expiresAt),
]);

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
}, (table) => [
  index("audit_logs_created_at_idx").on(table.createdAt),
]);

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
  failedCheckIns: many(failedCheckIns),
  transactions: many(transactions),
  ptSessions: many(ptSessions),
  classBookings: many(classBookings),
  deviceMappings: many(deviceMemberMappings),
  deviceCommands: many(deviceCommands),
}));

export const devicesRelations = relations(devices, ({ many }) => ({
  memberMappings: many(deviceMemberMappings),
  commands: many(deviceCommands),
  events: many(deviceEvents),
  checkIns: many(checkIns),
  failedCheckIns: many(failedCheckIns),
}));

export const deviceMemberMappingsRelations = relations(deviceMemberMappings, ({ one }) => ({
  device: one(devices, {
    fields: [deviceMemberMappings.deviceId],
    references: [devices.id],
  }),
  member: one(members, {
    fields: [deviceMemberMappings.memberId],
    references: [members.id],
  }),
}));

export const deviceCommandsRelations = relations(deviceCommands, ({ one }) => ({
  device: one(devices, {
    fields: [deviceCommands.deviceId],
    references: [devices.id],
  }),
  member: one(members, {
    fields: [deviceCommands.memberId],
    references: [members.id],
  }),
}));

export const deviceEventsRelations = relations(deviceEvents, ({ one }) => ({
  device: one(devices, {
    fields: [deviceEvents.deviceId],
    references: [devices.id],
  }),
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
  device: one(devices, {
    fields: [checkIns.deviceId],
    references: [devices.id],
  }),
}));

export const failedCheckInsRelations = relations(failedCheckIns, ({ one }) => ({
  member: one(members, {
    fields: [failedCheckIns.memberId],
    references: [members.id],
  }),
  device: one(devices, {
    fields: [failedCheckIns.deviceId],
    references: [devices.id],
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
