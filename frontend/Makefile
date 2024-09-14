.PHONY: client
client:
	rm -f openapi.json
	curl http://api.localhost/openapi.json -o openapi.json
	node modify-openapi-operationids.js
	npm run generate-client


.PHONY: format
format:
	npx biome format --write ./src
