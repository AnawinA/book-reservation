# Quick start — open the app on http://localhost:3000

Five steps, no configuration needed. Docker Desktop must be running.

## 1. Open a terminal in this folder

```bash
cd "D:\User D\Codes\WEBSITES\IT_KMITL_PROJECT\book reservation"
```

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
