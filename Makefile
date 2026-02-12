.PHONY: dev fmt lint test check

dev:
	cargo run --manifest-path src-tauri/Cargo.toml

fmt:
	cargo fmt --all

lint:
	cargo clippy --workspace --all-targets -- -D warnings

test:
	cargo test --workspace

check:
	cargo check --workspace
	cargo check --manifest-path src-tauri/Cargo.toml
