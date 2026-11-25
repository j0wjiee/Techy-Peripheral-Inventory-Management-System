# Techy Peripheral Inventory Management System

A React and Express application for tracking computer peripherals. MongoDB Atlas stores accounts, inventory and activity history. Item images are stored in the project’s local `uploads/` folder.

The React pages, styles, HTML entry point and Vite configuration live in `frontend/`. The Express API, shared validation rules and MongoDB schema live in `backend/`. Prisma reads `backend/prisma/schema.prisma`. Run npm commands from the repository root, where the package manifest, local environment file and uploads directory belong.

## Run on another computer

### 1. Install Git and Node.js

Install [Git](https://git-scm.com/downloads) and [Node.js](https://nodejs.org/en/download) with npm. Node.js 22 is a suitable starting point for the versions pinned in this project. Open a new terminal after installation. On Windows, use PowerShell and check that all three commands print version numbers.

```powershell
git --version
node --version
npm.cmd --version
```

### 2. Clone the repository

Open the folder where you want to keep the project, then run these commands. Run the remaining commands from the cloned folder, which contains `package.json`.

```powershell
git clone https://github.com/j0wjiee/Techy-Peripheral-Inventory-Management-System.git
cd Techy-Peripheral-Inventory-Management-System
```

### 3. Prepare MongoDB Atlas

1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com/) and open or create a project. Create a cluster if you are setting up your own database.
2. Open the cluster’s **Connect** dialog. Create a database user with read and write access to `techy_inventory`. Save its username and password.
3. Add the new computer’s current public IP address to the project's IP access list.
4. Choose **Drivers → Node.js** and copy the connection string. Use the cluster hostname supplied by Atlas. See the [Atlas connection guide](https://www.mongodb.com/docs/atlas/driver-connection/).

For a shared inventory, ask the database owner to grant access to the existing cluster. A separate cluster gives you an empty inventory.

### 4. Create the local environment file

Create a file named `.env` beside `package.json`. On Windows, run `notepad .env` and confirm creation. Make sure the filename is exactly `.env`, including the leading dot. Enter these settings, replacing the first value with your actual Atlas URI.

```dotenv
DATABASE_URL="mongodb+srv://USERNAME:PASSWORD@CLUSTER_HOST/techy_inventory?retryWrites=true&w=majority"
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173
```

Use your Atlas **database user** credentials. Encode reserved password characters in the URI (for example, `@` becomes `%40`). Keep the database name after the hostname and before the question mark. Save the file locally and keep its contents private.

### 5. Install dependencies and initialize the database

```powershell
npm.cmd ci
npm.cmd run db:generate
npm.cmd run db:push
```

The first command installs the versions in the lockfile. The second generates Prisma Client. The third connects to the configured database and creates or synchronizes the collections and indexes. Check that Prisma reports the intended database before accepting any schema changes.

### 6. Start the application

```powershell
npm.cmd run dev
```

Wait for the API to report that it is listening on port 3001 and for Vite to print its local address. Keep that terminal open and visit **http://localhost:5173**.

On macOS, use `npm` in place of `npm.cmd`. On Linux, complete steps 1–5 using `npm`, then start the API with `npm start` and run `npm run dev:web` in a second terminal from the same project folder.

### 7. Verify the installation

Register an account on a fresh database, or sign in with your existing application account on a shared database. Open **Add New Item**, enter an item name, category and quantity, and save it. Open **Inventory**, refresh the page and confirm the item is still there. The dashboard should reflect the quantity you entered.

If you are moving an existing installation, copy its `uploads/` folder privately into the cloned project to display previously uploaded images. On a fresh installation, the API creates this folder on the first upload.

### 8. Stop and restart

Press **Ctrl+C** in the development terminal to stop the servers. For later sessions, open the cloned folder and run `npm.cmd run dev`. To inspect the database, run `npm.cmd run db:studio` in a separate terminal and open the URL it prints. The production frontend build command is `npm.cmd run build`.

## Common startup issues

| Symptom | What to check |
|---|---|
| Git cannot find the repository | Verify the clone URL and that your GitHub account has access. |
| MongoDB connection fails | Check the Atlas hostname, database username, encoded password and current public IP access entry. |
| Port 3001 or 5173 is in use | Stop the existing project terminal with Ctrl+C and start the app once. |
| Login reports an origin error | Open http://localhost:5173 and check that the local frontend origin in `.env` matches. |
