import {
  type User, type InsertUser, users,
  type DoctorEntry, type InsertDoctorEntry, doctorEntries,
  type ClinicReport, type InsertClinicReport, clinicReports,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  createDoctorEntry(entry: InsertDoctorEntry): Promise<DoctorEntry>;
  getDoctorEntries(doctorId: string): Promise<DoctorEntry[]>;
  getDoctorEntry(id: string): Promise<DoctorEntry | undefined>;

  createClinicReport(report: InsertClinicReport): Promise<ClinicReport>;
  getClinicReports(doctorId: string): Promise<ClinicReport[]>;
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

  async createClinicReport(report: InsertClinicReport): Promise<ClinicReport> {
    const [result] = await db.insert(clinicReports).values(report).returning();
    return result;
  }

  async getClinicReports(doctorId: string): Promise<ClinicReport[]> {
    return db.select().from(clinicReports).where(eq(clinicReports.doctorId, doctorId)).orderBy(desc(clinicReports.createdAt));
  }
}

export const storage = new DatabaseStorage();