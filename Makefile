
.PHONY: protos

build:
	npm ci

protos:
	rm -rf src/protos
	mkdir src/protos
	npx protoc --ts_opt long_type_string --ts_opt optimize_code_size --ts_out src/protos --ts_opt generate_dependencies -I node_modules/google-proto-files node_modules/google-proto-files/google/api/http.proto
