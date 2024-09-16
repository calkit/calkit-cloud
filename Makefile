DOCKER_COMPOSE_DEV=docker compose -f docker-compose.yml -f docker-compose.override.yml

.PHONY: api-dev
api-dev:
	${DOCKER_COMPOSE_DEV} up backend

.PHONY: local-api
local-api:
	cd backend && make local-api

.PHONY: dev
dev:
	${DOCKER_COMPOSE_DEV} up

.PHONY: build-dev
build-dev:
	${DOCKER_COMPOSE_DEV} build
