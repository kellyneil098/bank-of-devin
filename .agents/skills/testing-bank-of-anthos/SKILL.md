---
name: testing-bank-of-anthos
description: How to write/run unit tests and run a live regression for the Bank of Anthos (bank-of-devin) microservices. Use for the Unit Test Coverage Sweep playbook and any task that adds tests to a service or verifies the running app on minikube.
---

# Testing Bank of Anthos (bank-of-devin)

## Service map

| Compliance category | Service | Language | Path |
|---|---|---|---|
| transaction-processing | ledgerwriter | Java | `src/ledger/ledgerwriter/` |
| authentication | userservice | Python | `src/accounts/userservice/` |
| pii-handling | contacts | Python | `src/accounts/contacts/` |
| audit-logging | transactionhistory | Java | `src/ledger/transactionhistory/` |
| (n/a) | balancereader | Java | `src/ledger/balancereader/` |

Frontend (Python/Flask) lives in `src/frontend/`. Language rule of thumb: `src/accounts/*` = Python, `src/ledger/*` = Java.

## Python unit tests (userservice / contacts)

Conventions (REQUIRED):
- Tests live in `<service>/tests/`; use `unittest` + pytest.
- Use `setUp()` + helpers from `tests/constants.py` (JWT keys, example requests). Do NOT use `conftest.py`.
- Mock `UserDb`/the DB layer and patch `userservice.userservice.open` with `mock_open(read_data=PRIVATE_KEY_PEM)` so the app can load its RS256 signing key. Set `app.config["PUBLIC_KEY"] = EXAMPLE_PUBLIC_KEY` to verify issued JWTs.
- App is a Flask factory: `from userservice.userservice import create_app`.

A prebuilt venv `~/venv-userservice` is created by the repo blueprint maintenance step (pytest/pytest-cov from `requirements.txt` + pylint). Run from the service dir:

```bash
cd src/accounts/userservice
source ~/venv-userservice/bin/activate
python -m pytest --cov=userservice --cov-report=term-missing -v -p no:warnings
```

Lint (config is the repo-root `.pylintrc`, per `skaffold.yaml`):

```bash
cd src/accounts/userservice && pylint --rcfile=../../../.pylintrc *.py
```

If the venv is missing (older snapshot), recreate it: `python3 -m venv ~/venv-userservice && ~/venv-userservice/bin/pip install -r src/accounts/userservice/requirements.txt pylint` (system python3 is 3.12.8, matching the service).

userservice endpoints: `/version`, `/ready`, `POST /users` (create_user), `GET /login` (returns `{token}` JWT). Login returns 404 (unknown user), 401 (bad password), 200 (+JWT). create_user returns 400 (password mismatch / bad input) and 409 (duplicate username) before writing.

## Java unit tests (ledgerwriter / transactionhistory / balancereader)

- Tests under `src/test/java/`; JUnit 5 + Mockito; JaCoCo for coverage.
- Run: `cd <service> && mvn clean test`; coverage report at `target/site/jacoco/jacoco.csv` after `mvn clean verify`.
- Do NOT use `@SpringBootTest` — keep them as focused unit tests with mocked collaborators.

## Live regression on minikube

Deploy the full app (no GCP creds available, so tracing MUST be off):

```bash
minikube start --driver=docker --cpus=2 --memory=6144 --disk-size=30g
kubectl apply -f ./extras/jwt/jwt-secret.yaml
kubectl apply -f ./kubernetes-manifests
for d in balancereader contacts frontend ledgerwriter transactionhistory userservice; do
  kubectl set env deployment/$d ENABLE_TRACING=false
done
kubectl delete deployment loadgenerator    # frees CPU; otherwise pods stay Pending (Insufficient cpu)
```

### CRITICAL: rolling-update CPU deadlock
The VM has 2 CPUs (~2000m). After `kubectl set env`, the default rollout strategy tries to surge a new pod before removing the old one, but there isn't enough CPU, so new pods stay `Pending` and old ones may `CrashLoopBackOff` (tracing-enabled) — the rollout deadlocks. Fix by forcing in-place replacement on every redeployed deployment:

```bash
for d in balancereader contacts frontend ledgerwriter transactionhistory userservice; do
  kubectl patch deployment $d -p '{"spec":{"strategy":{"rollingUpdate":{"maxSurge":0,"maxUnavailable":1}}}}'
done
kubectl wait --for=condition=ready pod --all --timeout=300s
kubectl port-forward svc/frontend 8080:80 &
```

App uses ~2.4 GB steady state. All 8 pods should reach `Running 1/1`: accounts-db-0, balancereader, contacts, frontend, ledger-db-0, ledgerwriter, transactionhistory, userservice.

### Browser flow
- Open `http://localhost:8080` — always type the FULL `http://` scheme in the address bar; a dropped colon (`localhost8080`) yields DNS_PROBE_FINISHED_NXDOMAIN.
- Demo credentials are pre-filled on the login page: username `testuser`, password `bankofanthos` (local demo data, not a secret).
- If the browser can't reach `localhost:8080`, the port-forward died — re-run `kubectl port-forward svc/frontend 8080:80 &`.
- Maximize the window before recording: `sudo apt-get install -y wmctrl 2>/dev/null; wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz`.

### Frontend auth flow (what to assert)
- `/` and `/home` are auth-gated by `verify_token`; unauthenticated requests redirect to `/login`.
- `GET /login` renders the SIGN IN page; a failed login redirects to `/login?msg=Login+Failed` and shows a red "Login failed." banner.
- Successful login lands on `/home` with a "Checking Account" heading, a dollar balance, and a transaction-history table with Credit (green `+$`) and Debit (red `-$`) rows.
- `POST /logout` clears the token cookie and redirects to `/login`.
- Balances/amounts are stored in cents server-side but displayed as dollars (a $5.00 payment sends `amount: 500`).
- "Send Payment" shows internal contacts (`is_external=false`); "Deposit Funds" shows external contacts (`is_external=true`).

### Cleanup (always)
```bash
kubectl delete -f ./kubernetes-manifests
minikube stop
```

## CI / checks
- No GitHub Actions run on PR-open. `.github/workflows/coverage-pipeline.yml` triggers only on PR close/merge, a daily schedule, or manual dispatch, and its Python coverage step is `continue-on-error`.
- The only PR check is **Devin Review**. Don't wait for Actions on PR-open.
