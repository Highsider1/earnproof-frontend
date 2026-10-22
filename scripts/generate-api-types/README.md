Generated API types live in `lib/api/generated/`. They are produced from
`lib/api/openapi/earnproof-api.v1.json` and must never be copied over
hand-authored UI models.

```bash
npm run generate:api-types
npm run generate:api-types -- --check
```
