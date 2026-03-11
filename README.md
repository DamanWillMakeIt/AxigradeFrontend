Axigrade Frontend

Next.js app with login and register pages, backed by MongoDB via Prisma.

## Setup

```bash
npm install
npx prisma generate
npx prisma db push
```

You must set a MongoDB connection string in your environment:

```bash
export DATABASE_URL="mongodb+srv://USER:PASSWORD@CLUSTER/dbname?retryWrites=true&w=majority"
```

On Windows PowerShell:

```powershell
$env:DATABASE_URL="mongodb+srv://USER:PASSWORD@CLUSTER/dbname?retryWrites=true&w=majority"
```

Or create a `.env` file:

```env
DATABASE_URL="mongodb+srv://USER:PASSWORD@CLUSTER/dbname?retryWrites=true&w=majority"
```

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

- **/** – Home with links to Login and Register
- **/login** – Sign in with email and password
- **/register** – Create account with name, email, and password

## API

- `POST /api/auth/register` – Register (body: `{ name, email, password }`)
- `POST /api/auth/login` – Login (body: `{ email, password }`)

## Database

MongoDB via Prisma. Connection URL comes from `DATABASE_URL`.
