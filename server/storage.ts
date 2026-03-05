import {
  type User, type InsertUser, users,
  type DoctorEntry, type InsertDoctorEntry, doctorEntries,
  type ClinicReport, type InsertClinicReport, clinicReports,
  type Notification, type InsertNotification, notifications,
  type AiCorrection, type InsertAiCorrection, aiCorrections,
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
  batchUpdateDoctorEntryStatus(updates: Array<{ id: string; status: string }>): Promise<void>;
  getReconciledAndDivergentEntries(doctorId: string): Promise<DoctorEntry[]>;
  searchDoctorEntries(doctorId: string, query: string): Promise<DoctorEntry[]>;

  createAiCorrection(correction: InsertAiCorrection): Promise<AiCorrection>;
  createAiCorrections(corrections: InsertAiCorrection[]): Promise<AiCorrection[]>;
  getRecentAiCorrections(doctorId: string, limit?: number): Promise<AiCorrection[]>;
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

  async batchUpdateDoctorEntryStatus(updates: Array<{ id: string; status: string }>): Promise<void> {
    for (const update of updates) {
      await db.update(doctorEntries).set({ status: update.status as any }).where(eq(doctorEntries.id, update.id));
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
}

export const storage = new DatabaseStorage();