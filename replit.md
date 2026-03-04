# Medfin

Plataforma SaaS de gestão financeira inteligente para profissionais de saúde. Sistema de Conferência Inteligente que permite lançamentos por foto, áudio ou manual com processamento real por IA.

## Architecture

- **Frontend**: React (Vite) + TailwindCSS v4 + shadcn/ui components
- **Backend**: Node.js (Express) + TypeScript
- **Database**: PostgreSQL (Replit) + Drizzle ORM
- **Auth**: JWT (jsonwebtoken) + bcryptjs for password hashing
- **AI**: OpenAI via Replit AI Integrations (gpt-5-mini for vision/text, gpt-4o-mini-transcribe for audio STT)

## Project Structure

```
client/src/
  pages/             - Login, Register, Dashboard, ConfirmEntry
  components/ui/     - shadcn/ui components
  lib/auth.ts        - Token/user management utilities
  lib/queryClient.ts
  lib/utils.ts
  replit_integrations/audio/ - Client-side audio utilities (voice recorder, playback)

server/
  index.ts           - Express entry point (50mb body limit)
  routes.ts          - API routes (auth + entries + AI processing)
  openai.ts          - OpenAI client + image/audio extraction functions
  storage.ts         - Database storage interface (Drizzle)
  db.ts              - Database connection pool
  replit_integrations/ - AI integration modules (audio, chat, image, batch)

shared/
  schema.ts          - Drizzle schema + Zod validation schemas
  models/chat.ts     - Conversations/messages schema (AI integration)
```

## Database Tables

- **users**: id, name, email, password
- **doctor_entries**: id, doctorId, patientName, procedureDate, insuranceProvider, description, entryMethod (photo/audio/manual), sourceUrl, status (pending/reconciled/divergent), createdAt
- **clinic_reports**: id, doctorId, patientName, procedureDate, reportedValue, sourcePdfUrl, createdAt
- **conversations**: id, title, createdAt (AI integration)
- **messages**: id, conversationId, role, content, createdAt (AI integration)

## API Routes

### Auth
- `POST /api/auth/register` - Create account (name, email, password) -> JWT
- `POST /api/auth/login` - Login (email, password) -> JWT
- `GET /api/auth/me` - Get current user (requires Bearer token)

### Entries
- `POST /api/entries/photo` - Process photo with OpenAI Vision API -> extracted data
- `POST /api/entries/audio` - Process audio with OpenAI STT + text extraction -> extracted data
- `POST /api/entries` - Save a doctor entry to database
- `GET /api/entries` - List all entries for authenticated doctor

## Design System

- Font: Manrope (400-800 weights)
- Primary color: #8855f6 (purple)
- Hero gradient: linear-gradient(135deg, #8855f6 -> #64499c)
- Background: #f6f5f8 (light warm gray)
- Glass card effect: rgba(255,255,255,0.7) + backdrop-blur(12px)
- Cards: White bg, rounded-2xl, shadow-sm, border-slate-100
- Buttons: rounded-full, shadow-lg with primary/30 shadow
- Icon badges: Colored bg (blue-50, green-50, red-50) with matching text
- All UI text in pt-BR (Brazilian Portuguese)

## Key Dependencies

- bcryptjs, jsonwebtoken (auth)
- openai (AI integrations - uses AI_INTEGRATIONS_OPENAI_API_KEY + AI_INTEGRATIONS_OPENAI_BASE_URL)
- drizzle-orm, drizzle-zod, pg (database)
- wouter (routing), @tanstack/react-query (data fetching)
- lucide-react (icons)

## Entry Flow

1. Dashboard: User clicks Photo/Audio/Manual button
2. Photo: File picker -> base64 -> POST /api/entries/photo -> AI extracts data -> ConfirmEntry page
3. Audio: MediaRecorder -> base64 -> POST /api/entries/audio -> AI transcribes + extracts -> ConfirmEntry page
4. Manual: Direct navigation to ConfirmEntry with empty form
5. ConfirmEntry: User reviews/edits extracted data -> POST /api/entries -> saved to DB -> back to Dashboard