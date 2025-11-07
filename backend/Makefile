.PHONY: test
test:
	docker compose exec backend bash ./scripts/test.sh

.PHONY: format
format:
	@echo "🚀 Formatting backend"
	@uv run ruff format
