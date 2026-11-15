# e-BusPass: Node.js + MySQL setup

## 1. Start XAMPP
- Start Apache and MySQL in XAMPP Control Panel.
- Confirm phpMyAdmin opens at http://localhost/phpmyadmin.
- Create/select the database `ebuspass` and import `database/ebuspass.sql` if the nine tables have not already been created.

## 2. Install dependencies
Open a terminal in this project folder and run:

```bash
npm install
```

The project uses the `mysql2` package.

## 3. MySQL settings
The default connection settings are for a standard XAMPP installation:
- Host: `127.0.0.1`
- Port: `3306`
- User: `root`
- Password: empty
- Database: `ebuspass`

If your MySQL root account has a password or uses another port, set these environment variables before starting Node:

```powershell
$env:DB_HOST="127.0.0.1"
$env:DB_PORT="3306"
$env:DB_USER="root"
$env:DB_PASSWORD="your_mysql_password"
$env:DB_NAME="ebuspass"
```

Do not put a real database password in source code or share it in screenshots.

## 4. Start the application

```bash
npm start
```

Then open http://localhost:3000.

Demo accounts:
- Passenger: `passenger@demo.in` / `demo123`
- Depot staff: `depot@demo.in` / `depot123`
- Conductor: `conductor@demo.in` / `cond123`

## Notes
- The frontend remains in `public/` and is served by the Node.js server.
- MySQL stores application data. Uploaded files remain in the local `uploads/` folder; their paths are stored in MySQL.
- The adapter loads the existing application data model into memory and writes a database snapshot after API requests. This is suitable for a classroom/demo project, not a high-traffic production deployment.
- This package does not automatically import an old `data/db.json` file. Keep a backup of any old JSON data before switching.
- Demo seed records are inserted only when the `users` table is empty.
