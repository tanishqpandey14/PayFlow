# PayFlow

PayFlow is an educational, closed-loop simulated wallet project. It does **not** process real money, connect to banks, collect card/bank credentials, or represent/affiliate with Visa or any payment network.

## Stack
- React + Vite + JavaScript (JSX)
- Node.js + Express + JavaScript (ES modules)
- MongoDB + Mongoose
- Docker Compose for local MongoDB replica-set development

## Requirements
- Node.js 20 or newer
- npm 10 or newer
- Docker Desktop (with Docker Compose)

## 1. Install dependencies
From this project root:

```powershell
npm install
```

## 2. Configure environment
Copy `.env.example` to `.env` in the project root.

PowerShell:

```powershell
Copy-Item .env.example .env
```

## 3. Start MongoDB
Start Docker Desktop, then run:

```powershell
docker compose up -d mongodb
```

Initialize the single-node replica set once:

```powershell
docker compose exec mongodb mongosh --quiet --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})"
```

Wait a few seconds, then verify:

```powershell
docker compose exec mongodb mongosh --quiet --eval "rs.status().ok"
```

Expected output: `1`.

If the replica set was already initialized, MongoDB may report that it is already initialized; that's okay. Verify with the status command.

## 4. Start PayFlow
In the project root:

```powershell
npm run dev
```

Open:
- Frontend: http://localhost:5173
- API health: http://localhost:4000/api/v1/health

Keep this terminal open while developing. Run `npm run dev` only once. Press `Ctrl+C` to stop both development servers.

## Useful commands

```powershell
npm run dev       # Start frontend and API
npm run build     # Build frontend for production
docker compose ps # Check MongoDB container
docker compose logs mongodb
docker compose down
```

`docker compose down` stops containers but keeps the named database volume. To intentionally delete local database data too, use `docker compose down -v`.

## Project layout

```text
PayFlow/
├── apps/
│   ├── api/       # Express API
│   └── web/       # React frontend
├── docs/          # Product and engineering documentation
├── docker-compose.yml
├── .env.example
└── package.json
```

## Development status
The starter includes a connected MongoDB API health check and a minimal frontend. Authentication, wallet models, transfers, ledger, risk rules, and admin features are planned phases and are not implemented yet.
