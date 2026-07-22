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

This app queries a Linksys router directly from the browser using the `http://<router-ip>/JNAP/` endpoint.

The router must support CORS for this to work. The required response headers are:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, X-JNAP-Action, X-JNAP-Authorization`

If requests fail, confirm that your router firmware is configured to allow browser-originated JNAP requests and that the target IP is reachable from the browser.

Since there is no control over what the router supports it is highly unlikely that the
required CORS settings will be present. I am currently unaware of any browser client based workaround for this. The only solution appears to be to have some sort of 'backend' to
make the request which does not have the ludricous restrictions that apply to the browser.

## Local Dev-Server Proxy

The Angular dev server now includes a proxy configuration at `proxy.conf.js`.
When the app is served with `ng serve`, requests to `/JNAP/` are forwarded to the router target configured in that file.

The proxy target can be configured from an environment variable in `.env`:

```dotenv
PROXY_TARGET=192.168.18.1
```

The value is read by `proxy.conf.js` at startup, so you can change the router target without editing the proxy config itself.

The PROXY_TARGET variable can also be set via the normal environment variable command before starting 'ng serve'.

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
