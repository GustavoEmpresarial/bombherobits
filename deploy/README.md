# Production deployment

Current target: http://5.189.157.88.

Active release: 20261020-hero-carousel, deployed October 20, 2026. Production smoke tests passed for API health/configuration, closed login, closed whitelist, creator validation, PostgreSQL persistence, retry deduplication and private admin access. Disposable test records were removed. The existing domain and direct port 5000 returned their original BlockMiner pages after activation.

Initial database backup: /opt/herobits/shared/initial-deployment.dump. Edge proxy backup: /opt/herobits/shared/edge-nginx-before.conf. The current release symlink is /opt/herobits/current.

The application runs as a separate Docker Compose project, with its own PostgreSQL volume. The existing edge proxy routes only the bare IP on port 80 to this app. Existing domain routes and the existing direct port 5000 service are preserved.

Source releases: /opt/herobits/releases/.
Server-only environment: /opt/herobits/shared/.env (mode 600).
Private admin recovery file: /opt/herobits/shared/admin-access.txt (mode 600).
Neither file belongs in a source archive or frontend build.

Build with deploy/Dockerfile and deploy/compose.yml. The frontend uses VITE_API_URL=/api. The API and database have no published host ports; only the web container joins the existing edge network.

Run Prisma migrate deploy before starting the new API. Do not run the development seed on an existing production database.

Game access and whitelist submissions remain closed by default. BMINER_EARLY_ACCESS_OPEN and BMINER_WHITELIST_OPEN are separate controls; approved whitelist status is still required to play once early access opens.

An IP deployment currently uses the HTTP address provided by the owner. A domain and HTTPS configuration can be added separately. Do not change other projects' TLS or domain routes.

For an update, create a new release directory and image tag, back up PostgreSQL, build and migrate, then recreate the app services. Preserve the shared environment and database volume. Keep previous images and the proxy backup for rollback; schema rollback requires checking migration compatibility.
