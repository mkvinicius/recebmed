import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, loginSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { extractDataFromImage, extractDataFromAudio } from "./openai";

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

  app.post("/api/entries", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { patientName, procedureDate, insuranceProvider, description, entryMethod } = req.body;

      if (!patientName || !procedureDate || !insuranceProvider || !description) {
        return res.status(400).json({ message: "Todos os campos são obrigatórios" });
      }

      const entry = await storage.createDoctorEntry({
        doctorId: userId,
        patientName,
        procedureDate: new Date(procedureDate),
        insuranceProvider,
        description,
        entryMethod: entryMethod || "manual",
        sourceUrl: null,
        status: "pending",
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
          entryMethod: entryMethod || "manual",
          sourceUrl: null,
          status: "pending",
        });
        savedEntries.push(entry);
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

      const { patientName, procedureDate, insuranceProvider, description, status } = req.body;
      const updates: any = {};
      if (patientName !== undefined) updates.patientName = patientName;
      if (procedureDate !== undefined) updates.procedureDate = new Date(procedureDate);
      if (insuranceProvider !== undefined) updates.insuranceProvider = insuranceProvider;
      if (description !== undefined) updates.description = description;
      if (status !== undefined) updates.status = status;

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

  return httpServer;
}