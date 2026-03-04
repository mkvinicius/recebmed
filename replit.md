# Medfin

Plataforma SaaS de gestão financeira inteligente para profissionais de saúde. Sistema de Conferência Inteligente que permite lançamentos por foto, áudio ou manual.

## Architecture

- **Frontend**: React (Vite) + TailwindCSS v4 + shadcn/ui components
- **Backend**: Node.js (Express) + TypeScript
- **Database**: PostgreSQL (Replit) + Drizzle ORM
- **Auth**: JWT (jsonwebtoken) + bcryptjs for password hashing

## Project Structure

```
client/src/
  pages/             - Login, Register, Dashboard, ConfirmEntry
  components/ui/     - shadcn/ui components
  lib/auth.ts        - Token/user management utilities
  lib/queryClient.ts
  lib/utils.ts

server/
  index.ts           - Express entry point
  routes.ts          - API routes (auth + entries)
  storage.ts         - Database storage interface (Drizzle)
  db.ts              - Database connection pool

shared/
  schema.ts          - Drizzle schema + Zod validation schemas
```

## Database Tables

- **users**: id, name, email, password
- **doctor_entries**: id, doctorId, patientName, procedureDate, insuranceProvider, description, entryMethod (photo/audio/manual), sourceUrl, status (pending/reconciled/divergent), createdAt
- **clinic_reports**: id, doctorId, patientName, procedureDate, reportedValue, sourcePdfUrl, createdAt

## API Routes

### Auth
- `POST /api/auth/register` - Create account (name, email, password) -> JWT
- `POST /api/auth/login` - Login (email, password) -> JWT
- `GET /api/auth/me` - Get current user (requires Bearer token)

### Entries
- `POST /api/entries/photo` - Process photo with AI (currently mocked) -> extracted data
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

## Key Dependencies

- bcryptjs, jsonwebtoken (auth)
- drizzle-orm, drizzle-zod, pg (database)
- wouter (routing), @tanstack/react-query (data fetching)
- lucide-react (icons), framer-motion (animations)