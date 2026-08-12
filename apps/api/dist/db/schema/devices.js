import { pgTable, pgEnum, varchar, uuid, timestamp } from 'drizzle-orm/pg-core';
export const pairingCodeStatusEnum = pgEnum('pairing_code_status', ['pending', 'approved', 'expired']);
export const devices = pgTable('devices', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 128 }).notNull().default('TV'),
    tokenHash: varchar('token_hash', { length: 128 }).unique().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const pairingCodes = pgTable('pairing_codes', {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 8 }).unique().notNull(),
    status: pairingCodeStatusEnum('status').notNull().default('pending'),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
//# sourceMappingURL=devices.js.map