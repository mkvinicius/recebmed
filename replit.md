# RecebMed

Plataforma SaaS de gestão financeira inteligente para profissionais de saúde. Sistema de Conferência Inteligente que permite lançamentos por foto, áudio ou manual com processamento real por IA.

## Architecture

- **Frontend**: React (Vite 3.2.11 + Rollup 2.80.0) + TailwindCSS v4 (via @tailwindcss/postcss) + shadcn/ui components
- **Backend**: Node.js (Express) + TypeScript
- **Database**: PostgreSQL (Replit) + Drizzle ORM
- **Auth**: JWT (jsonwebtoken) + bcryptjs (12 rounds) for password hashing + express-rate-limit + helmet security headers
- **AI**: OpenAI direct API (gpt-5-mini for vision/text, gpt-4o-mini-transcribe for audio STT)
- **Object Storage**: Replit Object Storage (GCS) for media evidence (photos/audio attached to entries)
- **Charts**: recharts for financial reports

## Project Structure

```
client/src/
  pages/             - Login, Register, Dashboard, Entries, Capture, Profile, ConfirmEntry, Settings, ClinicReports, Reports, Reconciliation, EntryDetail, Import
  components/ui/     - shadcn/ui components
  components/AppLayout.tsx       - Bottom tab bar layout wrapper (Início/Lançamentos/Captura/Relatórios/Perfil)
  components/ProjectionsPanel.tsx - Financial projections panel (30/60/90 days)
  components/ObjectUploader.tsx   - Uppy-based file upload component
  hooks/use-upload.ts             - Upload hook for presigned URL flow
  lib/auth.ts        - Token/user management utilities
  lib/audioUtils.ts  - WAV conversion for iPhone audio compatibility
  lib/queryClient.ts
  lib/utils.ts

server/
  index.ts           - Express entry point (50mb body limit)
  routes.ts          - API routes (auth + entries + clinic reports + notifications + AI + reconciliation + projections + import + object storage)
  openai.ts          - OpenAI client + image/audio extraction functions
  reconciliation.ts  - PDF extraction (pdf-parse + OpenAI) + reconciliation engine (Levenshtein matching)
  storage.ts         - Database storage interface (Drizzle)
  db.ts              - Database connection pool
  replit_integrations/object_storage/ - Object storage service (GCS presigned URLs, ACL)

shared/
  schema.ts          - Drizzle schema + Zod validation schemas
```

## Database Tables

- **users**: id, name, email, password, profilePhotoUrl
- **doctor_entries**: id, doctorId, patientName, procedureDate, insuranceProvider, description, procedureValue (numeric 12,2), entryMethod (photo/audio/manual), sourceUrl, imageHash (SHA-256 for duplicate detection), status (pending/reconciled/divergent), createdAt
- **clinic_reports**: id, doctorId, patientName, procedureDate, reportedValue, description, sourcePdfUrl, createdAt
- **notifications**: id, doctorId, type, title, message, read (boolean), createdAt
- **ai_corrections**: id, doctorId, field, originalValue, correctedValue, entryMethod (photo/audio), createdAt — tracks user corrections to AI-extracted data for learning
- **conversations**: id, title, createdAt (AI integration)
- **messages**: id, conversationId, role, content, createdAt (AI integration)

## API Routes

### Auth (rate-limited: 10 req/15min login/register, 5 req/15min reset)
- `POST /api/auth/register` - Create account (name, email, password with strength validation: min 8 chars, uppercase, lowercase, number) -> JWT
- `POST /api/auth/login` - Login (email, password) -> JWT
- `GET /api/auth/me` - Get current user (requires Bearer token, validates user exists)
- `PUT /api/auth/profile` - Update user name
- `PUT /api/auth/password` - Change password (requires currentPassword, newPassword with strength validation)
- `POST /api/auth/request-reset` - Request password reset code (6-digit, 15min expiry, stored hashed in memory)
- `POST /api/auth/verify-reset` - Verify code + set new password (max 5 attempts per code, one-time use)
- `PUT /api/auth/profile-photo` - Update profile photo URL

### Entries
- `POST /api/entries/photo` - Process single photo with OpenAI Vision API -> extracted data with confidence scores
- `POST /api/entries/photos-batch` - Process multiple photos (up to 10) in parallel -> extracted data with confidence scores
- `POST /api/entries/audio` - Process audio with OpenAI STT + text extraction -> extracted data with confidence scores
- `POST /api/entries` - Save a doctor entry to database
- `POST /api/entries/batch` - Save multiple entries at once
- `GET /api/entries` - List all entries for authenticated doctor
- `GET /api/entries/search?q=` - Server-side search across patientName, description, insuranceProvider (ILIKE, min 2 chars, max 20 results)
- `PUT /api/entries/:id` - Update an entry (with ownership check)
- `DELETE /api/entries/:id` - Delete an entry (with ownership check)

