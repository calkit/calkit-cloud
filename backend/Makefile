.PHONY: local-api
local-api:
	python app/backend_pre_start.py \
		&& alembic upgrade head \
		&& python app/initial_data.py \
		&& uvicorn --reload app.main:app

.PHONY: test
test:
	docker compose exec backend bash ./scripts/test.sh
