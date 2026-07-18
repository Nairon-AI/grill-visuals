# Grill Visuals

Beautiful, interactive diagrams for Grill Me sessions.

> Experimental scaffold. No renderer or npm release exists yet. Grill Me still uses Sideshow until this project passes the gates in [SPEC.md](./SPEC.md).

## V1 scope

Seven built-in families only:

1. architecture / flow
2. sequence
3. state
4. mind map
5. timeline
6. quadrant
7. comparison

Agents provide strict JSON. Grill Visuals owns layout, styling, interaction, accessibility, and text alternatives. Agent-authored HTML or JavaScript is never executed.

Local rendering will be the default. Public Cloudflare Pages deployment will require an explicit `share`; `unshare` will remove the session content safely.

## Scaffold

```bash
node ./bin/grill-visuals.mjs families
node ./bin/grill-visuals.mjs init --session checkout-migration
node ./bin/grill-visuals.mjs validate --input example.json
npm test
```

`families`, `init`, and the versioned document-envelope validator work now. `upsert`, `render`, `open`, `share`, and `unshare` deliberately fail with an experimental-status message until their proof gates land.

## License

Apache-2.0. See [LICENSE](./LICENSE).