### Clinic Reports
- `GET /api/clinic-reports` - List reports for authenticated doctor
- `POST /api/clinic-reports` - Create a clinic report
- `DELETE /api/clinic-reports/:id` - Delete a clinic report (with ownership check)

### Reconciliation
- `POST /api/reconciliation/upload-pdf` - Upload PDF, extract data with AI, auto-reconcile entries
- `GET /api/reconciliation/results` - Get entries grouped by reconciliation status

### Historical Import
- `POST /api/import/doctor-entries` - Import entries from CSV/Excel spreadsheet (papaparse + xlsx)
- `POST /api/import/clinic-reports` - Import multiple PDFs for bulk clinic reports + auto reconciliation

### Financial Projections
- `GET /api/financials/projections` - Calculate projected receivables (30/60/90 days)

### Object Storage
- `POST /api/uploads/request-url` - Get presigned upload URL
- `GET /objects/{*objectPath}` - Serve uploaded files

### AI Corrections
- `GET /api/ai-corrections/stats` - Get correction statistics (totalCorrections, fieldCounts, recentCorrections)

### Notifications
- `GET /api/notifications` - List notifications with unread count
- `PUT /api/notifications/:id/read` - Mark single notification as read
- `PUT /api/notifications/read-all` - Mark all notifications as read

## Navigation

Bottom tab bar (AppLayout) with 5 tabs on authenticated pages:
- **Início** (/dashboard) - Widget home: stats grid, projections panel, recent 5 entries, notifications
- **Lançamentos** (/entries) - Full entries list with filters (search, status, date, insurance), edit modal, quick status change
- **Captura** (/capture) - Elevated center button. Three capture cards: Photo, Audio, Manual
- **Relatórios** (/reports) - Financial charts and reports
- **Perfil** (/profile) - User info, quick links (Settings, Clinic Reports, Reconciliation), logout

Pages without tab bar: Login, Register, ForgotPassword, ConfirmEntry

## Pages

- **Login/Register**: Authentication flow with password strength meter (8+ chars, uppercase, lowercase, number required)
- **ForgotPassword**: Secure 2-step reset flow: 1) enter email → receive 6-digit code, 2) enter code + new strong password → reset complete
- **Dashboard (Início)**: Clean widget home with greeting, smart search bar (debounced, server-side via /api/entries/search), stats grid (Pendentes/Conferidos/Divergentes/Total), ProjectionsPanel, recent 5 entries with edit modal, notification bell dropdown
- **Entries (Lançamentos)**: Full entries list with search, status/date/insurance filters, edit modal, quick status change
- **Capture (Captura)**: Three capture method cards (Photo/Audio/Manual) with AI processing; photo supports batch upload (multiple files)
- **Profile (Perfil)**: User info with profile photo upload (camera button + remove), dark mode toggle, links to Settings/ClinicReports/Reconciliation, logout
- **ConfirmEntry**: Review/edit AI-extracted or manual entry data before saving (includes procedureValue field); shows per-field AI confidence indicators (green/amber/red dots) and overall confidence banner for photo/audio entries
- **Settings**: Profile name edit + password change
- **ClinicReports**: Add, list, delete clinic reports (patient name, date, value, description)
- **Reports**: Financial charts with recharts (bar chart by month, pie chart by insurance), summary cards, period filters
- **Reconciliation**: PDF upload → AI extraction → automatic reconciliation with pending entries
- **EntryDetail**: Detailed view of individual entry with image evidence display
- **Import (Auditoria Retroativa)**: Historical data import — CSV/Excel template download, spreadsheet upload with year selector, multi-PDF upload for clinic reports with bulk reconciliation

## Design System

