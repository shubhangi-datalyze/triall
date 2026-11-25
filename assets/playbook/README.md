# Playbook downloads

Files here are **not** served publicly. Anything in `public/` can be fetched by
URL, which would make a signed-in-only download meaningless. These are streamed
by `app/api/playbook/download/[id]/route.ts`, which checks the session first.

To add one:

1. Drop the file in this folder.
2. Add an entry to `PLAYBOOK_DOWNLOADS` in `lib/playbook/downloads.ts`.

The downloads page lists only entries whose file is actually on disk, so an
entry added before its file exists is invisible rather than a broken link.

`next.config.ts` traces this folder into the deployment, so files here ship.
