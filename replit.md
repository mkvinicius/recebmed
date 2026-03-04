# Medfin

Plataforma SaaS de gestão financeira inteligente para profissionais de saúde. Sistema de Conferência Inteligente que permite lançamentos por foto, áudio ou manual com processamento real por IA.

## Architecture

- **Frontend**: React (Vite 3.2.11 + Rollup 2.80.0) + TailwindCSS v4 (via @tailwindcss/postcss) + shadcn/ui components
- **Backend**: Node.js (Express) + TypeScript
- **Database**: PostgreSQL (Replit) + Drizzle ORM
- **Auth**: JWT (jsonwebtoken) + bcryptjs for password hashing
- **AI**: OpenAI via Replit AI Integrations (gpt-5-mini for vision/text, gpt-4o-mini-transcribe for audio STT)
- **Charts**: recharts for financial reports

## Project Structure

```
client/src/
  pages/             - Login, Register, Dashboard, ConfirmEntry, Settings, ClinicReports, Reports, Reconciliation, EntryDetail
  components/ui/     - shadcn/ui components
  components/ProjectionsPanel.tsx - Financial projections panel (30/60/90 days)
  components/ObjectUploader.tsx   - Uppy-based file upload component
  hooks/use-upload.ts             - Upload hook for presigned URL flow
  lib/auth.ts        - Token/user management utilities
  lib/audioUtils.ts  - WAV conversion for iPhone audio compatibility
  lib/queryClient.ts
  lib/utils.ts

server/
  index.ts           - Express entry point (50mb body limit)
  routes.ts          - API routes (auth + entries + clinic reports + notifications + AI + reconciliation + projections + object storage)
  openai.ts          - OpenAI client + image/audio extraction functions
  reconciliation.ts  - PDF extraction (pdf-parse + OpenAI) + reconciliation engine (Levenshtein matching)
  storage.ts         - Database storage interface (Drizzle)
  db.ts              - Database connection pool
  replit_integrations/object_storage/ - Object storage service (GCS presigned URLs, ACL)

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

### Reconciliation
- `POST /api/reconciliation/upload-pdf` - Upload PDF, extract data with AI, auto-reconcile entries
- `GET /api/reconciliation/results` - Get entries grouped by reconciliation status

### Financial Projections
- `GET /api/financials/projections` - Calculate projected receivables (30/60/90 days)

### Object Storage
- `POST /api/uploads/request-url` - Get presigned upload URL
- `GET /objects/{*objectPath}` - Serve uploaded files

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
- **Reconciliation**: PDF upload → AI extraction → automatic reconciliation with pending entries (Levenshtein name matching + date proximity). Results shown in three tabs: Conciliados/Divergentes/Pendentes
- **EntryDetail**: Detailed view of individual entry with image evidence display (if sourceUrl exists)
- **ProjectionsPanel**: Dashboard component showing projected receivables for 30/60/90 day windows
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

## Entry Flow

1. Dashboard: User clicks Photo/Audio/Manual button
2. Photo: File picker -> base64 -> POST /api/entries/photo -> AI extracts data (including procedureValue) -> ConfirmEntry page
3. Audio: MediaRecorder -> WAV conversion -> base64 -> POST /api/entries/audio -> AI transcribes + extracts -> ConfirmEntry page
4. Manual: Direct navigation to ConfirmEntry with empty form
5. ConfirmEntry: User reviews/edits extracted data + value -> POST /api/entries -> saved to DB -> back to Dashboard
6. Notifications auto-generated on entry creation and divergence marking

## Entry Status

- `pending` (Pendente): Default status for new entries
- `reconciled` (Conferido): Set automatically by reconciliation engine or manually
- `divergent` (Divergente): Set automatically when values don't match or manually

## Key Dependencies

- bcryptjs, jsonwebtoken (auth)
- openai (AI integrations - uses AI_INTEGRATIONS_OPENAI_API_KEY + AI_INTEGRATIONS_OPENAI_BASE_URL)
- pdf-parse (PDF text extraction for reconciliation)
- @google-cloud/storage, google-auth-library (object storage via Replit sidecar)
- drizzle-orm, drizzle-zod, pg (database)
- wouter (routing), @tanstack/react-query (data fetching)
- lucide-react (icons), recharts (charts)
- @uppy/core, @uppy/dashboard, @uppy/react, @uppy/aws-s3 (file uploads)

## Environment Variables

- `JWT_SECRET` - JWT signing secret
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI base URL
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` - Replit object storage bucket ID
- `PUBLIC_OBJECT_SEARCH_PATHS` - Public asset search paths
- `PRIVATE_OBJECT_DIR` - Private object storage directory

## Important Notes

- Vite 3.2.11 + Rollup 2.80.0 (security requirement) - do NOT upgrade rollup above 2.x
- CSS uses @tailwindcss/postcss v4 (NOT the Vite plugin). postcss.config.js at root
- tw-animate-css uses direct import path (not package name, incompatible exports with Vite 3)
- CSS pre-warm in server/vite.ts to avoid 16s first load delay
- Express 5.2.1 with path-to-regexp v8 - use `{*param}` syntax for wildcard routes
- pdf-parse imported via `import * as pdfParseModule` (no default export in ESM)
