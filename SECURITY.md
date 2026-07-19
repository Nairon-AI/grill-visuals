# Security

Do not report secrets in a public issue. Contact the repository maintainers privately through the Nairon AI organization.

Grill Visuals is local-first. Treat every Cloudflare Pages link as public unless the developer's own Cloudflare account applies access controls. Never place credentials in diagram JSON, rendered HTML, manifests, chat, or source control.

`share --public` creates a uniquely named Pages project owned by that session and writes its IDs to the gitignored local sharing ledger. `unshare --yes` refuses to delete any project without that ownership record. Public pages send `X-Robots-Tag: noindex, nofollow` and a restrictive robots file; these reduce discovery but do not provide authentication.

The click-to-publish path runs only through a temporary server bound to the loopback interface. Its publish endpoint requires same-origin requests and a random per-process token. The static Pages deployment does not include this endpoint. Wrangler credentials remain in Wrangler's supported user store and never enter the page, session JSON, local ledger, or repository.

V1 links are public to anyone who has the URL. The share flow publishes the whole session even when its returned URL opens one question. The confirmation flow must make that scope clear.

Before every upload, scan the complete rendered session. High-confidence credentials hard-block publishing. Lower-confidence matches remain visible warnings and require explicit developer review before override. The confirmation shows the real question count, active question, and changes; every included title remains available in an expandable full review. A passing scan does not mean the content is safe: the developer remains responsible for private customer, company, operational, and repository context that does not look like a secret.

Preflight Wrangler authentication before opening the publishing viewer. Never copy its credentials into a handoff. A `pass` handoff may contain only the non-secret Pages project, deployment, and URL ownership receipt. `pickup` must show those targets, verify the receiving developer's Cloudflare access, verify the page contains the expected session marker, and obtain explicit confirmation before importing them. Reject mismatches. Cloudflare authorization still decides whether the receiving developer may update or remove that page.

V1 pages do not expire automatically. The confirmation must say they remain public until an authorized developer explicitly unshares them.

Choose and remember a Cloudflare account per session, and show its identity in every publish confirmation. Changing destination accounts is explicit. One public session owns one Pages project; warn near the provider's project limit and never remove older sessions automatically.

An upload that may have reached Cloudflare but cannot be verified is a potentially public session, not an ordinary failure. Preserve its project and URLs and expose Verify again and Unshare until reconciled.
