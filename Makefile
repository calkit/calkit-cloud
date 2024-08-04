.PHONY: api-dev
api-dev:
	docker compose -f docker-compose.yml -f docker-compose.override.yml up backend
