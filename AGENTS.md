# Agent Guidelines for calkit-cloud

This document provides guidance for agents working on this repository.

## Regenerating the OpenAPI Client

When the backend API changes, regenerate the frontend OpenAPI client:

```bash
make frontend-client
```

This runs `npm run generate-client` in the frontend directory, which:
- Reads `openapi.json` (generated from FastAPI)
- Generates TypeScript client SDK files in `frontend/src/client`
- Formats the output with Biome

## Code Formatting

Format all code (frontend and backend) in one command:

```bash
make format
```

This applies the formatters configured for each service.

## Database Migrations

Database migrations are handled with Alembic. **Before creating or modifying migrations, read [docs/dev/database-migrations.md](docs/dev/database-migrations.md).**

Key points:
- Define new tables as `SQLModel` classes in `backend/app/models/core.py`
- Generate migrations with: `docker compose exec backend alembic revision --autogenerate -m "Description"`
- Apply migrations with: `docker compose exec backend alembic upgrade head`
- Check current version with: `alembic current` (from `backend/` directory)

## Development Environment

- **Backend**: FastAPI in `backend/` directory
- **Frontend**: React + Vite in `frontend/` directory
- **Docker**: Services orchestrated with Docker Compose; see `docker-compose.yml`
- **Development**: Use `make dev` to start all services

## Testing

- Run frontend tests: `make test-frontend`
- Run backend tests: `make test-backend`

## Common Patterns

### Modifying API Contracts
1. Update backend route in `backend/app/api/routes/`
2. Regenerate the client: `make frontend-client`
3. Update frontend code to use new/changed SDK methods
4. Format both: `make format`

### Adding Database Features
1. Add `SQLModel` class in `backend/app/models/core.py`
2. Create migration: `docker compose exec backend alembic revision --autogenerate -m "Add new_table"`
3. Apply migration: `docker compose exec backend alembic upgrade head`
4. Commit the migration file in `backend/app/alembic/versions/`

### Building and Testing
- Local frontend build: `cd frontend && npm run build`
- Docker frontend build: `docker compose build frontend`
- Backend tests: `make test-backend`
