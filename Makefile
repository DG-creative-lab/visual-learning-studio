.PHONY: ci

ci:
	CI=true pnpm install --frozen-lockfile
	CI=true pnpm check
	CI=true pnpm build
