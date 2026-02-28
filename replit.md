# Medfin

Plataforma SaaS de gestão financeira e de pacientes para profissionais de saúde.

## Architecture

- **Frontend**: React (Vite) + TailwindCSS v4 + shadcn/ui components
- **Backend**: Node.js (Express) + TypeScript
- **Database**: PostgreSQL (Replit) + Drizzle ORM
- **Auth**: JWT (jsonwebtoken) + bcryptjs for password hashing

## Project Structure

```
client/src/
  pages/           - Login, Register, Dashboard
  components/ui/   - shadcn/ui components
  lib/auth.ts      - Token/user management utilities
  lib/queryClient.ts
  lib/utils.ts

server/
  index.ts         - Express entry point
  routes.ts        - API routes (auth: register, login, me)
  storage.ts       - Database storage interface (Drizzle)
  db.ts            - Database connection pool

shared/
  schema.ts        - Drizzle schema + Zod validation schemas
```

## API Routes

- `POST /api/auth/register` - Create account (name, email, password) -> JWT
- `POST /api/auth/login` - Login (email, password) -> JWT
- `GET /api/auth/me` - Get current user (requires Bearer token)

## Design System

- Font: Plus Jakarta Sans
- Primary color: Purple (262, 83%, 58%)
- Style: Clean cards with glassmorphism, subtle shadows

## Key Dependencies

- bcryptjs, jsonwebtoken (auth)
- drizzle-orm, drizzle-zod, pg (database)
- wouter (routing), @tanstack/react-query (data fetching)
- lucide-react (icons), framer-motion (animations)