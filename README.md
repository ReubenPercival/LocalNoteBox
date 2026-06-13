# LocalNoteBox

> Lightweight self-hosted notes app — no dependencies, no build step, no npm ( actually no just FUCK npm. Npm is an awful thing and is like 99% malware) .

## Quick start

```bash
./start.sh
# → http://localhost:4040
```

Or directly:

```bash
node server.js
```

## Features

- **Notes** — create, edit, delete with Markdown live preview
- **Tags** — organize and filter notes by tag
- **Search** — full-text search across titles and content
- **Import / Export** — portable JSON backup
- **Encrypted sync** — push/pull encrypted blobs to the server (PBKDF2 + AES-256-GCM, passphrase-derived key)
- **Client-side encryption** — the server only ever sees ciphertext
- **Zero dependencies** — pure Node.js built-in modules, no npm required

## Sync

The sync endpoint (`/api/sync`) stores encrypted blobs on the server. The server never decrypts — encryption/decryption happens entirely in the browser.

Open the Sync modal in the app, set a passphrase and the server URL, then push or pull.

## License

European Union Public Licence v1.2 — see [LICENSE](LICENSE).
