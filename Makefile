.PHONY: dev fmt lint test

dev:
	@echo "TODO: tauri dev"

fmt:
	cargo fmt --all

lint:
	cargo clippy --workspace --all-targets -- -D warnings

test:
	cargo test --workspace
