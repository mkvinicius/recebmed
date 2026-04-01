import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { createHash, randomBytes } from "crypto";
import { storage } from "./storage";
import { insertUserSchema, loginSchema, passwordSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { extractDataFromImage, extractDataFromAudio, type CorrectionHint } from "./openai";
import { aiDuplicateCheck } from "./llm";

function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + "T12:00:00");
  }
  return new Date(dateStr);
}
import { extractPdfData, extractPdfDataWithTemplate, extractImageData, extractCsvData, extractCsvWithAI, generateCsvTemplate, runReconciliation } from "./reconciliation";
import { analyzeDocumentStructure, computeDocumentHash } from "./document-validator";
import { schedulePostUploadAudit, runAIAnomalyScan } from "./audit";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { JWT_SECRET } from "./jwt-secret";

function computeImageHash(base64: string): string {
  return createHash("sha256").update(base64).digest("hex");
}

const BCRYPT_ROUNDS = 12;

function generateToken(userId: string): string {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "7d" });
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { message: "Muitas tentativas de login. Sua conta foi temporariamente bloqueada por 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  skipSuccessfulRequests: true,
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { message: "Muitas solicitações de redefinição. Tente novamente em 1 hora." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

const bruteForceTracker = new Map<string, { count: number; blockedUntil: number }>();

function checkBruteForce(identifier: string): boolean {
  const now = Date.now();
  const entry = bruteForceTracker.get(identifier);
  if (entry && entry.blockedUntil > now) return true;
  return false;
}

function recordFailedLogin(identifier: string): void {
  const now = Date.now();
  const entry = bruteForceTracker.get(identifier) || { count: 0, blockedUntil: 0 };
  if (entry.blockedUntil > now) return;
  entry.count++;
  if (entry.count >= 5) {
    entry.blockedUntil = now + 30 * 60 * 1000;
    entry.count = 0;
  }
  bruteForceTracker.set(identifier, entry);
}

function clearFailedLogin(identifier: string): void {
  bruteForceTracker.delete(identifier);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of bruteForceTracker) {
    if (entry.blockedUntil > 0 && entry.blockedUntil < now) bruteForceTracker.delete(key);
  }
}, 5 * 60 * 1000);

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  keyGenerator: (req: Request) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
        return `user:${decoded.id}`;
      } catch {}
    }
    const forwarded = req.headers["x-forwarded-for"];
    const clientIp = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : (req.socket.remoteAddress || "unknown");
    return "ip:" + clientIp;
  },
  message: { message: "Limite de requisições atingido. Aguarde alguns segundos e tente novamente." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, ip: false, trustProxy: false },
});

interface ResetCodeEntry {
  code: string;
  hashedCode: string;
  email: string;
  expiresAt: number;
  attempts: number;
}
const resetCodes = new Map<string, ResetCodeEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of resetCodes) {
    if (entry.expiresAt < now) resetCodes.delete(key);
  }
}, 60_000);

function generateResetCode(): string {
  const bytes = randomBytes(3);
  const num = (bytes[0] * 65536 + bytes[1] * 256 + bytes[2]) % 1000000;
  return num.toString().padStart(6, "0");
}

