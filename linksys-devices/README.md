# LinksysDevices

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.2.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Linksys JNAP Router Access

This app uses a proxy-only request model for Linksys JNAP access. The browser never calls the router directly.

This is because the browser blocks the calls to the router due to the absence of CORS headers in the response from the router.
There is nothing that can be done about this without modifying the server code which is
obviously not possible and completely absurd - such is the nature of continuous improvement.

All JNAP requests are routed through the configured application proxy path, and the router IP is defined by the server-side proxy configuration.

## Local Dev-Server Proxy

The Angular dev server includes a proxy configuration at `proxy.conf.js`.
When the app is served with `ng serve`, requests to `/JNAP/` are forwarded to the router target configured in that file.

The proxy target can be configured from an environment variable in `.env`:

```dotenv
PROXY_TARGET=192.168.0.1
```

The value is read by `proxy.conf.js` at startup, so you can change the router target without editing the proxy config itself.

The PROXY_TARGET variable can also be set via the normal environment variable command before starting `ng serve`.

## Production Apache reverse proxy

A production Apache virtual host can serve the Angular application from the `/linksys` path prefix and reverse-proxy the JNAP API to the router.

The example configuration is available in `apache-linksys-vhost.conf` and is tuned to the new path-aware behavior:

- the app is hosted at `http://hostname/linksys/`
- static files are served from the built Angular output under `/linksys/`
- `/linksys/JNAP/` is passed through to the router through the configured server-side proxy rule
- `/linksys` is redirected to `/linksys/` so the Angular base path resolves correctly


## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
