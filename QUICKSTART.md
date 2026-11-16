# Quick start — open the app on http://localhost:3000

Five steps, no configuration needed. Docker Desktop must be running.

(Git Bash, PowerShell and CMD all work — see the note under step 3 for PowerShell.)

## 2. Start the stack on port 3000

```bash
PORT=3000 docker compose up -d --build
```

This builds the app image, starts MySQL (`bbs-db`) and the app (`bbs-app`), and publishes the app on **port 3000**.

> PowerShell: `$env:PORT=3000; docker compose up -d --build`
>
> The `PORT=3000` part matters: without it a `PORT` exported in your shell (for example `PORT=0`) makes Docker pick a random port, and the app shows up at something like `localhost:32769` instead.

## 3. Wait until both containers are healthy

```bash
docker compose ps
```

Continue when `bbs-db` and `bbs-app` both show `Up ... (healthy)`. This takes about 30–60 seconds the first time.

## 4. Open the site

**http://localhost:3000**

## 5. Log in

Use the login card on the home page (http://localhost:3000/) — there is no separate `/login` page.

| Account | Password | Sees |
| --- | --- | --- |
| `admin` | `Passw0rd!` | Administration |
| `owner_ladkrabang` | `Passw0rd!` | Shop 1 dashboard |
| `owner_siam` | `Passw0rd!` | Shop 2 dashboard |
| `alice` | `Passw0rd!` | Customer dashboard (starts with 120 points) |
| `bob` | `Passw0rd!` | Customer dashboard |

The catalog at http://localhost:3000/ is public — no login needed.

---

## Day-to-day commands

```bash
PORT=3000 docker compose up -d      # start again (no rebuild)
docker compose stop                 # stop, keep the data
docker compose logs -f app          # follow the app log (Ctrl+C to exit)
docker compose down                 # stop and remove the containers (data stays)
```

## If it does not work

**Port 3000 is already in use** — something else is bound to it:

```bash
docker compose down
PORT=3000 docker compose up -d
```

Still busy? Find the offender with `netstat -ano | findstr :3000` (the last column is the PID).

**Log says `Waiting for database...`** — MySQL is not reachable yet or is rejecting the login:

```bash
docker compose logs --tail=30 db
```

**Health check** to confirm the app and its DB connection in one call:

```bash
curl http://localhost:3000/api/health
```

Expected: `{"success":true,"data":{"db":"up",...}}`

**A different port than 3000 in `docker compose ps`** — a `PORT` variable is set in your shell. Check with `echo $PORT`; then re-run step 2.

---

## Check the database

The credentials live in the container environment, so the commands below need no password from you.

**Is the app connected to MySQL?**

```bash
curl http://localhost:3000/api/health
```

`"db":"up"` means the app is talking to MySQL.

**Run any SQL** — pipe it in, so no nested quotes are needed (this works in PowerShell, CMD and Git Bash alike):

```bash
echo "SHOW TABLES;" | docker compose exec -T db sh -c 'mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
```

```bash
echo "SELECT COUNT(*) FROM users;" | docker compose exec -T db sh -c 'mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
```

**Interactive MySQL prompt** — open a shell in the container, then start `mysql` inside it (again no quoting to get wrong):

```bash
docker compose exec db bash
```

```bash
mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"
```

Now type `SHOW TABLES;`, `SELECT id,username,role,points FROM users;`, then `exit` twice.

> **PowerShell users:** do not put `-e "…"` inside the `sh -c '…'` string. PowerShell strips those inner double quotes, `mysql` receives `-e SHOW TABLES;` and answers `ERROR 1064 (42000) … near ''`. The `echo "…" |` form above avoids the problem completely.

**GUI client** (DBeaver, TablePlus, HeidiSQL, MySQL Workbench): host `127.0.0.1`, port `3307`, database `book_borrowing`, user `bbs_user`, password = the `DB_PASSWORD` value in `.env`.

**Re-seed an empty database:**

```bash
docker compose exec app node scripts/seed.js
```

It prints `Seed skipped: users table already has data` when the data is already there, so it is safe to run.

```powershell
echo "SHOW TABLES;" | docker compose exec -T db sh -c 'mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
```

```powershell
echo "SELECT COUNT(*) FROM users;" | docker compose exec -T db sh -c 'mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
```