async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token não fornecido" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const user = await storage.getUser(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "Usuário não encontrado" });
    }
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

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://fonts.googleapis.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        mediaSrc: ["'self'", "blob:", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    noSniff: true,
    xssFilter: true,
  }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(), payment=()");
    next();
  });

  app.use("/api", apiLimiter);

  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === "object") {
      const dangerousPatterns = /<script[\s>]/i;
      const checkValue = (val: unknown): boolean => {
        if (typeof val === "string" && dangerousPatterns.test(val)) return true;
        if (Array.isArray(val)) return val.some(checkValue);
        if (val && typeof val === "object") return Object.values(val).some(checkValue);
        return false;
      };
      const keysToCheck = ["patientName", "description", "insuranceProvider", "name", "email", "title", "message"];
      for (const key of keysToCheck) {
        if (key in req.body && checkValue(req.body[key])) {
          return res.status(400).json({ message: "Conteúdo inválido detectado" });
        }
      }
    }
    next();
  });

  // ── Auth ──

  app.post("/api/auth/register", authLimiter, async (req: Request, res: Response) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors;
        if (fieldErrors.password && fieldErrors.password.length > 0) {
          return res.status(400).json({ message: fieldErrors.password[0], field: "password" });
        }
        return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
      }
      const { name, email, password } = parsed.data;
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "Este email já está cadastrado" });
      }
      const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
      const hashedPassword = await bcrypt.hash(password, salt);
      const user = await storage.createUser({ name, email, password: hashedPassword });
      const token = generateToken(user.id);
      return res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, profilePhotoUrl: user.profilePhotoUrl } });
    } catch (error) {
      console.error("Register error:", error);
      return res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
      }
      const { email, password } = parsed.data;
      const normalizedEmail = email.toLowerCase().trim();

      if (checkBruteForce(normalizedEmail)) {
        return res.status(429).json({ message: "Conta temporariamente bloqueada por muitas tentativas. Tente novamente em 30 minutos." });
      }

      const user = await storage.getUserByEmail(normalizedEmail);
      if (!user) {
        recordFailedLogin(normalizedEmail);
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        recordFailedLogin(normalizedEmail);
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }
      clearFailedLogin(normalizedEmail);
      const token = generateToken(user.id);
      const pwStrong = passwordSchema.safeParse(password);
      const requiresPasswordUpdate = !pwStrong.success;
      return res.json({ token, user: { id: user.id, name: user.name, email: user.email, profilePhotoUrl: user.profilePhotoUrl }, requiresPasswordUpdate });
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
      return res.json({ user: { id: user.id, name: user.name, email: user.email, profilePhotoUrl: user.profilePhotoUrl } });
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
      return res.json({ user: { id: updated.id, name: updated.name, email: updated.email, profilePhotoUrl: updated.profilePhotoUrl } });
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
      const pwResult = passwordSchema.safeParse(newPassword);
      if (!pwResult.success) {
        return res.status(400).json({ message: pwResult.error.errors[0].message, field: "password" });
      }
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) return res.status(401).json({ message: "Senha atual incorreta" });
      const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
      const hashed = await bcrypt.hash(newPassword, salt);
      await storage.updateUserPassword(userId, hashed);
      return res.json({ success: true, message: "Senha alterada com sucesso" });
    } catch (error) {
      console.error("Change password error:", error);
      return res.status(500).json({ message: "Erro ao alterar senha" });
    }
  });

  app.post("/api/auth/request-reset", resetLimiter, async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email é obrigatório" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.json({ success: true, message: "Se o email existir, um código será enviado." });
      }
      const code = generateResetCode();
      const hashedCode = createHash("sha256").update(code).digest("hex");
      resetCodes.set(email.toLowerCase(), {
        code,
        hashedCode,
        email: email.toLowerCase(),
        expiresAt: Date.now() + 15 * 60 * 1000,
        attempts: 0,
      });
      console.log(`[SECURITY] Reset code generated for ${email}`);
      return res.json({ success: true, message: "Código de verificação enviado." });
    } catch (error) {
      console.error("Request reset error:", error);
      return res.status(500).json({ message: "Erro ao solicitar redefinição" });
    }
  });

  app.post("/api/auth/verify-reset", resetLimiter, async (req: Request, res: Response) => {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) {
        return res.status(400).json({ message: "Email, código e nova senha são obrigatórios" });
      }
      const entry = resetCodes.get(email.toLowerCase());
      if (!entry) {
        return res.status(400).json({ message: "Nenhum código de verificação encontrado. Solicite um novo." });
      }
      if (entry.expiresAt < Date.now()) {
        resetCodes.delete(email.toLowerCase());
        return res.status(400).json({ message: "Código expirado. Solicite um novo." });
      }
      entry.attempts += 1;
      if (entry.attempts > 5) {
        resetCodes.delete(email.toLowerCase());
        return res.status(429).json({ message: "Muitas tentativas. Solicite um novo código." });
      }
      const hashedInput = createHash("sha256").update(code).digest("hex");
      if (hashedInput !== entry.hashedCode) {
        return res.status(400).json({ message: `Código incorreto. ${5 - entry.attempts} tentativa(s) restante(s).` });
      }
      const pwResult = passwordSchema.safeParse(newPassword);
      if (!pwResult.success) {
        return res.status(400).json({ message: pwResult.error.errors[0].message, field: "password" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        resetCodes.delete(email.toLowerCase());
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
      const hashed = await bcrypt.hash(newPassword, salt);
      await storage.updateUserPassword(user.id, hashed);
      resetCodes.delete(email.toLowerCase());
      return res.json({ success: true, message: "Senha redefinida com sucesso" });
    } catch (error) {
      console.error("Verify reset error:", error);
      return res.status(500).json({ message: "Erro ao redefinir senha" });
    }
  });

  app.put("/api/auth/profile-photo", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { profilePhotoUrl } = req.body;
      const user = await storage.updateUserProfilePhoto(userId, profilePhotoUrl || null);
      if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
      return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, profilePhotoUrl: user.profilePhotoUrl } });
    } catch (error) {
      console.error("Update profile photo error:", error);
      return res.status(500).json({ message: "Erro ao atualizar foto" });
    }
  });

  app.get("/api/auth/ai-audit", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const enabled = await storage.isAiAuditEnabled(userId);
      return res.json({ aiAuditEnabled: enabled });
    } catch (error) {
      console.error("Get AI audit status error:", error);
      return res.status(500).json({ message: "Erro ao buscar configuração" });
    }
  });

  app.put("/api/auth/ai-audit", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ message: "Campo 'enabled' obrigatório" });
      }
      const user = await storage.updateUserAiAudit(userId, enabled);
      if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
      return res.json({ aiAuditEnabled: user.aiAuditEnabled });
    } catch (error) {
      console.error("Update AI audit error:", error);
      return res.status(500).json({ message: "Erro ao atualizar configuração" });
    }
  });

  // ── AI Audit Findings ──

  app.get("/api/audit-findings", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const category = req.query.category as string | undefined;
      const findings = await storage.getAiAuditFindings(userId, category);
      return res.json(findings);
    } catch (error) {
      console.error("Get audit findings error:", error);
      return res.status(500).json({ message: "Erro ao buscar achados" });
    }
  });

  app.get("/api/audit-findings/summary", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const findings = await storage.getAiAuditFindings(userId);
      const summary = {
        duplicate: { total: 0, unresolved: 0 },
        value_outlier: { total: 0, unresolved: 0 },
        missing_data: { total: 0, unresolved: 0 },
        suspicious_pattern: { total: 0, unresolved: 0 },
      } as Record<string, { total: number; unresolved: number }>;
      for (const f of findings) {
        if (!summary[f.category]) summary[f.category] = { total: 0, unresolved: 0 };
        summary[f.category].total++;
        if (!f.resolved) summary[f.category].unresolved++;
      }
      return res.json(summary);
    } catch (error) {
      console.error("Get audit summary error:", error);
      return res.status(500).json({ message: "Erro ao buscar resumo" });
    }
  });

  app.put("/api/audit-findings/:id/resolve", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const ok = await storage.resolveAiAuditFinding(req.params.id, userId);
      if (!ok) return res.status(404).json({ message: "Achado não encontrado" });
      return res.json({ success: true });
    } catch (error) {
      console.error("Resolve finding error:", error);
      return res.status(500).json({ message: "Erro ao resolver achado" });
    }
  });

  // ── Platform Doctrine (admin only) ──

  app.get("/api/auth/platform-doctrine", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Acesso negado" });
      return res.json({ doctrine: user.platformDoctrine || "" });
    } catch (error) {
      console.error("Get doctrine error:", error);
      return res.status(500).json({ message: "Erro ao buscar doutrina" });
    }
  });

  app.put("/api/auth/platform-doctrine", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) return res.status(403).json({ message: "Acesso negado" });
      const { doctrine } = req.body;
      if (typeof doctrine !== "string") return res.status(400).json({ message: "Campo 'doctrine' obrigatório" });
      if (doctrine.length > 5000) return res.status(400).json({ message: "Doutrina muito longa (máx 5000 caracteres)" });
      const updated = await storage.updatePlatformDoctrine(userId, doctrine);
      if (!updated) return res.status(404).json({ message: "Usuário não encontrado" });
      return res.json({ doctrine: updated.platformDoctrine || "" });
    } catch (error) {
      console.error("Update doctrine error:", error);
      return res.status(500).json({ message: "Erro ao atualizar doutrina" });
    }
  });

  app.get("/api/auth/is-admin", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const user = await storage.getUser(userId);
      return res.json({ isAdmin: user?.isAdmin ?? false });
    } catch (error) {
      return res.status(500).json({ message: "Erro" });
    }
  });

  // ── AI Extraction ──

  async function getCorrectionHints(doctorId: string): Promise<CorrectionHint[]> {
    const corrections = await storage.getRecentAiCorrections(doctorId, 30);
    return corrections.map(c => ({ field: c.field, originalValue: c.originalValue, correctedValue: c.correctedValue }));
  }

  function detectCorrections(original: Record<string, string>, corrected: Record<string, string>, entryMethod: string, doctorId: string) {
    const fields = ["patientName", "procedureDate", "insuranceProvider", "description", "procedureValue"];
    const diffs: Array<{ doctorId: string; field: string; originalValue: string; correctedValue: string; entryMethod: string }> = [];
    for (const field of fields) {
      const origVal = (original[field] || "").trim();
      const corrVal = (corrected[field] || "").trim();
      if (origVal && corrVal && origVal !== corrVal) {
        diffs.push({ doctorId, field, originalValue: origVal, correctedValue: corrVal, entryMethod });
      }
    }
    return diffs;
  }

  const mediaStorage = new ObjectStorageService();

  app.post("/api/entries/photo", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { image, skipDuplicateCheck } = req.body;
      if (!image) {
        return res.status(400).json({ message: "Imagem não enviada" });
      }
      const userId = (req as any).userId;
      const base64 = image.replace(/^data:image\/\w+;base64,/, "");
      const imageHash = computeImageHash(base64);

      if (!skipDuplicateCheck) {
        const hashDuplicates = await storage.findByImageHash(userId, imageHash);
        if (hashDuplicates.length > 0) {
          return res.json({
            success: true,
            duplicateWarning: {
              type: "exact_image",
              existingEntries: hashDuplicates.map(e => ({
                id: e.id,
                patientName: e.patientName,
                procedureDate: e.procedureDate,
                description: e.description,
                procedureValue: e.procedureValue,
                createdAt: e.createdAt,
              })),
            },
          });
        }
      }

      const corrections = await getCorrectionHints(userId);
      const [extractedData, sourceUrl] = await Promise.all([
        extractDataFromImage(base64, corrections),
        mediaStorage.uploadBuffer(Buffer.from(base64, "base64"), "image/jpeg").catch(err => { console.error("Media upload error:", err); return null; }),
      ]);
      return res.json({ success: true, extractedData, sourceUrl, imageHash });
    } catch (error) {
      console.error("Photo entry error:", error);
      return res.status(500).json({ message: "Erro ao processar imagem" });
    }
  });

  app.post("/api/entries/photos-batch", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { images, skipDuplicateCheck } = req.body;
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ message: "Nenhuma imagem enviada" });
      }
      if (images.length > 50) {
        return res.status(400).json({ message: "Máximo de 50 imagens por vez" });
      }
      const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
      for (let i = 0; i < images.length; i++) {
        const raw = images[i].replace(/^data:image\/\w+;base64,/, "");
        const decodedSize = Math.ceil(raw.length * 3 / 4);
        if (decodedSize > MAX_IMAGE_BYTES) {
          return res.status(400).json({ message: `Imagem ${i + 1} excede o limite de 10MB` });
        }
      }
      const userId = (req as any).userId;
      const corrections = await getCorrectionHints(userId);

      const duplicateHashes: Array<{ imageIndex: number; existingEntries: any[] }> = [];
      const imagesToProcess: Array<{ base64: string; index: number; hash: string }> = [];

      for (let i = 0; i < images.length; i++) {
        const base64 = images[i].replace(/^data:image\/\w+;base64,/, "");
        const hash = computeImageHash(base64);
        if (!skipDuplicateCheck) {
          const hashDups = await storage.findByImageHash(userId, hash);
          if (hashDups.length > 0) {
            duplicateHashes.push({
              imageIndex: i,
              existingEntries: hashDups.map(e => ({
                id: e.id, patientName: e.patientName, procedureDate: e.procedureDate,
                description: e.description, procedureValue: e.procedureValue, createdAt: e.createdAt,
              })),
            });
            continue;
          }
        }
        imagesToProcess.push({ base64, index: i, hash });
      }

      if (duplicateHashes.length > 0 && imagesToProcess.length === 0) {
        return res.json({ success: true, duplicateWarning: { type: "exact_image_batch", duplicates: duplicateHashes } });
      }

      const CHUNK_SIZE = 3;
      const allEntries: any[] = [];
      for (let c = 0; c < imagesToProcess.length; c += CHUNK_SIZE) {
        const chunk = imagesToProcess.slice(c, c + CHUNK_SIZE);
        const chunkResults = await Promise.all(
          chunk.map(async ({ base64, index, hash }) => {
            try {
              const [entries, sourceUrl] = await Promise.all([
                extractDataFromImage(base64, corrections),
                mediaStorage.uploadBuffer(Buffer.from(base64, "base64"), "image/jpeg").catch(() => null),
              ]);
              return entries.map(e => ({ ...e, _sourceImage: index + 1, sourceUrl, _imageHash: hash }));
            } catch (err) {
              console.error(`Error processing image ${index + 1}:`, err);
              return [];
            }
          })
        );
        allEntries.push(...chunkResults.flat());
      }

      return res.json({
        success: true, extractedData: allEntries, totalImages: images.length, totalEntries: allEntries.length,
        ...(duplicateHashes.length > 0 ? { skippedDuplicates: duplicateHashes.length } : {}),
      });
    } catch (error) {
      console.error("Batch photo error:", error);
      return res.status(500).json({ message: "Erro ao processar imagens em lote" });
    }
  });

  app.post("/api/entries/audio", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { audio } = req.body;
      if (!audio) {
        return res.status(400).json({ message: "Áudio não enviado" });
      }
      const userId = (req as any).userId;
      const corrections = await getCorrectionHints(userId);
      const base64 = audio.replace(/^data:[^;]+;base64,/, "");
      const [extractedData, sourceUrl] = await Promise.all([
        extractDataFromAudio(base64, corrections),
        mediaStorage.uploadBuffer(Buffer.from(base64, "base64"), "audio/wav").catch(err => { console.error("Media upload error:", err); return null; }),
      ]);
      return res.json({ success: true, extractedData, sourceUrl });
    } catch (error) {
      console.error("Audio entry error:", error);
      return res.status(500).json({ message: "Erro ao processar áudio" });
    }
  });

  // ── Entries CRUD ──

  app.post("/api/entries", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { patientName, patientBirthDate, procedureDate, procedureName, insuranceProvider, description, entryMethod, procedureValue, _originalData, _imageHash, skipDuplicateCheck } = req.body;

      if (!patientName || !procedureDate || !insuranceProvider) {
        return res.status(400).json({ message: "Nome, data e convênio são obrigatórios" });
      }

      if (!skipDuplicateCheck) {
        const dataDups = await storage.findDuplicatesByData(userId, patientName, parseLocalDate(procedureDate), description, insuranceProvider);
        if (dataDups.length > 0) {
          return res.status(409).json({
            message: "duplicate_data",
            duplicateWarning: {
              type: "similar_data",
              existingEntries: dataDups.map(e => ({
                id: e.id, patientName: e.patientName, procedureDate: e.procedureDate,
                description: e.description, procedureValue: e.procedureValue, createdAt: e.createdAt,
              })),
            },
          });
        }

        const similarEntries = await storage.findSimilarEntriesForAI(userId, parseLocalDate(procedureDate), patientName);
        if (similarEntries.length > 0) {
          try {
            const aiResult = await aiDuplicateCheck(
              { patientName, procedureDate, description: description || null, insuranceProvider, procedureValue: procedureValue || null },
              similarEntries.map(e => ({
                id: e.id, patientName: e.patientName,
                procedureDate: e.procedureDate instanceof Date ? e.procedureDate.toISOString().split("T")[0] : String(e.procedureDate),
                description: e.description, insuranceProvider: e.insuranceProvider,
                procedureValue: e.procedureValue,
              }))
            );
            if (aiResult.isDuplicate) {
              console.log(`[AI-Dedup] Duplicata detectada: ${patientName} - ${description} (confiança: ${aiResult.confidence}, motivo: ${aiResult.reason})`);
              return res.status(409).json({
                message: "duplicate_data",
                duplicateWarning: {
                  type: "ai_detected",
                  reason: aiResult.reason,
                  confidence: aiResult.confidence,
                  existingEntries: similarEntries
                    .filter(e => e.id === aiResult.matchedEntryId)
                    .map(e => ({
                      id: e.id, patientName: e.patientName, procedureDate: e.procedureDate,
                      description: e.description, procedureValue: e.procedureValue, createdAt: e.createdAt,
                    })),
                },
              });
            }
          } catch (aiErr) {
            console.warn("[AI-Dedup] Falha na validação por IA, permitindo entrada:", aiErr);
          }
        }
      }

      const entry = await storage.createDoctorEntry({
        doctorId: userId,
        patientName,
        patientBirthDate: patientBirthDate || null,
        procedureDate: parseLocalDate(procedureDate),
        procedureName: procedureName || null,
        insuranceProvider,
        description,
        procedureValue: procedureValue || null,
        entryMethod: entryMethod || "manual",
        sourceUrl: req.body.sourceUrl || null,
        imageHash: _imageHash || null,
        status: "pending",
      });

      if (_originalData && entryMethod && entryMethod !== "manual") {
        const diffs = detectCorrections(_originalData, { patientName, procedureDate, insuranceProvider, description, procedureValue: procedureValue || "" }, entryMethod, userId);
        if (diffs.length > 0) {
          await storage.createAiCorrections(diffs.map(d => ({ doctorId: d.doctorId, field: d.field, originalValue: d.originalValue, correctedValue: d.correctedValue, entryMethod: d.entryMethod as any })));
        }
      }

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
      if (entriesData.length > 60) {
        return res.status(400).json({ message: "Máximo de 60 lançamentos por vez" });
      }

      const validEntries = entriesData.filter((item: any) =>
        item.patientName && item.procedureDate && item.insuranceProvider
      );

      if (validEntries.length === 0) {
        return res.status(400).json({ message: "Nenhum lançamento válido encontrado" });
      }

      const savedEntries = [];
      const skippedDuplicates: string[] = [];
      const allDiffs: Array<{ doctorId: string; field: string; originalValue: string; correctedValue: string; entryMethod: string }> = [];

      const normalizeForDedup = (name: string) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
      const seenInBatch = new Set<string>();
      const deduped = validEntries.filter((item: any) => {
        const key = `${normalizeForDedup(item.patientName)}|${item.procedureDate}|${(item.description || "").toLowerCase().trim()}|${(item.insuranceProvider || "").toLowerCase().trim()}`;
        if (seenInBatch.has(key)) {
          console.log(`[Batch] Duplicata intra-lote ignorada: ${item.patientName}`);
          skippedDuplicates.push(item.patientName);
          return false;
        }
        seenInBatch.add(key);
        return true;
      });

      for (const item of deduped) {
        try {
          const dups = await storage.findDuplicatesByData(
            userId, item.patientName, parseLocalDate(item.procedureDate),
            item.description || null, item.insuranceProvider
          );
          if (dups.length > 0) {
            console.log(`[Batch] Duplicata exata no banco ignorada: ${item.patientName} - ${item.description || "sem proc"} - ${item.procedureDate}`);
            skippedDuplicates.push(item.patientName);
            continue;
          }

          const similarEntries = await storage.findSimilarEntriesForAI(userId, parseLocalDate(item.procedureDate), item.patientName);
          if (similarEntries.length > 0) {
            try {
              const aiResult = await aiDuplicateCheck(
                { patientName: item.patientName, procedureDate: item.procedureDate, description: item.description || null, insuranceProvider: item.insuranceProvider, procedureValue: item.procedureValue || null },
                similarEntries.map(e => ({
                  id: e.id, patientName: e.patientName,
                  procedureDate: e.procedureDate instanceof Date ? e.procedureDate.toISOString().split("T")[0] : String(e.procedureDate),
                  description: e.description, insuranceProvider: e.insuranceProvider,
                  procedureValue: e.procedureValue,
                }))
              );
              if (aiResult.isDuplicate) {
                console.log(`[Batch AI-Dedup] Duplicata detectada: ${item.patientName} - ${item.description || "sem proc"} (${aiResult.reason})`);
                skippedDuplicates.push(item.patientName);
                continue;
              }
            } catch (aiErr) {
              console.warn("[Batch AI-Dedup] Falha na validação, permitindo entrada:", aiErr);
            }
          }

          const entry = await storage.createDoctorEntry({
            doctorId: userId,
            patientName: item.patientName,
            patientBirthDate: item.patientBirthDate || null,
            procedureDate: parseLocalDate(item.procedureDate),
            procedureName: item.procedureName || null,
            insuranceProvider: item.insuranceProvider,
            description: item.description,
            procedureValue: item.procedureValue || null,
            entryMethod: entryMethod || "manual",
            sourceUrl: item.sourceUrl || null,
            imageHash: item._imageHash || null,
            status: "pending",
          });
          if (item._originalData && entryMethod && entryMethod !== "manual") {
            const diffs = detectCorrections(item._originalData, { patientName: item.patientName, procedureDate: item.procedureDate, insuranceProvider: item.insuranceProvider, description: item.description, procedureValue: item.procedureValue || "" }, entryMethod, userId);
            allDiffs.push(...diffs);
          }
          savedEntries.push(entry);
        } catch (err) {
          console.error("Error saving entry in batch:", err);
        }
      }

      if (allDiffs.length > 0) {
        try {
          await storage.createAiCorrections(allDiffs.map(d => ({ doctorId: d.doctorId, field: d.field, originalValue: d.originalValue, correctedValue: d.correctedValue, entryMethod: d.entryMethod as any })));
        } catch (err) {
          console.error("Error saving AI corrections:", err);
        }
      }

      if (savedEntries.length > 0) {
        const dupMsg = skippedDuplicates.length > 0 ? ` (${skippedDuplicates.length} duplicata(s) ignorada(s))` : "";
        await storage.createNotification({
          doctorId: userId,
          type: "batch_created",
          title: "Lançamentos em lote",
          message: `${savedEntries.length} lançamentos registrados com sucesso${dupMsg}`,
          read: false,
        });
      } else if (skippedDuplicates.length > 0) {
        await storage.createNotification({
          doctorId: userId,
          type: "batch_created",
          title: "Lançamentos duplicados",
          message: `${skippedDuplicates.length} lançamento(s) já existente(s) — nenhum novo registro criado`,
          read: false,
        });
      }

      return res.status(201).json({
        entries: savedEntries,
        count: savedEntries.length,
        ...(skippedDuplicates.length > 0 ? { skippedDuplicates: skippedDuplicates.length, skippedNames: skippedDuplicates } : {}),
      });
    } catch (error) {
      console.error("Batch create error:", error);
      return res.status(500).json({ message: "Erro ao salvar lançamentos" });
    }
  });

  app.get("/api/ai-corrections/stats", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const corrections = await storage.getRecentAiCorrections(userId, 100);
      const totalCorrections = corrections.length;
      const fieldCounts: Record<string, number> = {};
      for (const c of corrections) {
        fieldCounts[c.field] = (fieldCounts[c.field] || 0) + 1;
      }
      return res.json({ totalCorrections, fieldCounts, recentCorrections: corrections.slice(0, 10) });
    } catch (error) {
      console.error("AI corrections stats error:", error);
      return res.status(500).json({ message: "Erro ao buscar estatísticas" });
    }
  });

  app.get("/api/patients/names", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const q = (req.query.q as string || "").trim();
      const names = await storage.getDistinctPatientNames(userId, q || undefined);
      return res.json({ names });
    } catch (error) {
      console.error("Patient names error:", error);
      return res.status(500).json({ message: "Erro ao buscar pacientes" });
    }
  });

  app.get("/api/entries/search", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const q = (req.query.q as string || "").trim();
      if (!q || q.length < 2) {
        return res.json({ entries: [] });
      }
      const entries = await storage.searchDoctorEntries(userId, q);
      return res.json({ entries, query: q });
    } catch (error) {
      console.error("Search entries error:", error);
      return res.status(500).json({ message: "Erro ao buscar lançamentos" });
    }
  });

  app.get("/api/entries", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
      const status = req.query.status as string | undefined;
      const search = req.query.search as string | undefined;
      const insuranceProvider = req.query.insuranceProvider as string | undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;

      const hasFilters = req.query.page !== undefined || req.query.limit !== undefined ||
        status || search || insuranceProvider || dateFrom || dateTo;

      if (hasFilters) {
        const result = await storage.getDoctorEntriesPaginated(userId, {
          page, limit, status, search, insuranceProvider, dateFrom, dateTo,
        });
        return res.json(result);
      }

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
      if (procedureDate !== undefined) updates.procedureDate = parseLocalDate(procedureDate);
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
      await storage.deleteDoctorEntry(id, userId);
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
      const { patientName, patientBirthDate, procedureDate, procedureName, insuranceProvider, reportedValue, description } = req.body;
      if (!patientName || !procedureDate || !reportedValue) {
        return res.status(400).json({ message: "Nome do paciente, data e valor são obrigatórios" });
      }
      const report = await storage.createClinicReport({
        doctorId: userId,
        patientName,
        patientBirthDate: patientBirthDate || null,
        procedureDate: parseLocalDate(procedureDate),
        procedureName: procedureName || null,
        insuranceProvider: insuranceProvider || null,
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

  app.get("/api/clinic-reports/unmatched", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const reports = await storage.getUnmatchedClinicReports(userId);
      return res.json({ reports });
    } catch (error) {
      console.error("Get unmatched clinic reports error:", error);
      return res.status(500).json({ message: "Erro ao buscar registros não conferidos" });
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
      await storage.deleteClinicReport(id, userId);
      return res.json({ success: true });
    } catch (error) {
      console.error("Delete clinic report error:", error);
      return res.status(500).json({ message: "Erro ao excluir relatório" });
    }
  });

  app.post("/api/entries/accept-clinic-report", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { reportId } = req.body;
      if (!reportId) {
        return res.status(400).json({ message: "ID do relatório é obrigatório" });
      }
      const report = await storage.getClinicReport(reportId);
      if (!report || report.doctorId !== userId) {
        return res.status(404).json({ message: "Relatório não encontrado" });
      }
      if (report.matched) {
        return res.status(400).json({ message: "Este registro já foi conferido" });
      }

      const newEntry = await storage.createDoctorEntry({
        doctorId: userId,
        patientName: report.patientName,
        patientBirthDate: report.patientBirthDate || null,
        procedureDate: report.procedureDate,
        procedureName: report.procedureName || null,
        insuranceProvider: report.insuranceProvider || "Particular",
        description: report.description || report.procedureName || "Aceito do extrato da clínica",
        procedureValue: report.reportedValue,
        entryMethod: "manual",
        sourceUrl: null,
        imageHash: null,
        matchedReportId: report.id,
        divergenceReason: null,
        status: "reconciled",
      });

      await storage.markClinicReportMatched(report.id, newEntry.id);

      return res.json({ success: true, entry: newEntry });
    } catch (error) {
      console.error("Accept clinic report error:", error);
      return res.status(500).json({ message: "Erro ao aceitar registro da clínica" });
    }
  });

  app.post("/api/entries/accept-clinic-reports-batch", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { reportIds } = req.body;
      if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
        return res.status(400).json({ message: "IDs dos relatórios são obrigatórios" });
      }

      let accepted = 0;
      const acceptedIds: string[] = [];
      for (const reportId of reportIds) {
        const report = await storage.getClinicReport(reportId);
        if (!report || report.doctorId !== userId || report.matched) continue;

        const newEntry = await storage.createDoctorEntry({
          doctorId: userId,
          patientName: report.patientName,
          patientBirthDate: report.patientBirthDate || null,
          procedureDate: report.procedureDate,
          procedureName: report.procedureName || null,
          insuranceProvider: report.insuranceProvider || "Particular",
          description: report.description || report.procedureName || "Aceito do extrato da clínica",
          procedureValue: report.reportedValue,
          entryMethod: "manual",
          sourceUrl: null,
          imageHash: null,
          matchedReportId: report.id,
          divergenceReason: null,
          status: "reconciled",
        });

        await storage.markClinicReportMatched(report.id, newEntry.id);
        accepted++;
        acceptedIds.push(reportId);
      }

      return res.json({ success: true, accepted, acceptedIds });
    } catch (error) {
      console.error("Accept clinic reports batch error:", error);
      return res.status(500).json({ message: "Erro ao aceitar registros da clínica" });
    }
  });

  app.put("/api/entries/:id/validate", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const entry = await storage.getDoctorEntry(id);
      if (!entry || entry.doctorId !== userId) {
        return res.status(404).json({ message: "Lançamento não encontrado" });
      }
      const updated = await storage.updateDoctorEntry(id, { status: "validated" } as any);
      return res.json({ success: true, entry: updated });
    } catch (error) {
      console.error("Validate entry error:", error);
      return res.status(500).json({ message: "Erro ao validar lançamento" });
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

  // ── AI Anomaly Scan ──

  app.post("/api/ai/anomaly-scan", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const result = await runAIAnomalyScan(userId);
      return res.json({ success: true, ...result });
    } catch (error) {
      console.error("AI anomaly scan error:", error);
      return res.status(500).json({ message: "Erro ao executar varredura inteligente" });
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

  app.get("/api/entries/:id/divergence", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const entry = await storage.getDoctorEntry(id);
      if (!entry || entry.doctorId !== userId) {
        return res.status(404).json({ message: "Lançamento não encontrado" });
      }
      let clinicReport = null;
      if (entry.matchedReportId) {
        clinicReport = await storage.getClinicReport(entry.matchedReportId);
      }
      return res.json({
        entry,
        clinicReport: clinicReport || null,
        divergenceReason: entry.divergenceReason || null,
      });
    } catch (error) {
      console.error("Get divergence details error:", error);
      return res.status(500).json({ message: "Erro ao buscar detalhes da divergência" });
    }
  });

  // ── Re-Reconciliation (reset divergent/pending and re-run) ──

  app.post("/api/reconciliation/re-reconcile", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const resetCount = await storage.resetDivergentAndPendingEntries(userId);
      console.log(`[Re-reconcile] Reset ${resetCount} entries for user ${userId}`);

      if (resetCount > 0) {
        await runReconciliation(userId);
      }

      const allEntries = await storage.getDoctorEntries(userId);
      const unmatchedReports = await storage.getUnmatchedClinicReports(userId);
      return res.json({
        success: true,
        resetCount,
        reconciliation: {
          reconciled: allEntries.filter(e => e.status === "reconciled" || e.status === "validated"),
          divergent: allEntries.filter(e => e.status === "divergent"),
          pending: allEntries.filter(e => e.status === "pending"),
          unmatchedClinic: unmatchedReports,
        },
      });
    } catch (error) {
      console.error("Re-reconciliation error:", error);
      return res.status(500).json({ message: "Erro ao re-processar conferência" });
    }
  });

  // ── File Reconciliation (PDF, Image, CSV) ──

  app.post("/api/reconciliation/upload-pdf", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { pdf } = req.body;
      if (!pdf) return res.status(400).json({ message: "PDF não enviado" });
      const base64Data = pdf.replace(/^data:[^;]+;base64,/, "");
      const pdfBuffer = Buffer.from(base64Data, "base64");
      const [extractedData, originalFileUrl] = await Promise.all([
        extractPdfData(pdfBuffer),
        mediaStorage.uploadBuffer(pdfBuffer, "application/pdf").catch(err => { console.error("Report upload error:", err); return null; }),
      ]);
      for (const item of extractedData) {
        await storage.createClinicReport({ doctorId: userId, patientName: item.patientName, procedureDate: parseLocalDate(item.procedureDate), reportedValue: item.reportedValue || "0.00", description: item.description || null, sourcePdfUrl: null });
      }
      if (originalFileUrl) {
        await storage.createUploadedReport({ userId, fileName: "relatorio.pdf", originalFileUrl, extractedRecordCount: extractedData.length });
      }
      await runReconciliation(userId);
      schedulePostUploadAudit(userId);
      const allEntries = await storage.getDoctorEntries(userId);
      const unmatchedReports = await storage.getUnmatchedClinicReports(userId);
      return res.json({ success: true, extractedCount: extractedData.length, reconciliation: { reconciled: allEntries.filter(e => e.status === "reconciled" || e.status === "validated"), divergent: allEntries.filter(e => e.status === "divergent"), pending: allEntries.filter(e => e.status === "pending"), unmatchedClinic: unmatchedReports } });
    } catch (error) {
      console.error("PDF reconciliation error:", error);
      return res.status(500).json({ message: "Erro ao processar PDF" });
    }
  });

  app.post("/api/reconciliation/upload", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { file, fileType, fileName, templateId } = req.body;
      if (!file || !fileType) return res.status(400).json({ message: "Arquivo não enviado" });

      const base64Data = file.replace(/^data:[^;]+;base64,/, "");
      let extractedData: import("./reconciliation").PdfExtractedEntry[] = [];

      let templateMapping: string | null = null;
      if (templateId) {
        const template = await storage.getDocumentTemplate(templateId);
        if (template && template.userId === userId) {
          templateMapping = template.mappingJson;
        }
      }

      if (fileType === "pdf") {
        const pdfBuffer = Buffer.from(base64Data, "base64");
        extractedData = templateMapping
          ? await extractPdfDataWithTemplate(pdfBuffer, templateMapping)
          : await extractPdfData(pdfBuffer);
      } else if (fileType === "image") {
        extractedData = await extractImageData(file);
      } else if (fileType === "csv") {
        const csvText = Buffer.from(base64Data, "base64").toString("utf-8");
        extractedData = extractCsvData(csvText);
        if (extractedData.length === 0) {
          console.log("CSV local parsing returned 0 results, trying AI fallback...");
          extractedData = await extractCsvWithAI(csvText);
        }
      } else {
        return res.status(400).json({ message: "Formato não suportado" });
      }

      if (extractedData.length === 0) {
        return res.status(400).json({ message: "Nenhum registro encontrado no arquivo. Verifique se o arquivo contém dados de pacientes e procedimentos." });
      }

      const normalizeForDedup = (name: string) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
      const seenInFile = new Set<string>();
      const dedupedData = extractedData.filter((item: any) => {
        if (!item.patientName || item.patientName.length < 2) return false;
        const key = `${normalizeForDedup(item.patientName)}|${item.procedureDate}|${(item.description || "").toLowerCase().trim()}|${(item.insuranceProvider || "").toLowerCase().trim()}`;
        if (seenInFile.has(key)) {
          console.log(`[Reconciliation] Duplicata intra-arquivo ignorada: ${item.patientName}`);
          return false;
        }
        seenInFile.add(key);
        return true;
      });

      const mimeMap: Record<string, string> = { pdf: "application/pdf", image: "image/jpeg", csv: "text/csv" };
      const originalFileUrl = await mediaStorage.uploadBuffer(Buffer.from(base64Data, "base64"), mimeMap[fileType] || "application/octet-stream").catch(err => { console.error("Report upload error:", err); return null; });

      let savedCount = 0;
      let skipCount = 0;
      for (const item of dedupedData) {
        try {
          const procDate = parseLocalDate(item.procedureDate);
          if (isNaN(procDate.getTime())) { skipCount++; continue; }
          await storage.createClinicReport({
            doctorId: userId,
            patientName: item.patientName,
            patientBirthDate: item.patientBirthDate || null,
            procedureDate: procDate,
            procedureName: item.procedureName || null,
            insuranceProvider: item.insuranceProvider || null,
            reportedValue: item.reportedValue || "0.00",
            description: item.description || null,
            sourcePdfUrl: originalFileUrl || null,
          });
          savedCount++;
        } catch (itemErr) {
          console.error("Error saving clinic report item:", itemErr);
          skipCount++;
        }
      }

      if (originalFileUrl) {
        await storage.createUploadedReport({ userId, fileName: fileName || `relatorio.${fileType}`, originalFileUrl, extractedRecordCount: savedCount });
      }

      console.log(`Reconciliation upload: ${savedCount} saved, ${skipCount} skipped from ${extractedData.length} extracted`);

      try {
        await runReconciliation(userId);
        schedulePostUploadAudit(userId);
      } catch (reconcErr) {
        console.error("Reconciliation error (continuing):", reconcErr);
      }

      const allEntries = await storage.getDoctorEntries(userId);
      const unmatchedReports = await storage.getUnmatchedClinicReports(userId);
      return res.json({
        success: true,
        extractedCount: savedCount,
        reconciliation: {
          reconciled: allEntries.filter(e => e.status === "reconciled" || e.status === "validated"),
          divergent: allEntries.filter(e => e.status === "divergent"),
          pending: allEntries.filter(e => e.status === "pending"),
          unmatchedClinic: unmatchedReports,
        },
      });
    } catch (error: any) {
      console.error("File reconciliation error:", error);
      const msg = error?.message || "Erro ao processar arquivo";
      return res.status(500).json({ message: msg });
    }
  });

  app.get("/api/uploaded-reports", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const reports = await storage.getUploadedReports(userId);
      return res.json({ reports });
    } catch (error) {
      console.error("Get uploaded reports error:", error);
      return res.status(500).json({ message: "Erro ao buscar relatórios" });
    }
  });

  app.delete("/api/uploaded-reports/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const reportId = req.params.id;
      const result = await storage.deleteUploadedReportCascade(reportId, userId);
      return res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Delete uploaded report error:", error);
      if (error.message === "Relatório não encontrado") {
        return res.status(404).json({ message: error.message });
      }
      return res.status(500).json({ message: "Erro ao apagar relatório" });
    }
  });

  app.get("/api/reconciliation/csv-template", (_req: Request, res: Response) => {
    const csv = generateCsvTemplate();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=modelo_conciliacao.csv");
    return res.send(csv);
  });

  app.get("/api/reconciliation/results", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const allEntries = await storage.getDoctorEntries(userId);
      const reconciled = allEntries.filter(e => e.status === "reconciled" || e.status === "validated");
      const divergent = allEntries.filter(e => e.status === "divergent");
      const pending = allEntries.filter(e => e.status === "pending");
      const unmatchedReports = await storage.getUnmatchedClinicReports(userId);
      return res.json({ reconciled, divergent, pending, unmatchedClinic: unmatchedReports });
    } catch (error) {
      console.error("Get reconciliation results error:", error);
      return res.status(500).json({ message: "Erro ao buscar resultados" });
    }
  });

  // ── Financial Projections ──

  app.get("/api/financials/projections", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const allEntries = await storage.getDoctorEntries(userId);
      const now = new Date();

      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const currentMonthCases = allEntries.filter(e => {
        const d = new Date(e.procedureDate);
        return d >= currentMonthStart && d < nextMonthStart;
      }).length;

      const previousMonthCases = allEntries.filter(e => {
        const d = new Date(e.procedureDate);
        return d >= previousMonthStart && d < currentMonthStart;
      }).length;

      return res.json({
        production: {
          currentMonth: currentMonthCases,
          previousMonth: previousMonthCases,
        },
        entryCount: allEntries.length,
      });
    } catch (error) {
      console.error("Projections error:", error);
      return res.status(500).json({ message: "Erro ao calcular projeções" });
    }
  });

  app.get("/api/reports/analytics", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const entries = await storage.getDoctorEntries(userId);
      const filtered = entries.filter(e => {
        if (dateFrom && new Date(e.procedureDate) < new Date(dateFrom)) return false;
        if (dateTo && new Date(e.procedureDate) > new Date(dateTo)) return false;
        return true;
      });
      const totalBilled = filtered.reduce((sum, e) => sum + (parseFloat(e.procedureValue || "0") || 0), 0);
      const byStatus = { pending: 0, reconciled: 0, divergent: 0, validated: 0 };
      const byInsurance: Record<string, { count: number; total: number }> = {};
      const byMonth: Record<string, { count: number; total: number }> = {};
      for (const e of filtered) {
        const st = e.status as keyof typeof byStatus;
        if (st in byStatus) byStatus[st]++;
        const ins = e.insuranceProvider || "Sem convênio";
        if (!byInsurance[ins]) byInsurance[ins] = { count: 0, total: 0 };
        byInsurance[ins].count++;
        byInsurance[ins].total += parseFloat(e.procedureValue || "0") || 0;
        const d = new Date(e.procedureDate);
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!byMonth[mk]) byMonth[mk] = { count: 0, total: 0 };
        byMonth[mk].count++;
        byMonth[mk].total += parseFloat(e.procedureValue || "0") || 0;
      }
      return res.json({ totalEntries: filtered.length, totalBilled, byStatus, byInsurance, byMonth });
    } catch (error) {
      console.error("Reports analytics error:", error);
      return res.status(500).json({ message: "Erro ao calcular analytics" });
    }
  });

  // ── Historical Import ──

  function parseDateBR(dateStr: string): Date | null {
    if (!dateStr) return null;
    const trimmed = dateStr.trim();
    const brMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (brMatch) {
      const [, day, month, year] = brMatch;
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(d.getTime())) return d;
    }
    const isoMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (isoMatch) {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  function normalizeSpreadsheetRows(buffer: Buffer, fileName: string): Array<Record<string, string>> {
    const ext = fileName.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      const text = buffer.toString("utf-8");
      const result = Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (h: string) => h.trim() });
      return result.data as Array<Record<string, string>>;
    }

    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
  }

  function parseExcelDate(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    if (typeof val === "number") {
      const excelEpoch = new Date(1899, 11, 30);
      const d = new Date(excelEpoch.getTime() + val * 86400000);
      if (!isNaN(d.getTime())) return d;
    }
    if (typeof val === "string") return parseDateBR(val.trim());
    return null;
  }

  function mapRowToEntry(row: Record<string, any>, year: number): { patientName: string; procedureDate: Date; insuranceProvider: string; description: string; procedureValue: string | null } | null {
    const keys = Object.keys(row);
    const findKey = (patterns: string[], exclude?: string[]) => keys.find(k => {
      const lower = k.toLowerCase();
      const matches = patterns.some(p => lower.includes(p));
      if (!matches) return false;
      if (exclude) return !exclude.some(e => lower.includes(e));
      return true;
    }) || null;

    const dateKey = findKey(["data_procedimento", "data_atendimento", "dt_atendimento", "dt_procedimento", "data_", "date"], ["descricao", "nascimento"]) || findKey(["data"], ["descricao", "nascimento"]);
    const nameKey = findKey(["nome_paciente", "paciente", "beneficiario", "cliente", "nome", "patient"]);
    const insuranceKey = findKey(["convenio", "convênio", "plano", "insurance", "operadora", "repasse", "forma_pagamento", "especie"]);
    const descKey = findKey(["descricao", "descrição", "description", "procedimento", "servico", "tipo", "observacao"]);
    const valueKey = findKey(["valor", "value", "preco", "preço", "total", "valor_total", "valor_pago"], ["nome", "paciente", "data"]);

    const patientName = nameKey ? String(row[nameKey] || "").trim() : "";
    const insuranceProvider = insuranceKey ? String(row[insuranceKey] || "").trim() : "";
    const description = descKey ? String(row[descKey] || "").trim() : "";
    const rawValue = valueKey ? String(row[valueKey] || "").trim().replace(",", ".") : "";

    if (!patientName) return null;

    const dateVal = dateKey ? row[dateKey] : null;
    let procedureDate = parseExcelDate(dateVal);
    if (!procedureDate) return null;

    if (year && procedureDate.getFullYear() !== year) {
      procedureDate.setFullYear(year);
    }

    return {
      patientName,
      procedureDate,
      insuranceProvider: insuranceProvider || "Não informado",
      description: description || "Procedimento importado",
      procedureValue: rawValue && !isNaN(parseFloat(rawValue)) ? parseFloat(rawValue).toFixed(2) : null,
    };
  }

  app.post("/api/import/doctor-entries", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { file, fileName, year } = req.body;
      if (!file || !fileName) {
        return res.status(400).json({ message: "Arquivo não enviado" });
      }
      const targetYear = year ? parseInt(year) : new Date().getFullYear() - 1;
      const ext = fileName.split(".").pop()?.toLowerCase();

      let imported = 0;
      let skipped = 0;
      let totalRows = 0;

      if (ext === "pdf") {
        const base64Data = file.replace(/^data:[^;]+;base64,/, "");
        const pdfBuffer = Buffer.from(base64Data, "base64");
        const extractedData = await extractPdfData(pdfBuffer);
        totalRows = extractedData.length;

        if (extractedData.length === 0) {
          return res.status(400).json({ message: "Nenhum dado encontrado no PDF. Verifique se o arquivo contém registros de procedimentos." });
        }

        for (const item of extractedData) {
          if (!item.patientName || item.patientName === "Não identificado") { skipped++; continue; }
          let procDate = parseLocalDate(item.procedureDate);
          if (isNaN(procDate.getTime())) { skipped++; continue; }
          if (targetYear && procDate.getFullYear() !== targetYear) {
            procDate.setFullYear(targetYear);
          }

          await storage.createDoctorEntry({
            doctorId: userId,
            patientName: item.patientName,
            patientBirthDate: item.patientBirthDate || null,
            procedureDate: procDate,
            procedureName: item.procedureName || null,
            insuranceProvider: item.insuranceProvider || "Não informado",
            description: item.description || "Procedimento importado",
            procedureValue: item.reportedValue && item.reportedValue !== "0.00" ? item.reportedValue : null,
            entryMethod: "manual",
            sourceUrl: null,
            status: "pending",
          });
          imported++;
        }
      } else {
        const buffer = Buffer.from(file, "base64");
        const rows = normalizeSpreadsheetRows(buffer, fileName);
        totalRows = rows.length;

        if (rows.length === 0) {
          return res.status(400).json({ message: "Nenhum dado encontrado na planilha. Verifique se o formato está correto." });
        }

        for (const row of rows) {
          const mapped = mapRowToEntry(row, targetYear);
          if (!mapped) { skipped++; continue; }

          await storage.createDoctorEntry({
            doctorId: userId,
            patientName: mapped.patientName,
            procedureDate: mapped.procedureDate,
            insuranceProvider: mapped.insuranceProvider,
            description: mapped.description,
            procedureValue: mapped.procedureValue,
            entryMethod: "manual",
            sourceUrl: null,
            status: "pending",
          });
          imported++;
        }
      }

      if (imported > 0) {
        await storage.createNotification({
          doctorId: userId,
          type: "import",
          title: "Importação histórica",
          message: `${imported} lançamentos de ${targetYear} importados via ${ext === "pdf" ? "PDF" : "planilha"}`,
          read: false,
        });
        schedulePostUploadAudit(userId);
      }

      return res.json({ success: true, imported, skipped, year: targetYear, totalRows });
    } catch (error) {
      console.error("Import doctor entries error:", error);
      return res.status(500).json({ message: "Erro ao processar arquivo" });
    }
  });

  app.post("/api/import/clinic-reports", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { pdfs, year } = req.body;
      if (!pdfs || !Array.isArray(pdfs) || pdfs.length === 0) {
        return res.status(400).json({ message: "Nenhum PDF enviado" });
      }
      if (pdfs.length > 20) {
        return res.status(400).json({ message: "Máximo de 20 PDFs por vez" });
      }

      let totalExtracted = 0;
      let pdfErrors = 0;
      const failedPdfs: string[] = [];

      for (const pdfItem of pdfs) {
        const base64Data = (pdfItem.data || pdfItem).replace(/^data:[^;]+;base64,/, "");
        const pdfBuffer = Buffer.from(base64Data, "base64");

        try {
          const extractedData = await extractPdfData(pdfBuffer);
          for (const item of extractedData) {
            let procDate = parseLocalDate(item.procedureDate);
            if (year && procDate.getFullYear() !== parseInt(year)) {
              procDate.setFullYear(parseInt(year));
            }
            await storage.createClinicReport({
              doctorId: userId,
              patientName: item.patientName,
              patientBirthDate: item.patientBirthDate || null,
              procedureDate: procDate,
              procedureName: item.procedureName || null,
              insuranceProvider: item.insuranceProvider || null,
              reportedValue: item.reportedValue || "0.00",
              description: item.description || null,
              sourcePdfUrl: null,
            });
            totalExtracted++;
          }
        } catch (err) {
          pdfErrors++;
          failedPdfs.push(pdfItem.name || `PDF ${pdfErrors}`);
          console.error(`Error processing PDF ${pdfItem.name || "unknown"}:`, err);
        }
      }

      if (totalExtracted === 0 && pdfErrors === pdfs.length) {
        return res.status(400).json({ message: "Não foi possível extrair dados de nenhum PDF. Verifique se os arquivos estão corretos." });
      }

      const reconciliationResult = await runReconciliation(userId);
      schedulePostUploadAudit(userId);

      await storage.createNotification({
        doctorId: userId,
        type: "import",
        title: "Importação de PDFs",
        message: `${totalExtracted} registros extraídos de ${pdfs.length - pdfErrors}/${pdfs.length} PDF(s) e conciliação executada`,
        read: false,
      });

      return res.json({
        success: true,
        extractedCount: totalExtracted,
        pdfCount: pdfs.length,
        pdfErrors,
        failedPdfs,
        reconciliation: {
          reconciled: reconciliationResult.reconciled.length,
          divergent: reconciliationResult.divergent.length,
          pending: reconciliationResult.pending.length,
        },
      });
    } catch (error) {
      console.error("Import clinic reports error:", error);
      return res.status(500).json({ message: "Erro ao processar PDFs" });
    }
  });

  // ── Document Templates ──

  app.post("/api/document-templates/analyze", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { file, fileType } = req.body;
      if (!file || !fileType) return res.status(400).json({ message: "Arquivo não enviado" });

      const base64Data = file.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const analysis = await analyzeDocumentStructure(buffer, fileType as any);
      const sampleHash = computeDocumentHash(base64Data.substring(0, 2000));

      return res.json({ success: true, analysis, sampleHash });
    } catch (error: any) {
      console.error("Document analysis error:", error);
      return res.status(500).json({ message: error?.message || "Erro ao analisar documento" });
    }
  });

  app.post("/api/document-templates", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { name, mappingJson, sampleHash } = req.body;
      if (!name || !mappingJson) return res.status(400).json({ message: "Nome e mapeamento são obrigatórios" });

      const template = await storage.createDocumentTemplate({
        userId,
        name,
        mappingJson: typeof mappingJson === "string" ? mappingJson : JSON.stringify(mappingJson),
        sampleHash: sampleHash || null,
      });

      return res.status(201).json({ template });
    } catch (error) {
      console.error("Create template error:", error);
      return res.status(500).json({ message: "Erro ao salvar template" });
    }
  });

  app.get("/api/document-templates", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const templates = await storage.getDocumentTemplates(userId);
      return res.json({ templates });
    } catch (error) {
      console.error("Get templates error:", error);
      return res.status(500).json({ message: "Erro ao buscar templates" });
    }
  });

  app.delete("/api/document-templates/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const template = await storage.getDocumentTemplate(req.params.id);
      if (!template || template.userId !== userId) return res.status(404).json({ message: "Template não encontrado" });
      await storage.deleteDocumentTemplate(req.params.id);
      return res.json({ success: true });
    } catch (error) {
      console.error("Delete template error:", error);
      return res.status(500).json({ message: "Erro ao excluir template" });
    }
  });

  // ── Dashboard Stats ──

  app.get("/api/dashboard/stats", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const entries = await storage.getDoctorEntries(userId);
      const unmatchedReports = await storage.getUnmatchedClinicReports(userId);

      const pending = entries.filter(e => e.status === "pending").length;
      const reconciled = entries.filter(e => e.status === "reconciled" || e.status === "validated").length;
      const divergent = entries.filter(e => e.status === "divergent").length;
      const unmatched = unmatchedReports.length;
      const total = pending + reconciled + divergent + unmatched;

      const recentEntries = entries.slice(0, 15);

      return res.json({ pending, reconciled, divergent, unmatched, total, entries: recentEntries });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      return res.status(500).json({ message: "Erro ao buscar estatísticas" });
    }
  });

  // ── Object Storage Routes ──
  registerObjectStorageRoutes(app);

  return httpServer;
}