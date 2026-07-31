To run typescript files from the command line Google suggested the following:
npm init -y
npm install -D typescript @types/node tsx
npx tsc --init

and created a script: poll-router.ts

NB I already had linksysdevlst.js which I had renamed to linksysdev.ts. The generated
package.json referenced main.js which I changed to linksysdev.ts - don't really know
whether this is necessary.

To execute the script without compiling into a standalone file:

node --experimental-strip-types linksysdevlst.ts

To make standalone file

npm install -D tsup

Add following line to 'scripts' in package.json

"build": "tsup poll-router.ts --format cjs --minify --clean --platform node"

To build the standalone file

npm run build

Generates .js file in 'dist'. To run use

node dist/script.js

To run in Docker:

dockerfile:
# Use a lightweight Node.js runtime environment
FROM node:22-alpine

# Set a secure working directory
WORKDIR /app

# Copy ONLY the single bundled JavaScript file
COPY dist/poll-router.js ./

# Run the script when the container starts
CMD ["node", "poll-router.js"]

To build and run the container:
docker build -t linksys-poller .
docker run -d --name router-monitor --restart unless-stopped linksys-poller


To pass env vars as docker properties
use docker-config.yaml
version: '3.8'

services:
  linksys-poller:
    image: linksys-poller
    container_name: router-monitor
    restart: unless-stopped
    environment:
      - ROUTER_IP=192.168.1.254

For docker change output path to an absolute value, eg. const OUTPUT_FILE = '/data/network_devices.json';
Dockerfile must create the directory, eg.

FROM node:22-alpine

WORKDIR /app

# Create a dedicated directory to receive the volume mount
RUN mkdir /data

COPY dist/poll-router.js ./

CMD ["node", "poll-router.js"]

In the docker-compose file map a direcotry to the volume

version: '3.8'

services:
  linksys-poller:
    image: linksys-poller
    container_name: router-monitor
    restart: unless-stopped
    environment:
      - ROUTER_IP=192.168.1.254
    volumes:
      # Maps a local folder to the container's output directory
      - ./log-data:/data

Google also suggest the following which might be handy...
To make sure this script continues running smoothly over time, let me know:
Do you want to add Console Timestamp Logging to monitor container resource health and view exact tracking statuses via docker logs router-monitor?
Should we build a basic JSON log rotation or backup safety flag so the single database file doesn't grow indefinitely if you have hundreds of rotating network clients?

