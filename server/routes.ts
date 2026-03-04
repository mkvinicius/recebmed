import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, loginSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { extractDataFromImage, extractDataFromAudio } from "./openai";
import { extractPdfData, runReconciliation } from "./reconciliation";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

const JWT_SECRET = process.env.JWT_SECRET || "medfin_jwt_secret_dev_key";

function generateToken(userId: string): string {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token não fornecido" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    (req as any).userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ── Auth ──

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
      }
      const { name, email, password } = parsed.data;
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "Este email já está cadastrado" });
      }
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const user = await storage.createUser({ name, email, password: hashedPassword });
      const token = generateToken(user.id);
      return res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
      console.error("Register error:", error);
      return res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
      }
      const { email, password } = parsed.data;
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }
      const token = generateToken(user.id);
      return res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      return res.json({ user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
      console.error("Me error:", error);
      return res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.put("/api/auth/profile", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { name } = req.body;
      if (!name || name.trim().length === 0) {
        return res.status(400).json({ message: "Nome é obrigatório" });
      }
      const updated = await storage.updateUserName(userId, name.trim());
      if (!updated) return res.status(404).json({ message: "Usuário não encontrado" });
      return res.json({ user: { id: updated.id, name: updated.name, email: updated.email } });
    } catch (error) {
      console.error("Update profile error:", error);
      return res.status(500).json({ message: "Erro ao atualizar perfil" });
    }
  });

  app.put("/api/auth/password", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Senhas são obrigatórias" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "A nova senha deve ter pelo menos 6 caracteres" });
      }
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) return res.status(401).json({ message: "Senha atual incorreta" });
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(newPassword, salt);
      await storage.updateUserPassword(userId, hashed);
      return res.json({ success: true, message: "Senha alterada com sucesso" });
    } catch (error) {
      console.error("Change password error:", error);
      return res.status(500).json({ message: "Erro ao alterar senha" });
    }
  });

  // ── AI Extraction ──

  app.post("/api/entries/photo", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ message: "Imagem não enviada" });
      }
      const base64 = image.replace(/^data:image\/\w+;base64,/, "");
      const extractedData = await extractDataFromImage(base64);
      return res.json({ success: true, extractedData });
    } catch (error) {
      console.error("Photo entry error:", error);
      return res.status(500).json({ message: "Erro ao processar imagem" });
    }
  });

  app.post("/api/entries/audio", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { audio } = req.body;
      if (!audio) {
        return res.status(400).json({ message: "Áudio não enviado" });
      }
      const base64 = audio.replace(/^data:[^;]+;base64,/, "");
      const extractedData = await extractDataFromAudio(base64);
      return res.json({ success: true, extractedData });
    } catch (error) {
      console.error("Audio entry error:", error);
      return res.status(500).json({ message: "Erro ao processar áudio" });
    }
  });

  // ── Entries CRUD ──

  app.post("/api/entries", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { patientName, procedureDate, insuranceProvider, description, entryMethod, procedureValue } = req.body;

      if (!patientName || !procedureDate || !insuranceProvider || !description) {
        return res.status(400).json({ message: "Todos os campos são obrigatórios" });
      }

      const entry = await storage.createDoctorEntry({
        doctorId: userId,
        patientName,
        procedureDate: new Date(procedureDate),
        insuranceProvider,
        description,
        procedureValue: procedureValue || null,
        entryMethod: entryMethod || "manual",
        sourceUrl: req.body.sourceUrl || null,
        status: "pending",
      });

      await storage.createNotification({
        doctorId: userId,
        type: "entry_created",
        title: "Novo lançamento",
        message: `Lançamento registrado: ${patientName} - ${description}`,
        read: false,
      });

      return res.status(201).json({ entry });
    } catch (error) {
      console.error("Create entry error:", error);
      return res.status(500).json({ message: "Erro ao salvar lançamento" });
    }
  });

  app.post("/api/entries/batch", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { entries: entriesData, entryMethod } = req.body;

      if (!Array.isArray(entriesData) || entriesData.length === 0) {
        return res.status(400).json({ message: "Nenhum lançamento fornecido" });
      }

      const savedEntries = [];
      for (const item of entriesData) {
        if (!item.patientName || !item.procedureDate || !item.insuranceProvider || !item.description) {
          continue;
        }
        const entry = await storage.createDoctorEntry({
          doctorId: userId,
          patientName: item.patientName,
          procedureDate: new Date(item.procedureDate),
          insuranceProvider: item.insuranceProvider,
          description: item.description,
          procedureValue: item.procedureValue || null,
          entryMethod: entryMethod || "manual",
          sourceUrl: item.sourceUrl || null,
          status: "pending",
        });
        savedEntries.push(entry);
      }

      if (savedEntries.length > 0) {
        await storage.createNotification({
          doctorId: userId,
          type: "batch_created",
          title: "Lançamentos em lote",
          message: `${savedEntries.length} lançamentos registrados com sucesso`,
          read: false,
        });
      }

      return res.status(201).json({ entries: savedEntries, count: savedEntries.length });
    } catch (error) {
      console.error("Batch create error:", error);
      return res.status(500).json({ message: "Erro ao salvar lançamentos" });
    }
  });

  app.get("/api/entries", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const entries = await storage.getDoctorEntries(userId);
      return res.json({ entries });
    } catch (error) {
      console.error("Get entries error:", error);
      return res.status(500).json({ message: "Erro ao buscar lançamentos" });
    }
  });

  app.put("/api/entries/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const existing = await storage.getDoctorEntry(id);
      if (!existing || existing.doctorId !== userId) {
        return res.status(404).json({ message: "Lançamento não encontrado" });
      }

      const { patientName, procedureDate, insuranceProvider, description, status, procedureValue } = req.body;
      const updates: any = {};
      if (patientName !== undefined) updates.patientName = patientName;
      if (procedureDate !== undefined) updates.procedureDate = new Date(procedureDate);
      if (insuranceProvider !== undefined) updates.insuranceProvider = insuranceProvider;
      if (description !== undefined) updates.description = description;
      if (status !== undefined) updates.status = status;
      if (procedureValue !== undefined) updates.procedureValue = procedureValue;

      if (status === "divergent" && existing.status !== "divergent") {
        await storage.createNotification({
          doctorId: userId,
          type: "divergence",
          title: "Divergência detectada",
          message: `Atenção: divergência marcada em ${existing.patientName} - ${existing.description}`,
          read: false,
        });
      }

      const updated = await storage.updateDoctorEntry(id, updates);
      return res.json({ entry: updated });
    } catch (error) {
      console.error("Update entry error:", error);
      return res.status(500).json({ message: "Erro ao atualizar lançamento" });
    }
  });

  app.delete("/api/entries/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const existing = await storage.getDoctorEntry(id);
      if (!existing || existing.doctorId !== userId) {
        return res.status(404).json({ message: "Lançamento não encontrado" });
      }
      await storage.deleteDoctorEntry(id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Delete entry error:", error);
      return res.status(500).json({ message: "Erro ao excluir lançamento" });
    }
  });

  // ── Clinic Reports ──

  app.get("/api/clinic-reports", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const reports = await storage.getClinicReports(userId);
      return res.json({ reports });
    } catch (error) {
      console.error("Get clinic reports error:", error);
      return res.status(500).json({ message: "Erro ao buscar relatórios" });
    }
  });

  app.post("/api/clinic-reports", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { patientName, procedureDate, reportedValue, description } = req.body;
      if (!patientName || !procedureDate || !reportedValue) {
        return res.status(400).json({ message: "Nome do paciente, data e valor são obrigatórios" });
      }
      const report = await storage.createClinicReport({
        doctorId: userId,
        patientName,
        procedureDate: new Date(procedureDate),
        reportedValue,
        description: description || null,
        sourcePdfUrl: null,
      });
      return res.status(201).json({ report });
    } catch (error) {
      console.error("Create clinic report error:", error);
      return res.status(500).json({ message: "Erro ao criar relatório" });
    }
  });

  app.delete("/api/clinic-reports/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const existing = await storage.getClinicReport(id);
      if (!existing || existing.doctorId !== userId) {
        return res.status(404).json({ message: "Relatório não encontrado" });
      }
      await storage.deleteClinicReport(id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Delete clinic report error:", error);
      return res.status(500).json({ message: "Erro ao excluir relatório" });
    }
  });

  // ── Notifications ──

  app.get("/api/notifications", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const notifs = await storage.getNotifications(userId);
      const unreadCount = await storage.getUnreadNotificationCount(userId);
      return res.json({ notifications: notifs, unreadCount });
    } catch (error) {
      console.error("Get notifications error:", error);
      return res.status(500).json({ message: "Erro ao buscar notificações" });
    }
  });

  app.put("/api/notifications/:id/read", authMiddleware, async (req: Request, res: Response) => {
    try {
      await storage.markNotificationRead(req.params.id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Mark read error:", error);
      return res.status(500).json({ message: "Erro ao marcar notificação" });
    }
  });

  app.put("/api/notifications/read-all", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      await storage.markAllNotificationsRead(userId);
      return res.json({ success: true });
    } catch (error) {
      console.error("Mark all read error:", error);
      return res.status(500).json({ message: "Erro ao marcar notificações" });
    }
  });

  // ── Single Entry Detail ──

  app.get("/api/entries/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const entry = await storage.getDoctorEntry(id);
      if (!entry || entry.doctorId !== userId) {
        return res.status(404).json({ message: "Lançamento não encontrado" });
      }
      return res.json({ entry });
    } catch (error) {
      console.error("Get entry error:", error);
      return res.status(500).json({ message: "Erro ao buscar lançamento" });
    }
  });

  // ── PDF Reconciliation ──

  app.post("/api/reconciliation/upload-pdf", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { pdf } = req.body;
      if (!pdf) {
        return res.status(400).json({ message: "PDF não enviado" });
      }

      const base64Data = pdf.replace(/^data:[^;]+;base64,/, "");
      const pdfBuffer = Buffer.from(base64Data, "base64");

      const extractedData = await extractPdfData(pdfBuffer);

      for (const item of extractedData) {
        await storage.createClinicReport({
          doctorId: userId,
          patientName: item.patientName,
          procedureDate: new Date(item.procedureDate),
          reportedValue: item.reportedValue || "0.00",
          description: item.description || null,
          sourcePdfUrl: null,
        });
      }

      await runReconciliation(userId);

      const allEntries = await storage.getDoctorEntries(userId);
      const reconciled = allEntries.filter(e => e.status === "reconciled");
      const divergent = allEntries.filter(e => e.status === "divergent");
      const pending = allEntries.filter(e => e.status === "pending");

      return res.json({
        success: true,
        extractedCount: extractedData.length,
        reconciliation: { reconciled, divergent, pending },
      });
    } catch (error) {
      console.error("PDF reconciliation error:", error);
      return res.status(500).json({ message: "Erro ao processar PDF" });
    }
  });

  app.get("/api/reconciliation/results", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const allEntries = await storage.getDoctorEntries(userId);
      const reconciled = allEntries.filter(e => e.status === "reconciled");
      const divergent = allEntries.filter(e => e.status === "divergent");
      const pending = allEntries.filter(e => e.status === "pending");
      return res.json({ reconciled, divergent, pending });
    } catch (error) {
      console.error("Get reconciliation results error:", error);
      return res.status(500).json({ message: "Erro ao buscar resultados" });
    }
  });

  // ── Financial Projections ──

  app.get("/api/financials/projections", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const entries = await storage.getReconciledAndDivergentEntries(userId);
      const now = new Date();

      const calculate = (daysAhead: number) => {
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() + daysAhead);
        return entries
          .filter(e => {
            const d = new Date(e.procedureDate);
            return d >= now && d <= cutoff;
          })
          .reduce((sum, e) => sum + (e.procedureValue ? parseFloat(e.procedureValue) : 0), 0);
      };

      const allReconciledTotal = entries
        .filter(e => e.status === "reconciled")
        .reduce((sum, e) => sum + (e.procedureValue ? parseFloat(e.procedureValue) : 0), 0);

      const allDivergentTotal = entries
        .filter(e => e.status === "divergent")
        .reduce((sum, e) => sum + (e.procedureValue ? parseFloat(e.procedureValue) : 0), 0);

      return res.json({
        projections: {
          days30: calculate(30),
          days60: calculate(60),
          days90: calculate(90),
        },
        totals: {
          reconciled: allReconciledTotal,
          divergent: allDivergentTotal,
          total: allReconciledTotal + allDivergentTotal,
        },
        entryCount: entries.length,
      });
    } catch (error) {
      console.error("Projections error:", error);
      return res.status(500).json({ message: "Erro ao calcular projeções" });
    }
  });

  // ── Object Storage Routes ──
  registerObjectStorageRoutes(app);

  return httpServer;
}