# Medfin

Plataforma SaaS de gestão financeira inteligente para profissionais de saúde. Sistema de Conferência Inteligente que permite lançamentos por foto, áudio ou manual com processamento real por IA.

## Architecture

- **Frontend**: React (Vite) + TailwindCSS v4 + shadcn/ui components
- **Backend**: Node.js (Express) + TypeScript
- **Database**: PostgreSQL (Replit) + Drizzle ORM
- **Auth**: JWT (jsonwebtoken) + bcryptjs for password hashing
- **AI**: OpenAI via Replit AI Integrations (gpt-5-mini for vision/text, gpt-4o-mini-transcribe for audio STT)
- **Charts**: recharts for financial reports

## Project Structure

```
client/src/
  pages/             - Login, Register, Dashboard, ConfirmEntry, Settings, ClinicReports, Reports
  components/ui/     - shadcn/ui components
  lib/auth.ts        - Token/user management utilities
  lib/audioUtils.ts  - WAV conversion for iPhone audio compatibility
  lib/queryClient.ts
  lib/utils.ts

server/
  index.ts           - Express entry point (50mb body limit)
  routes.ts          - API routes (auth + entries + clinic reports + notifications + AI processing)
  openai.ts          - OpenAI client + image/audio extraction functions
  storage.ts         - Database storage interface (Drizzle)
  db.ts              - Database connection pool

shared/
  schema.ts          - Drizzle schema + Zod validation schemas
```

## Database Tables

- **users**: id, name, email, password
- **doctor_entries**: id, doctorId, patientName, procedureDate, insuranceProvider, description, procedureValue (numeric 12,2), entryMethod (photo/audio/manual), sourceUrl, status (pending/reconciled/divergent), createdAt
- **clinic_reports**: id, doctorId, patientName, procedureDate, reportedValue, description, sourcePdfUrl, createdAt
- **notifications**: id, doctorId, type, title, message, read (boolean), createdAt
- **conversations**: id, title, createdAt (AI integration)
- **messages**: id, conversationId, role, content, createdAt (AI integration)

## API Routes

### Auth
- `POST /api/auth/register` - Create account (name, email, password) -> JWT
- `POST /api/auth/login` - Login (email, password) -> JWT
- `GET /api/auth/me` - Get current user (requires Bearer token)
- `PUT /api/auth/profile` - Update user name
- `PUT /api/auth/password` - Change password (requires currentPassword, newPassword)

### Entries
- `POST /api/entries/photo` - Process photo with OpenAI Vision API -> extracted data
- `POST /api/entries/audio` - Process audio with OpenAI STT + text extraction -> extracted data
- `POST /api/entries` - Save a doctor entry to database
- `POST /api/entries/batch` - Save multiple entries at once
- `GET /api/entries` - List all entries for authenticated doctor
- `PUT /api/entries/:id` - Update an entry (with ownership check)
- `DELETE /api/entries/:id` - Delete an entry (with ownership check)

### Clinic Reports
- `GET /api/clinic-reports` - List reports for authenticated doctor
- `POST /api/clinic-reports` - Create a clinic report
- `DELETE /api/clinic-reports/:id` - Delete a clinic report (with ownership check)

### Notifications
- `GET /api/notifications` - List notifications with unread count
- `PUT /api/notifications/:id/read` - Mark single notification as read
- `PUT /api/notifications/read-all` - Mark all notifications as read

## Pages

- **Login/Register**: Authentication flow
- **Dashboard**: Main hub with entry capture (photo/audio/manual), stats grid (pending/reconciled/divergent/total value), filters/search, notifications bell dropdown, navigation links, entry list with quick status change, edit modal
- **ConfirmEntry**: Review/edit AI-extracted or manual entry data before saving (includes procedureValue field)
- **Settings**: Profile name edit + password change
- **ClinicReports**: Add, list, delete clinic reports (patient name, date, value, description)
- **Reports**: Financial charts with recharts (bar chart by month, pie chart by insurance), summary cards, period filters
- **Tutorial**: 4-step balloon tutorial with localStorage persistence, help button to re-open

## Design System

- Font: Manrope (400-800 weights)
- Primary color: #8855f6 (purple)
- Hero gradient: linear-gradient(135deg, #8855f6 -> #64499c)
- Background: #f6f5f8 (light warm gray)
- Glass card effect: rgba(255,255,255,0.7) + backdrop-blur(12px)
- Cards: White bg, rounded-2xl, shadow-sm, border-slate-100
- Buttons: rounded-full, shadow-lg with primary/30 shadow
- All UI text in pt-BR (Brazilian Portuguese)

## Key Dependencies

- bcryptjs, jsonwebtoken (auth)
- openai (AI integrations - uses AI_INTEGRATIONS_OPENAI_API_KEY + AI_INTEGRATIONS_OPENAI_BASE_URL)
- drizzle-orm, drizzle-zod, pg (database)
- wouter (routing), @tanstack/react-query (data fetching)
- lucide-react (icons), recharts (charts)

## Entry Flow

1. Dashboard: User clicks Photo/Audio/Manual button
2. Photo: File picker -> base64 -> POST /api/entries/photo -> AI extracts data (including procedureValue) -> ConfirmEntry page
3. Audio: MediaRecorder -> WAV conversion -> base64 -> POST /api/entries/audio -> AI transcribes + extracts -> ConfirmEntry page
4. Manual: Direct navigation to ConfirmEntry with empty form
5. ConfirmEntry: User reviews/edits extracted data + value -> POST /api/entries -> saved to DB -> back to Dashboard
6. Notifications auto-generated on entry creation and divergence marking

## Entry Status

- `pending` (Pendente): Default status for new entries
- `reconciled` (Conferido): Manually set when confirmed against clinic report
- `divergent` (Divergente): Manually set when discrepancy found
