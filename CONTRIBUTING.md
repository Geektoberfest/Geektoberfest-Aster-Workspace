# Contributing to Aster

Thank you for your interest in contributing to Aster! This guide is designed to help you get started quickly and ensure a smooth, enjoyable collaboration process.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Project Architecture](#project-architecture)
- [Local Development Setup](#local-development-setup)
- [Development Workflow](#development-workflow)
- [Coding Guidelines](#coding-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Questions or Need Help?](#questions-or-need-help)

---

## Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for everyone. Please be respectful, considerate, and constructive in all interactions across issues, pull requests, and discussions.

---

## How Can I Contribute?

You can contribute to Aster in various ways:

- **Reporting Bugs:** Open an issue detailing the bug, environment, and clear steps to reproduce.
- **Suggesting Features:** Propose ideas or enhancements through GitHub Issues.
- **Fixing Issues:** Pick up existing open issues or bug reports.
- **Improving Documentation:** Clarify setup guides, add code comments, or improve README descriptions.
- **Code Refactoring & Testing:** Add test coverage or refactor modules for maintainability.

> **Note on Project Scope:**  
> Real-time collaboration, public sharing, and workspace-level permissions are intentionally out of scope for the core version. Please check the [Deliberate Future Work](README.md#deliberate-future-work) section before proposing major architecture changes.

---

## Project Architecture

Aster is a monorepo consisting of two primary packages:

```text
aster-workspace/
├── client/          # Vite + React 18 frontend
│   ├── src/
│   │   ├── components/  # Reusable UI & editor components (Tiptap, Sidebar, Modals)
│   │   ├── hooks/       # Custom React hooks (keyboard shortcuts, autosave, debounce)
│   │   ├── layouts/     # Main app and authentication layouts
│   │   ├── pages/       # Route-level components (Login, Register, Workspace)
│   │   ├── services/    # Axios HTTP client and API endpoints
│   │   ├── store/       # Zustand state management (authStore, pageStore, uiStore)
│   │   └── utils/       # Formatting, tree transformations, helpers
├── server/          # Node.js + Express backend
│   ├── src/
│   │   ├── config/      # Database connection & environment configuration
│   │   ├── controllers/ # Request handlers (auth, pages, trash)
│   │   ├── middleware/  # Auth verification (JWT), error handlers
│   │   ├── models/      # Mongoose schemas (User, Page)
│   │   ├── routes/      # Express API route declarations
│   │   ├── services/    # Business logic & subtree traversal
│   │   └── utils/       # Token helpers, response formatters
```

---

## Local Development Setup

### Prerequisites

- **Node.js**: `v18.11` or higher
- **npm**: `v9` or higher
- **MongoDB**: Local MongoDB instance (`mongodb://127.0.0.1:27017`) or a MongoDB Atlas connection URI

### Step-by-Step Installation

1. **Fork and Clone the Repository**
   ```bash
   git clone https://github.com/<your-username>/aster-workspace.git
   cd aster-workspace
   ```

2. **Install Dependencies**
   Install all root, client, and server dependencies in one command:
   ```bash
   npm run install:all
   ```

3. **Configure Environment Variables**
   Copy the example environment configuration in `server/`:
   ```bash
   cp server/.env.example server/.env
   ```
   Open `server/.env` and update the parameters as needed:
   ```env
   PORT=5001
   MONGO_URI=mongodb://127.0.0.1:27017/aster-workspace
   JWT_SECRET=your_super_secret_key_change_in_dev_at_least_32_chars
   JWT_EXPIRES_IN=7d
   CLIENT_URL=http://localhost:5173
   NODE_ENV=development
   ```

4. **Start the Application**
   Run both backend and frontend concurrently:
   ```bash
   npm run dev
   ```
   - **Client**: [http://localhost:5173](http://localhost:5173)
   - **Server / API**: [http://localhost:5001](http://localhost:5001)
   - **Health Check**: [http://localhost:5001/api/health](http://localhost:5001/api/health)

   To run services individually:
   ```bash
   npm run dev:server   # Starts Express server with node --watch
   npm run dev:client   # Starts Vite development server
   ```

---

## Development Workflow

1. **Create a New Branch**
   Always create a descriptive branch off of `main`:
   ```bash
   git checkout -b feat/add-page-export
   # or
   git checkout -b fix/editor-focus-issue
   ```

2. **Make Changes & Test Locally**
   - Test your changes directly in the UI.
   - Verify that responsive design remains intact.
   - Ensure the light/dark themes are both supported.

3. **Run Linting & Build Checks**
   Before committing, verify that there are no lint or compilation errors:
   ```bash
   # Lint client code
   npm run lint --prefix client

   # Test production build
   npm run build

   # Run the backend tests (in-memory MongoDB, no setup needed)
   npm test
   ```

   If you change the API, add or update tests in `server/tests/`. See [Running Tests](README.md#running-tests).

---

## Coding Guidelines

### Frontend (`client/`)
- **React & Components**:
  - Use functional components with hooks.
  - Keep components modular and single-responsibility.
  - Reusable UI elements go in `client/src/components/common/`.
- **State Management**:
  - Use Zustand stores (`store/`) for global state (active page, navigation state, user session).
  - Use component local state (`useState`) for transient, component-only logic (e.g., dropdown open/close).
- **Styling**:
  - Use Tailwind CSS utility classes and preserve consistent theme variables.
  - Ensure dark mode variants (`dark:...`) are provided for new UI components.
- **Icons**:
  - Use [Lucide React](https://lucide.dev/) icons for consistency with the rest of the application.

### Backend (`server/`)
- **Architecture**:
  - Keep routes simple and delegate business logic to controllers/services.
  - Validate incoming request parameters and payloads.
  - All responses must follow the standard envelope:
    ```json
    {
      "success": true,
      "data": {},
      "message": "Optional feedback"
    }
    ```
- **Error Handling**:
  - Forward errors to the centralized error-handling middleware via `next(err)`.
  - Avoid unhandled promise rejections.
- **Security & Scope**:
  - Every database query for pages must be scoped to the authenticated `req.user._id`.

---

## Commit Guidelines

We recommend following the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation only changes
- `style:` Changes that do not affect the meaning of the code (formatting, missing semi-colons, etc.)
- `refactor:` A code change that neither fixes a bug nor adds a feature
- `perf:` A code change that improves performance
- `test:` Adding missing tests or correcting existing tests
- `chore:` Changes to the build process, dependency updates, or auxiliary tools

*Example:* `feat(editor): add keyboard shortcut for page duplication`

---

## Submitting a Pull Request

1. Push your branch to your GitHub fork:
   ```bash
   git push origin feat/your-feature-name
   ```
2. Open a Pull Request (PR) against the `main` branch of Aster.
3. Fill out the PR description template:
   - **Summary of Changes**: What does this PR do?
   - **Motivation / Context**: Why is this change needed? (Link related issues if applicable)
   - **Testing Done**: How did you verify the changes?
   - **Screenshots / GIFs**: If applicable for UI changes.
4. Respond to feedback or requested changes during review. Once approved, your PR will be merged!

---

## Questions or Need Help?

Feel free to open an issue or ask in discussions if you have questions or encounter any blockers while setting up Aster. We're happy to help!
