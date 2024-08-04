.PHONY: client
client:
	rm -f openapi.json
	wget http://localhost/api/v1/openapi.json
	node modify-openapi-operationids.js
	npm run generate-client
