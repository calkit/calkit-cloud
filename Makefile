.PHONY: help
help: ## Show this help.
	@uv run python -c "import re; \
	[[print(f'\033[36m{m[0]:<20}\033[0m {m[1]}') for m in re.findall(r'^([a-zA-Z_-]+):.*?## (.*)$$', open(makefile).read(), re.M)] for makefile in ('$(MAKEFILE_LIST)').strip().split()]"

DOCKER_COMPOSE_DEV=docker compose -f docker-compose.yml -f docker-compose.override.yml

.PHONY: dev
dev: ## Start up all containers for development.
	${DOCKER_COMPOSE_DEV} up

.PHONY: frontend-dev
frontend-dev: ## Start the frontend dev server.
	cd frontend && npm run dev

.PHONY: api-dev
api-dev: ## Start the backend alone using Docker Compose.
	${DOCKER_COMPOSE_DEV} up backend

.PHONY: local-api
local-api: ## Run the FastAPI backend directly.
	cd backend && make local-api

.PHONY: build-dev
build-dev: ## Build containers for development.
	${DOCKER_COMPOSE_DEV} build

.PHONY: format
format: ## Format all code.
	@cd frontend && make format
	@cd backend && make format
