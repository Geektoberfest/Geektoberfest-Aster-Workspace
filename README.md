# Aster

Aster is a personal, Notion-inspired workspace built with React, Express, MongoDB, and Tiptap. It supports nested pages, rich text editing, favorites, search, trash and restore, dark mode, and automatic saving.

Collaboration, sharing, comments, and team permissions are intentionally out of scope for this version.

## Features

- JWT authentication with an HTTP-only cookie
- Nested pages with breadcrumbs and a collapsible sidebar tree
- Tiptap editor with headings, lists, task lists, quotes, code, links, images, colors, and slash commands
- Image uploads (PNG, JPEG, WebP up to 5 MB) from the `/` menu, stored on the server and visible only to their owner
- Debounced, serialized autosave with visible save status
- Search across page titles and plain-text content
- Favorites, duplicate, soft delete, restore, permanent delete, and empty trash
- Responsive layout with a mobile sidebar drawer
- Persisted light and dark themes

## Requirements

- Node.js 18.11 or newer
- npm
- MongoDB running locally or an accessible MongoDB Atlas database

## Install

From the repository root:

```bash
npm run install:all
```

Create the server environment file:

```bash
cp server/.env.example server/.env
```

Set `MONGO_URI` and replace `JWT_SECRET` with a long random value in `server/.env`.

## Run Locally

Start both applications:

```bash
npm run dev
```

The client runs at <http://localhost:5173> and the API runs at <http://localhost:5001>.

To run them separately:

```bash
npm run dev:server
npm run dev:client
```

Register a user at the client URL. A new account receives a seeded `Getting Started` page.

## Environment Variables

The server reads these variables from `server/.env`:

| Variable | Description | Default |
| --- | --- | --- |
| `PORT` | API port | `5001` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/aster-workspace` |
| `JWT_SECRET` | Secret used to sign session tokens | Required |
| `JWT_EXPIRES_IN` | Token lifetime, such as `7d` or `12h` | `7d` |
| `CLIENT_URL` | Comma-separated allowed browser origins | `http://localhost:5173` |
| `NODE_ENV` | Set to `production` to enable secure cookies | `development` |
| `UPLOAD_DIR` | Directory where uploaded images are stored | `server/uploads` |

Optional Vite variables:

- `VITE_API_URL`: API base URL when the client is not using the development proxy.
- `VITE_PROXY_TARGET`: API target for the Vite `/api` proxy. Defaults to `http://localhost:5001`.

## Scripts

Run these from the repository root unless noted otherwise:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start client and server together |
| `npm run dev:client` | Start Vite only |
| `npm run dev:server` | Start Express only |
| `npm run build` | Create a production client build |
| `npm run lint --prefix client` | Lint the frontend |
| `npm test` | Run the backend test suite |
| `npm run start --prefix server` | Start the API in production mode |

## Running Tests

The backend has an automated test suite (Vitest + Supertest) covering authentication, pages, ownership rules, trash, and search. From the repository root:

```bash
npm test
```

Or from `server/`:

```bash
npm test              # run once
npm run test:watch    # re-run on file changes
```

- Tests need **no setup**: no `server/.env`, no MongoDB install, and no accounts. They run against a throwaway in-memory MongoDB and never read `MONGO_URI`, so they cannot touch your real data.
- The first run downloads a MongoDB binary (a few hundred MB) and caches it; later runs reuse it. To use a binary you already have, set `MONGOMS_SYSTEM_BINARY` to its path.
- Each test file gets its own database and every collection is emptied after each test, so the suite can be run repeatedly.
- Tests live in `server/tests/`. Use the helpers in `tests/helpers.js` (`createUser`, `createPage`) to create an authenticated user and pages.

## API Overview

All API responses use `{ success, data?, message? }`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/register` | Register and seed a welcome page |
| `POST` | `/api/auth/login` | Log in |
| `POST` | `/api/auth/logout` | Clear the session cookie |
| `GET` | `/api/auth/me` | Get the current user |
| `GET` | `/api/pages` | List active pages |
| `GET` | `/api/pages/search?q=...` | Search active pages |
| `GET` | `/api/pages/trash` | List trashed pages |
| `DELETE` | `/api/pages/trash` | Empty the trash |
| `GET` | `/api/pages/:id` | Get one page |
| `POST` | `/api/pages` | Create a page |
| `PUT` | `/api/pages/:id` | Update title, icon, or content |
| `PATCH` | `/api/pages/:id/favorite` | Toggle favorite |
| `PATCH` | `/api/pages/:id/restore` | Restore a page subtree |
| `POST` | `/api/pages/:id/duplicate` | Duplicate a page |
| `DELETE` | `/api/pages/:id` | Move a page subtree to trash |
| `DELETE` | `/api/pages/:id/permanent` | Permanently delete a page subtree |
| `POST` | `/api/uploads` | Upload an image (`multipart/form-data`, field `image`; PNG, JPEG or WebP, max 5 MB) |
| `GET` | `/api/uploads/:id` | Fetch an uploaded image (owner only) |

## Architecture

- `client/` contains the Vite React application, Zustand stores, Tiptap editor, and API services.
- `server/` contains the Express API, Mongoose models, authentication middleware, and page controllers.
- Pages are stored as a flat collection with a `parentPage` reference. The client renders the tree; the server handles descendant operations.
- Editor content is stored as Tiptap JSON. A plain-text projection is maintained for search snippets.
- Every page query is scoped to the authenticated owner.
- Uploaded images are validated by their actual bytes (not just the file name or type), saved under random names through `server/src/services/storage.js`, and served only to the user who uploaded them. That module is the single place to change to move from local disk to S3, Cloudinary or similar.

## Verification Checklist

After starting MongoDB and running the app, verify:

1. `GET http://localhost:5001/api/health` returns `{ "success": true, "data": { "status": "ok" } }`.
2. Registration lands on the seeded welcome page.
3. Login, logout, expired sessions, and wrong-password errors behave correctly.
4. Creating, renaming, nesting, favoriting, duplicating, deleting, restoring, and permanently deleting pages works.
5. Slash commands, rich formatting, checklist items, image URLs, and autosave work after a reload.
6. Search returns title and content matches without a request for every keystroke.
7. The mobile sidebar, theme toggle, loading states, empty states, and retry state render correctly.
8. `npm run lint --prefix client` and `npm run build` pass.

## Deliberate Future Work

Real-time collaboration, sharing and permissions, databases, drag-and-drop ordering, version history, file uploads, offline sync, and Markdown export are not included in the current release.

## Contributing

Contributions, issues, and feature requests are welcome!

For a detailed setup guide, coding conventions, architectural breakdown, and pull request workflow, please check out the [Contributing Guidelines](CONTRIBUTING.md).
