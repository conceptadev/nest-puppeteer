# Releasing

Releases use Changesets and npm trusted publishing. No long-lived npm token is stored in GitHub.

## One-time npm setup

`@concepta/puppeteer-nest` is a new npm package name. A Concepta maintainer must bootstrap it
once before OIDC can take over:

```bash
pnpm run verify
npm publish --access public
```

Then configure the trusted GitHub publisher from an authenticated npm CLI:

```bash
npm trust github @concepta/puppeteer-nest \
  --repo conceptadev/nest-puppeteer \
  --file release.yml \
  --environment release \
  --allow-publish
```

The repository already has a `release` GitHub environment, and the workflow grants only the
permissions needed to create release pull requests, tags, releases, and OIDC identity tokens.

## Normal release flow

1. Add a changeset with `pnpm changeset` in each pull request that changes the published API.
2. Merge the pull request into `main`.
3. The release workflow opens or updates the Changesets release pull request.
4. Merge the release pull request. The same workflow verifies and publishes the package through
   npm OIDC, then reconciles the Git tag and GitHub release.

The guarded `pnpm run release` command refuses to publish outside GitHub Actions on `main`, from a
dirty checkout, or from a commit that does not match the workflow SHA.