- Font: Manrope (400-800 weights)
- Primary color: #8855f6 (purple)
- Hero gradient: linear-gradient(135deg, #8855f6 -> #64499c)
- Light mode: Background #f6f5f8, white cards, slate borders
- Dark mode: Background #0d0a14, slate-900 cards, slate-700 borders (toggle in Profile page)
- Theme: next-themes with ThemeProvider (attribute="class", defaultTheme="light")
- Glass card: .glass-card (light) / .glass-card-dark (dark mode)
- Cards: rounded-2xl, shadow-sm
- Buttons: rounded-full, shadow-lg with primary/30 shadow
- i18n: 4 languages (pt-BR, en, es, fr) with auto-detection (localStorage → navigator → htmlTag). Language switcher in Profile page. Translation files in client/src/locales/. Config in client/src/lib/i18n.ts. Helper exports: getLocale(), getCurrencyCode() for locale-aware formatting

## Entry Flow

1. Capture tab: User clicks Photo/Audio/Manual card
2. Photo (single): File picker -> base64 -> POST /api/entries/photo -> AI extracts data with confidence scores -> ConfirmEntry page
2b. Photo (batch): Multiple file picker -> base64 array -> POST /api/entries/photos-batch -> parallel AI extraction with confidence -> ConfirmEntry page
3. Audio: MediaRecorder -> WAV conversion -> base64 -> POST /api/entries/audio -> AI transcribes + extracts -> ConfirmEntry page
4. Manual: Direct navigation to ConfirmEntry with empty form
5. ConfirmEntry: User reviews/edits extracted data + value -> POST /api/entries (with _originalData for AI methods, _imageHash for duplicate tracking) -> saved to DB + corrections stored in ai_corrections -> back to Dashboard
   - Duplicate detection: Photo capture computes SHA-256 hash of image; exact image duplicates warned at capture time. Data duplicates (same patient+date+description) checked on entry save (409 response) with continue/cancel modal
6. Learning loop: On next photo/audio extraction, recent corrections from ai_corrections are fetched and injected into AI prompts as context to improve accuracy
7. Notifications auto-generated on entry creation and divergence marking

## Entry Status

- `pending` (Pendente): Default status for new entries
- `reconciled` (Conferido): Set automatically by reconciliation engine or manually
- `divergent` (Divergente): Set automatically when values don't match or manually

## Key Dependencies

- bcryptjs, jsonwebtoken, express-rate-limit, helmet (auth + security)
- openai (AI integrations - uses AI_INTEGRATIONS_OPENAI_API_KEY + AI_INTEGRATIONS_OPENAI_BASE_URL)
- pdf-parse (PDF text extraction for reconciliation)
- papaparse (CSV parsing for historical import)
- xlsx (Excel file parsing for historical import)
- @google-cloud/storage, google-auth-library (object storage via Replit sidecar)
- drizzle-orm, drizzle-zod, pg (database)
- next-themes (dark mode)
- wouter (routing), @tanstack/react-query (data fetching)
- lucide-react (icons), recharts (charts)
- i18next, react-i18next, i18next-browser-languagedetector (i18n)
- @uppy/core, @uppy/dashboard, @uppy/react, @uppy/aws-s3 (file uploads)

## Environment Variables

- `JWT_SECRET` - JWT signing secret (auto-generated random 64-byte hex if not set)
- `OPENAI_API_KEY` - OpenAI API key (direct, https://api.openai.com/v1)
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` - Replit object storage bucket ID
- `PUBLIC_OBJECT_SEARCH_PATHS` - Public asset search paths
- `PRIVATE_OBJECT_DIR` - Private object storage directory

## PWA (Progressive Web App)

- **Hero gradient**: `h-52` (208px) in AppLayout and ConfirmEntry; Dashboard search bar overlaps gradient boundary (half purple/half white)
- **Manifest**: `client/public/manifest.json` — app name, icons, theme color (#8855f6), standalone display
- **Service Worker**: `client/public/sw.js` — network-first strategy with cache fallback, skips API routes
- **Registration**: `client/src/main.tsx` registers SW on page load
- **Install hook**: `client/src/hooks/use-pwa-install.ts` — captures `beforeinstallprompt` event; persists install state in localStorage (`recebmed_pwa_installed`); `markInstalled()` for iOS confirmation
- **Install button**: Profile page shows purple gradient "Install App" card — disappears permanently after installation (Android: native prompt; iOS: step-by-step guide modal with Cancel/Done buttons)
- **Auto-update**: SW uses `skipWaiting()` + `clients.claim()` — new deploys auto-update on next visit
- **Icons**: `favicon.png` (48x48), `apple-touch-icon.png` (180x180), `icon-512.png` (512x512)
- **Meta tags**: `theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`

## Important Notes

- Vite 3.2.11 + Rollup 2.80.0 (security requirement) - do NOT upgrade rollup above 2.x
- CSS uses @tailwindcss/postcss v4 (NOT the Vite plugin). postcss.config.js at root
- tw-animate-css uses direct import path (not package name, incompatible exports with Vite 3)
- CSS pre-warm in server/vite.ts to avoid 16s first load delay
- Express 5.2.1 with path-to-regexp v8 - use `{*param}` syntax for wildcard routes
- pdf-parse imported via `import * as pdfParseModule` (no default export in ESM)
