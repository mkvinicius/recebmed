import {
  type User, type InsertUser, users,
  type DoctorEntry, type InsertDoctorEntry, doctorEntries,
  type ClinicReport, type InsertClinicReport, clinicReports,
  type Notification, type InsertNotification, notifications,
  type AiCorrection, type InsertAiCorrection, aiCorrections,
  type AuditLog, type InsertAuditLog, auditLogs,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, inArray, or, ilike, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserName(id: string, name: string): Promise<User | undefined>;
  updateUserPassword(id: string, hashedPassword: string): Promise<boolean>;
  updateUserProfilePhoto(id: string, profilePhotoUrl: string | null): Promise<User | undefined>;

  createDoctorEntry(entry: InsertDoctorEntry): Promise<DoctorEntry>;
  getDoctorEntries(doctorId: string): Promise<DoctorEntry[]>;
  getDoctorEntry(id: string): Promise<DoctorEntry | undefined>;
  updateDoctorEntry(id: string, updates: Partial<InsertDoctorEntry>): Promise<DoctorEntry | undefined>;
  deleteDoctorEntry(id: string): Promise<boolean>;

  createClinicReport(report: InsertClinicReport): Promise<ClinicReport>;
  getClinicReports(doctorId: string): Promise<ClinicReport[]>;
  getClinicReport(id: string): Promise<ClinicReport | undefined>;
  deleteClinicReport(id: string): Promise<boolean>;

  getNotifications(doctorId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<boolean>;
  markAllNotificationsRead(doctorId: string): Promise<boolean>;
  getUnreadNotificationCount(doctorId: string): Promise<number>;

  getPendingDoctorEntries(doctorId: string): Promise<DoctorEntry[]>;
  getRecentClinicReports(doctorId: string, since: Date): Promise<ClinicReport[]>;
  batchUpdateDoctorEntryStatus(updates: Array<{ id: string; status: string; matchedReportId?: string | null; divergenceReason?: string | null }>): Promise<void>;
  getReconciledAndDivergentEntries(doctorId: string): Promise<DoctorEntry[]>;
  searchDoctorEntries(doctorId: string, query: string): Promise<DoctorEntry[]>;

  createAiCorrection(correction: InsertAiCorrection): Promise<AiCorrection>;
  createAiCorrections(corrections: InsertAiCorrection[]): Promise<AiCorrection[]>;
  getRecentAiCorrections(doctorId: string, limit?: number): Promise<AiCorrection[]>;

  findByImageHash(doctorId: string, hash: string): Promise<DoctorEntry[]>;
  findDuplicatesByData(doctorId: string, patientName: string, procedureDate: Date, description: string): Promise<DoctorEntry[]>;
  getDistinctPatientNames(doctorId: string, query?: string): Promise<string[]>;
  getActiveUserIds(): Promise<string[]>;
  getDivergentDoctorEntries(doctorId: string): Promise<DoctorEntry[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserName(id: string, name: string): Promise<User | undefined> {
    const [user] = await db.update(users).set({ name }).where(eq(users.id, id)).returning();
    return user;
  }

  async updateUserPassword(id: string, hashedPassword: string): Promise<boolean> {
    const result = await db.update(users).set({ password: hashedPassword }).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async updateUserProfilePhoto(id: string, profilePhotoUrl: string | null): Promise<User | undefined> {
    const [user] = await db.update(users).set({ profilePhotoUrl }).where(eq(users.id, id)).returning();
    return user;
  }

  async createDoctorEntry(entry: InsertDoctorEntry): Promise<DoctorEntry> {
    const [result] = await db.insert(doctorEntries).values(entry).returning();
    return result;
  }

  async getDoctorEntries(doctorId: string): Promise<DoctorEntry[]> {
    return db.select().from(doctorEntries).where(eq(doctorEntries.doctorId, doctorId)).orderBy(desc(doctorEntries.createdAt));
  }

  async getDoctorEntry(id: string): Promise<DoctorEntry | undefined> {
    const [entry] = await db.select().from(doctorEntries).where(eq(doctorEntries.id, id));
    return entry;
  }

  async updateDoctorEntry(id: string, updates: Partial<InsertDoctorEntry>): Promise<DoctorEntry | undefined> {
    const [result] = await db.update(doctorEntries).set(updates).where(eq(doctorEntries.id, id)).returning();
    return result;
  }

  async deleteDoctorEntry(id: string): Promise<boolean> {
    const result = await db.delete(doctorEntries).where(eq(doctorEntries.id, id)).returning();
    return result.length > 0;
  }

  async createClinicReport(report: InsertClinicReport): Promise<ClinicReport> {
    const [result] = await db.insert(clinicReports).values(report).returning();
    return result;
  }

  async getClinicReports(doctorId: string): Promise<ClinicReport[]> {
    return db.select().from(clinicReports).where(eq(clinicReports.doctorId, doctorId)).orderBy(desc(clinicReports.createdAt));
  }

  async getClinicReport(id: string): Promise<ClinicReport | undefined> {
    const [report] = await db.select().from(clinicReports).where(eq(clinicReports.id, id));
    return report;
  }

  async deleteClinicReport(id: string): Promise<boolean> {
    const result = await db.delete(clinicReports).where(eq(clinicReports.id, id)).returning();
    return result.length > 0;
  }

  async getNotifications(doctorId: string): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.doctorId, doctorId)).orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [result] = await db.insert(notifications).values(notification).returning();
    return result;
  }

  async markNotificationRead(id: string): Promise<boolean> {
    const result = await db.update(notifications).set({ read: true }).where(eq(notifications.id, id)).returning();
    return result.length > 0;
  }

  async markAllNotificationsRead(doctorId: string): Promise<boolean> {
    await db.update(notifications).set({ read: true }).where(and(eq(notifications.doctorId, doctorId), eq(notifications.read, false)));
    return true;
  }

  async getUnreadNotificationCount(doctorId: string): Promise<number> {
    const result = await db.select().from(notifications).where(and(eq(notifications.doctorId, doctorId), eq(notifications.read, false)));
    return result.length;
  }

  async getPendingDoctorEntries(doctorId: string): Promise<DoctorEntry[]> {
    return db.select().from(doctorEntries).where(and(eq(doctorEntries.doctorId, doctorId), eq(doctorEntries.status, "pending"))).orderBy(desc(doctorEntries.createdAt));
  }

  async getRecentClinicReports(doctorId: string, since: Date): Promise<ClinicReport[]> {
    return db.select().from(clinicReports).where(and(eq(clinicReports.doctorId, doctorId), gte(clinicReports.createdAt, since))).orderBy(desc(clinicReports.createdAt));
  }

  async batchUpdateDoctorEntryStatus(updates: Array<{ id: string; status: string; matchedReportId?: string | null; divergenceReason?: string | null }>): Promise<void> {
    for (const update of updates) {
      const setData: any = { status: update.status as any };
      if (update.matchedReportId !== undefined) setData.matchedReportId = update.matchedReportId;
      if (update.divergenceReason !== undefined) setData.divergenceReason = update.divergenceReason;
      await db.update(doctorEntries).set(setData).where(eq(doctorEntries.id, update.id));
    }
  }

  async getReconciledAndDivergentEntries(doctorId: string): Promise<DoctorEntry[]> {
    return db.select().from(doctorEntries).where(and(eq(doctorEntries.doctorId, doctorId), or(eq(doctorEntries.status, "reconciled"), eq(doctorEntries.status, "divergent")))).orderBy(desc(doctorEntries.procedureDate));
  }

  async searchDoctorEntries(doctorId: string, query: string): Promise<DoctorEntry[]> {
    const pattern = `%${query}%`;
    return db.select().from(doctorEntries).where(
      and(
        eq(doctorEntries.doctorId, doctorId),
        or(
          ilike(doctorEntries.patientName, pattern),
          ilike(doctorEntries.description, pattern),
          ilike(doctorEntries.insuranceProvider, pattern)
        )
      )
    ).orderBy(desc(doctorEntries.createdAt)).limit(20);
  }
  async createAiCorrection(correction: InsertAiCorrection): Promise<AiCorrection> {
    const [result] = await db.insert(aiCorrections).values(correction).returning();
    return result;
  }

  async createAiCorrections(corrections: InsertAiCorrection[]): Promise<AiCorrection[]> {
    if (corrections.length === 0) return [];
    const results = await db.insert(aiCorrections).values(corrections).returning();
    return results;
  }

  async getRecentAiCorrections(doctorId: string, limit: number = 30): Promise<AiCorrection[]> {
    return db.select().from(aiCorrections).where(eq(aiCorrections.doctorId, doctorId)).orderBy(desc(aiCorrections.createdAt)).limit(limit);
  }

  async findByImageHash(doctorId: string, hash: string): Promise<DoctorEntry[]> {
    return db.select().from(doctorEntries).where(
      and(eq(doctorEntries.doctorId, doctorId), eq(doctorEntries.imageHash, hash))
    ).orderBy(desc(doctorEntries.createdAt)).limit(5);
  }

  async findDuplicatesByData(doctorId: string, patientName: string, procedureDate: Date, description: string): Promise<DoctorEntry[]> {
    const dayStart = new Date(procedureDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(procedureDate);
    dayEnd.setHours(23, 59, 59, 999);

    const normalized = normalizePatientName(patientName);
    const allSameDay = await db.select().from(doctorEntries).where(
      and(
        eq(doctorEntries.doctorId, doctorId),
        gte(doctorEntries.procedureDate, dayStart),
        sql`${doctorEntries.procedureDate} <= ${dayEnd}`,
        ilike(doctorEntries.description, description)
      )
    ).orderBy(desc(doctorEntries.createdAt)).limit(20);

    return allSameDay.filter(e => normalizePatientName(e.patientName) === normalized).slice(0, 5);
  }

  async getDistinctPatientNames(doctorId: string, query?: string): Promise<string[]> {
    const rows = await db.selectDistinct({ patientName: doctorEntries.patientName })
      .from(doctorEntries)
      .where(
        query
          ? and(eq(doctorEntries.doctorId, doctorId), ilike(doctorEntries.patientName, `%${query}%`))
          : eq(doctorEntries.doctorId, doctorId)
      )
      .orderBy(doctorEntries.patientName)
      .limit(50);

    if (!query) return rows.map(r => r.patientName);

    const normalizedQuery = normalizePatientName(query);
    const allNames = rows.map(r => r.patientName);

    if (normalizedQuery.length >= 2) {
      const extraRows = await db.selectDistinct({ patientName: doctorEntries.patientName })
        .from(doctorEntries)
        .where(eq(doctorEntries.doctorId, doctorId))
        .orderBy(doctorEntries.patientName)
        .limit(200);

      const seen = new Set(allNames.map(n => n.toLowerCase()));
      for (const r of extraRows) {
        if (!seen.has(r.patientName.toLowerCase()) && normalizePatientName(r.patientName).includes(normalizedQuery)) {
          allNames.push(r.patientName);
          seen.add(r.patientName.toLowerCase());
        }
      }
    }

    return allNames.slice(0, 20);
  }

  async getActiveUserIds(): Promise<string[]> {
    const result = await db.selectDistinct({ doctorId: doctorEntries.doctorId }).from(doctorEntries);
    return result.map(r => r.doctorId);
  }

  async getDivergentDoctorEntries(doctorId: string): Promise<DoctorEntry[]> {
    return db.select().from(doctorEntries).where(and(eq(doctorEntries.doctorId, doctorId), eq(doctorEntries.status, "divergent"))).orderBy(desc(doctorEntries.createdAt));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [result] = await db.insert(auditLogs).values(log).returning();
    return result;
  }
}

function normalizePatientName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const storage = new DatabaseStorage();