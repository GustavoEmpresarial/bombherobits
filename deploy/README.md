# Production deployment

Current targets: http://5.189.157.88 and http://bombherobits.pro (HTTPS activates after public DNS propagation).

Active release: 20261020-hero-carousel, deployed October 20, 2026. Production smoke tests passed for API health/configuration, closed login, closed whitelist, creator validation, PostgreSQL persistence, retry deduplication and private admin access. Disposable test records were removed. The existing domain and direct port 5000 returned their original BlockMiner pages after activation.

Initial database backup: /opt/herobits/shared/initial-deployment.dump. Edge proxy backup: /opt/herobits/shared/edge-nginx-before.conf. The current release symlink is /opt/herobits/current.

The application runs as a separate Docker Compose project, with its own PostgreSQL volume. The existing edge proxy routes the bare IP and bombherobits.pro on port 80 to this app. Other domain routes and the existing direct port 5000 service are preserved.

Source releases: /opt/herobits/releases/.
Server-only environment: /opt/herobits/shared/.env (mode 600).
Private admin recovery file: /opt/herobits/shared/admin-access.txt (mode 600).
Neither file belongs in a source archive or frontend build.

Build with deploy/Dockerfile and deploy/compose.yml. The frontend uses VITE_API_URL=/api. The API and database have no published host ports; only the web container joins the existing edge network.

Run Prisma migrate deploy before starting the new API. Do not run the development seed on an existing production database.

Game access and whitelist submissions remain closed by default. BMINER_EARLY_ACCESS_OPEN and BMINER_WHITELIST_OPEN are separate controls; approved whitelist status is still required to play once early access opens.

## Domain and HTTPS

`bombherobits.pro` has a dedicated edge virtual host (`/root/blockminer-dev/nginx/includes/herobits-domain.conf`). HTTP serves the application and the ACME webroot. Existing projects retain their own routes and certificates.

At setup on October 20, 2026, Google and Cloudflare public DNS returned NXDOMAIN. The registrar must publish/delegate the domain and its root A record must resolve to `5.189.157.88`. No certificate has been issued while DNS is unavailable.

`herobits-domain-setup.timer` checks public DNS every five minutes. Once both resolvers return the expected A address, `ensure-domain-https.sh` requests a Let's Encrypt certificate, activates `domain-https.conf`, updates the private server environment's WEB_ORIGIN, recreates the API and reloads the web upstream. It verifies HTTPS API health before disabling its bootstrap timer. Failed ACME requests have a one-hour cooldown.

Certbot's regular timer handles renewals. Its deploy hook, `/opt/herobits/shared/renew-domain.sh`, copies only this domain's certificate into the edge's mounted SSL directory, tests Nginx and reloads it. Certificate keys and ACME account files remain server-only. No email address was supplied for the ACME account.

Diagnostics: `systemctl status herobits-domain-setup.timer certbot.timer`, `journalctl -u herobits-domain-setup.service`, and `certbot certificates`. Templates and scripts are stored alongside this README; installed copies live in `/opt/herobits/shared`. Edge backups created before domain setup are named `edge-before-domain-*.conf` there.

For an update, create a new release directory and image tag, back up PostgreSQL, build and migrate, then recreate the app services. Preserve the shared environment and database volume. Keep previous images and the proxy backup for rollback; schema rollback requires checking migration compatibility.
