# PayFlow — Simulated Digital Wallet

**PayFlow** is a full-stack, closed-loop digital wallet application built with React, Node.js, Express, and MongoDB. It demonstrates secure authentication, wallet management, simulated money transfers, transaction history, and ledger-based accounting.

> **Live Demo:** [PayFlow](https://payflow-omega-wheat.vercel.app/)  
> **Backend API:** [PayFlow API](https://payflow-api-kj0f.onrender.com/api/v1/health)

**Important:** PayFlow is an educational simulation. It does not process real money, connect to banks, collect payment-card credentials, or represent or affiliate with Visa or any payment network.

## Features

- **Authentication:** User registration, login, password hashing, and JWT-based authentication.
- **Wallet Management:** Individual INR wallets with balances stored in integer paise.
- **Simulated Transfers:** Send money between registered PayFlow users.
- **Transaction Safety:** Atomic database transactions, conditional balance updates, and idempotency protection.
- **Transaction History:** View sent and received transactions with pagination.
- **Ledger System:** Separate debit and credit entries for completed transfers.
- **Risk Detection:** Advisory flags for large and rapid transactions.
- **Admin Dashboard API:** Review and dismiss risk flags with audit logging.
- **Accessibility:** Semantic page structure, keyboard navigation, visible focus states, and accessible form feedback.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Authentication | JWT, bcrypt |
| Testing | Vitest, Supertest |
| Infrastructure | Docker Compose, MongoDB Atlas |
| Deployment | Vercel, Render |

## Architecture

```text
                 React + Vite
                      |
                      | HTTPS / REST API
                      |
                 Express API
                      |
           -----------------------
           |          |          |
       Auth API   Wallet API  Transfer API
           |          |          |
           -----------------------
                      |
                   Mongoose
                      |
                  MongoDB
```

The application uses MongoDB transactions to maintain consistency across wallet balances, transfer records, ledger entries, and idempotency records.

## Local Development Setup

### Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- Docker Desktop with Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/tanishqpandey14/PayFlow.git
cd PayFlow
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local `.env` file from the example:

**PowerShell:**

```powershell
Copy-Item .env.example .env
```

Configure the following variables:

| Variable | Description |
|---|---|
| `API_PORT` | Local API port |
| `WEB_ORIGIN` | Frontend origin |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign JWTs |

Use a strong, randomly generated JWT secret. Never commit your `.env` file.

### 4. Start MongoDB

Start Docker Desktop and run:

```bash
docker compose up -d mongodb
```

Initialize the single-node replica set:

```bash
docker compose exec mongodb mongosh --quiet --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})"
```

Verify the replica set:

```bash
docker compose exec mongodb mongosh --quiet --eval "rs.status().ok"
```

Expected output:

```text
1
```

If the replica set has already been initialized, verify its status instead of initializing it again.

### 5. Start the application

From the project root:

```bash
npm run dev
```

Open the application:

- Frontend: http://localhost:5173
- API health: http://localhost:4000/api/v1/health

Keep the development terminal running while using the application.

## Testing

Run the backend test suite:

```bash
npm test --workspace=apps/api
```

Build the frontend:

```bash
npm run build
```

## Project Structure

```text
PayFlow/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── config/
│   │   │   ├── middleware/
│   │   │   ├── models/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── utils/
│   │   └── tests/
│   │
│   └── web/
│       └── src/
│           ├── components/
│           ├── context/
│           ├── pages/
│           ├── services/
│           └── utils/
│
├── docs/
├── docker-compose.yml
├── .env.example
├── package.json
└── README.md
```

## Engineering Highlights

Some of the engineering concepts demonstrated in PayFlow:

- **Atomicity:** MongoDB transactions keep related financial records consistent.
- **Concurrency Control:** Conditional balance updates prevent spending beyond available funds.
- **Idempotency:** Repeated transfer requests with the same key do not create duplicate transfers.
- **Ledger Accounting:** Each completed transfer creates corresponding debit and credit entries.
- **Security:** Password hashing, JWT verification, role-based authorization, and Helmet security headers.
- **Testing:** Automated API tests covering authentication, wallet operations, transfers, and administration.

## Future Improvements

- Additional production security hardening and rate limiting.
- More comprehensive automated frontend and end-to-end tests.
- Dedicated demo wallet top-up workflow.
- Enhanced monitoring and deployment observability.

## Disclaimer

PayFlow is a personal educational software engineering project. All wallet balances and transfers are simulated. It is not a banking application, payment processor, or financial service.
