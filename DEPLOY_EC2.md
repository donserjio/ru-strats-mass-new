# EC2 Docker Deployment

This project can be deployed on EC2 with Docker and auto-deployed from GitHub on each push to `main`.

## 1) Server bootstrap (one-time)

Install Docker and Docker Compose plugin on the EC2 host.

Example deploy path:

- `/opt/iq-fund-app`

Make sure the SSH user used by GitHub Actions can:

- access the deploy path
- run `docker compose` (usually via `docker` group)
- clone/pull your repository over SSH

## 2) GitHub Actions secrets

Create these repository secrets:

- `EC2_HOST` - public IP or hostname
- `EC2_USER` - SSH username
- `EC2_SSH_KEY` - private key content (PEM)
- `EC2_PORT` - optional SSH port, default `22`
- `EC2_DEPLOY_PATH` - e.g. `/opt/iq-fund-app`
- `EC2_REPO_SSH_URL` - e.g. `git@github.com:org/repo.git`
- `EC2_DEPLOY_BRANCH` - optional, default `main`
- `GHCR_USERNAME` - GitHub username that can pull from GHCR
- `GHCR_READ_TOKEN` - GitHub token/PAT with `read:packages`

Workflow file: `.github/workflows/deploy-ec2.yml`.

## 3) Runtime layout

Production compose file binds the app only on localhost:

- host `127.0.0.1:5005` -> container `5000`

File: `docker-compose.prod.yml`

This is suitable for reverse proxying via Nginx on the same server.

## 4) Nginx reverse proxy example

```
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 5) Local manual production  test

```
APP_IMAGE=ghcr.io/<owner>/<repo>:latest docker compose -f docker-compose.prod.yml up -d
curl -I http://127.0.0.1:5005
```
