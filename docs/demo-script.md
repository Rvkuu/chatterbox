# Chatterbox demo script

A short, repeatable walk through everything Chatterbox does, for an investor or any first-time audience. It takes about 10 minutes. Every step says what to do and what the audience should see, so a second person can run it from scratch and tick each line.

## Before the demo (once, about 5 minutes the first time)

1. Docker Desktop is running.
2. In the repository folder, create the settings file and a secret (details in the README, "Quick start"):
   ```bash
   cp .env.example .env
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Paste the printed value into `.env` as `SESSION_SECRET=...`.
3. Start from an empty database, so the demo always begins the same way. **This deletes any stored data**:
   ```bash
   docker compose down -v
   docker compose up -d --build
   ```
4. Wait until `docker compose ps` shows `db`, `api` and `web` as `healthy`.
5. Open **http://localhost:8080** in a normal browser window, and have a second, private (incognito) window ready.

**Expected:** the page shows the title **Chatterbox**, the message "No posts yet. Log in to write the first one.", and at the bottom `API status: ok`.

## The demo

### 1. A visitor can read, but not write
- Look at the page without logging in.
- **Expected:** the feed area says there are no posts yet. There is **no** place to write a post. Only **Log in** and **Register** are offered.

### 2. Register an account
- Click **Register**. Click **Create account** with the form empty.
- **Expected:** each field shows a message: the email is required, the username must be 3 to 30 characters, the password must be 12 to 128 characters.
- Fill in `ada@example.com`, `ada_l` and the password `correct horse battery staple`. Click **Create account**.
- **Expected:** the **Log in** form appears with the note "Account created. Please log in." and the email already filled in. Registering does not log you in by itself.

### 3. Log in (and what a wrong password shows)
- Type a wrong password and click **Log in**.
- **Expected:** one message, "Email or password is incorrect." It is the same message whether the email exists or not, so nobody can use the form to find out who has an account.
- Type the right password and click **Log in**.
- **Expected:** the header says **Signed in as ada_l** with a **Log out** button, and a box to write a post appears.

### 4. Write a post
- Click **Post** with the box empty.
- **Expected:** "Write something first." and nothing is sent.
- Write `Hello, Chatterbox!` and click **Post**.
- **Expected:** the post appears at the top of the feed at once, showing the author `ada_l`, the text, and the date and time. The box empties.
- Optional: paste more than 280 characters. **Expected:** the counter turns red and the post is refused with a message.

### 5. A second person shares the same feed
- In the **private window**, open http://localhost:8080.
- **Expected:** this visitor, who is not logged in, already sees Ada's post.
- Register and log in as `grace@example.com`, `grace_h`, password `another long test passphrase`. Write `Grace here too`.
- **Expected:** Grace's post appears **above** Ada's (newest first), each under the right name. Switch to the first window and reload: it shows the same two posts in the same order.

### 6. Logging out really ends the session
- In Ada's window click **Log out**.
- **Expected:** the post box disappears and **Log in** and **Register** return. Reload the page: Ada is still logged out.

### 7. Your data survives restarts
Run these in a terminal while the page is open. Log in as Ada again first if you logged out.
- **Restart the containers:**
  ```bash
  docker compose restart
  ```
  Wait until `docker compose ps` shows everything healthy, then reload the page.
  **Expected:** Ada is **still logged in** (the login lives in the database, not in the server's memory), and both posts are still there.
- **Take the stack down and bring it back** (the data volume is kept):
  ```bash
  docker compose down
  docker compose up -d
  ```
  **Expected:** after it is healthy and you reload, both posts are still there. Log in again if asked.

### 8. The page copes when the server is unavailable (optional)
- Stop only the API: `docker compose stop api`. Reload the page.
- **Expected:** the feed shows an error message with a **Try again** button, and the rest of the page still works.
- Start it again: `docker compose start api`, wait a few seconds, and click **Try again**.
- **Expected:** the feed loads again.

### 9. Reset (optional, destructive)
- To show that the data really lives in the volume: `docker compose down -v` then `docker compose up -d`. **Expected:** the feed is empty again. **This deletes all stored data**, and is the only command here that does.

## If something goes wrong

| What you see | What to do |
|---|---|
| The page does not load | Run `docker compose ps`. If a service is not healthy, run `docker compose logs api` |
| The `api` container keeps stopping | `SESSION_SECRET` in `.env` is still the placeholder. Put the generated secret in and run `docker compose up -d` |
| Logging in or posting says the request could not be verified | Open the page as `http://localhost:8080`, not `127.0.0.1` |
| Port 8080 is busy | Set `WEB_PORT=8081` in `.env`, run `docker compose up -d`, and open http://localhost:8081 |

More in the README ("Running with Docker").
