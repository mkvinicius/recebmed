import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, numeric, pgEnum, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  profilePhotoUrl: text("profile_photo_url"),
  aiAuditEnabled: boolean("ai_audit_enabled").notNull().default(true),
  isAdmin: boolean("is_admin").notNull().default(false),
  platformDoctrine: text("platform_doctrine"),
});

export const entryMethodEnum = pgEnum("entry_method", ["photo", "audio", "manual"]);
export const entryStatusEnum = pgEnum("entry_status", ["pending", "reconciled", "divergent", "validated"]);

export const doctorEntries = pgTable("doctor_entries", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id", { length: 36 }).notNull(),
  patientName: text("patient_name").notNull(),
  patientBirthDate: text("patient_birth_date"),
  procedureDate: timestamp("procedure_date").notNull(),
  procedureName: text("procedure_name"),
  insuranceProvider: text("insurance_provider").notNull(),
  description: text("description"),
  procedureValue: numeric("procedure_value", { precision: 12, scale: 2 }),
  entryMethod: entryMethodEnum("entry_method").notNull().default("manual"),
  sourceUrl: text("source_url"),
  imageHash: varchar("image_hash", { length: 64 }),
  matchedReportId: varchar("matched_report_id", { length: 36 }),
  divergenceReason: text("divergence_reason"),
  matchConfidence: integer("match_confidence"),
  status: entryStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clinicReports = pgTable("clinic_reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id", { length: 36 }).notNull(),
  patientName: text("patient_name").notNull(),
  patientBirthDate: text("patient_birth_date"),
  procedureDate: timestamp("procedure_date").notNull(),
  procedureName: text("procedure_name"),
  insuranceProvider: text("insurance_provider"),
  reportedValue: numeric("reported_value", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  sourcePdfUrl: text("source_pdf_url"),
  matched: boolean("matched").notNull().default(false),
  matchedEntryId: varchar("matched_entry_id", { length: 36 }),
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

export const passwordSchema = z
  .string()
  .min(8, "Senha deve ter no mínimo 8 caracteres")
  .regex(/[A-Z]/, "Senha deve conter pelo menos 1 letra maiúscula")
  .regex(/[a-z]/, "Senha deve conter pelo menos 1 letra minúscula")
  .regex(/[0-9]/, "Senha deve conter pelo menos 1 número");

export const insertUserSchema = createInsertSchema(users)
  .pick({
    name: true,
    email: true,
    password: true,
  })
  .extend({
    password: passwordSchema,
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

export const uploadedReports = pgTable("uploaded_reports", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  fileName: text("file_name").notNull(),
  customName: text("custom_name"),
  originalFileUrl: text("original_file_url").notNull(),
  extractedRecordCount: integer("extracted_record_count").notNull().default(0),
  uploadDate: timestamp("upload_date").defaultNow().notNull(),
});

export const insertUploadedReportSchema = createInsertSchema(uploadedReports).omit({ id: true, uploadDate: true });
export type UploadedReport = typeof uploadedReports.$inferSelect;
export type InsertUploadedReport = z.infer<typeof insertUploadedReportSchema>;

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id", { length: 36 }).notNull(),
  triggerType: text("trigger_type").notNull(),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  reconciledCount: integer("reconciled_count").notNull().default(0),
  divergentAfter: integer("divergent_after").notNull().default(0),
  errorMessage: text("error_message"),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true });
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export const documentTemplates = pgTable("document_templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  mappingJson: text("mapping_json").notNull(),
  sampleHash: varchar("sample_hash", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({ id: true, createdAt: true });
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;

export const aiAuditFindings = pgTable("ai_audit_findings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  doctorId: varchar("doctor_id", { length: 36 }).notNull(),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  entryIds: text("entry_ids").array().notNull(),
  resolved: boolean("resolved").notNull().default(false),
  scanTimestamp: timestamp("scan_timestamp").defaultNow().notNull(),
});

export const insertAiAuditFindingSchema = createInsertSchema(aiAuditFindings).omit({ id: true, scanTimestamp: true });
export type AiAuditFinding = typeof aiAuditFindings.$inferSelect;
export type InsertAiAuditFinding = z.infer<typeof insertAiAuditFindingSchema>;

export * from "./models/chat";