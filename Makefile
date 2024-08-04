.PHONY: api-dev
api-dev:
	docker compose -f docker-compose.yml -f docker-compose.override.yml up backend

.PHONY: local-api
local-api:
	cd backend && make local-api
