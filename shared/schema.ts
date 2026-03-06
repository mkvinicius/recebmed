import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, numeric, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  profilePhotoUrl: text("profile_photo_url"),
});

export const entryMethodEnum = pgEnum("entry_method", ["photo", "audio", "manual"]);
export const entryStatusEnum = pgEnum("entry_status", ["pending", "reconciled", "divergent"]);

export const doctorEntries = pgTable("doctor_entries", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id", { length: 36 }).notNull(),
  patientName: text("patient_name").notNull(),
  procedureDate: timestamp("procedure_date").notNull(),
  insuranceProvider: text("insurance_provider").notNull(),
  description: text("description").notNull(),
  procedureValue: numeric("procedure_value", { precision: 12, scale: 2 }),
  entryMethod: entryMethodEnum("entry_method").notNull().default("manual"),
  sourceUrl: text("source_url"),
  imageHash: varchar("image_hash", { length: 64 }),
  status: entryStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clinicReports = pgTable("clinic_reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id", { length: 36 }).notNull(),
  patientName: text("patient_name").notNull(),
  procedureDate: timestamp("procedure_date").notNull(),
  reportedValue: numeric("reported_value", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  sourcePdfUrl: text("source_pdf_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id", { length: 36 }).notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  email: true,
  password: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const insertDoctorEntrySchema = createInsertSchema(doctorEntries).omit({
  id: true,
  createdAt: true,
});

export const insertClinicReportSchema = createInsertSchema(clinicReports).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type DoctorEntry = typeof doctorEntries.$inferSelect;
export type InsertDoctorEntry = z.infer<typeof insertDoctorEntrySchema>;
export type ClinicReport = typeof clinicReports.$inferSelect;
export type InsertClinicReport = z.infer<typeof insertClinicReportSchema>;

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export const aiCorrections = pgTable("ai_corrections", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id", { length: 36 }).notNull(),
  field: text("field").notNull(),
  originalValue: text("original_value").notNull(),
  correctedValue: text("corrected_value").notNull(),
  entryMethod: entryMethodEnum("entry_method").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAiCorrectionSchema = createInsertSchema(aiCorrections).omit({
  id: true,
  createdAt: true,
});
export type AiCorrection = typeof aiCorrections.$inferSelect;
export type InsertAiCorrection = z.infer<typeof insertAiCorrectionSchema>;

export * from "./models/chat";