import * as fs from 'fs';
import * as path from 'path';

// --- CONFIGURATION ---
const ROUTER_IP = '192.168.1.1'; // Update to your Linksys gateway IP
const OUTPUT_FILE = path.join(__dirname, 'network_devices.json');
const POLL_INTERVAL_MS = 10000;  // Poll every 10 seconds

// --- INTERFACES ---
interface JnapDevice {
  deviceID: string;
  description: string;
  connections: Array<{
    ipAddress: string;
    macAddress: string;
    isConnected: boolean;
    networkInterface: string;
  }>;
  // JNAP provides additional details like model, OS, and friendly names
  [key: string]: any;
}

interface SavedDevice {
  macAddress: string;
  ipAddress: string;
  hostname: string;
  firstSeen: string;
  lastSeen: string;
  status: 'online' | 'offline';
}

// --- HELPER FUNCTIONS ---

/**
 * Fetches the entire device registry from the Linksys JNAP API
 */
async function fetchLinksysDevices(routerIp: string): Promise<JnapDevice[]> {
  const url = `http://${routerIp}/JNAP/`;

  // JNAP requests expect a POST body containing an array of actions
  const payload = [
    {
      action: "http://linksys.com",
      request: {
        sinceRevision: 0 // Fetch all records
      }
    }
  ];

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // The X-JNAP-Action header tells the router which service to execute
      'X-JNAP-Action': 'http://linksys.com'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Router API responded with HTTP status ${response.status}`);
  }

  const data: any = await response.json();

  // Extract devices from the specific response wrapper block
  if (data?.responses?.[0]?.output?.devices) {
    return data.responses[0].output.devices;
  }

  return [];
}

/**
 * Loads previously logged entries from the JSON flat file safely
 */
function loadExistingLog(): Record<string, SavedDevice> {
  if (!fs.existsSync(OUTPUT_FILE)) {
    return {};
  }
  try {
    const rawData = fs.readFileSync(OUTPUT_FILE, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error('Could not parse existing log file. Starting fresh.');
    return {};
  }
}

// --- MAIN LOOP ---
async function pollLoop() {
  console.log(`Starting device monitoring log targeted at http://${ROUTER_IP}...`);

  while (true) {
    try {
      const jnapDevices = await fetchLinksysDevices(ROUTER_IP);
      const knownDevices = loadExistingLog();
      let hasChanges = false;
      const timestamp = new Date().toISOString();

      for (const device of jnapDevices) {
        // Fallback checks because devices can have multiple network cards/interfaces
        const primaryConn = device.connections?.[0];
        const mac = primaryConn?.macAddress || device.deviceID;
        const ip = primaryConn?.ipAddress || 'unknown';
        const isOnline = primaryConn?.isConnected ?? false;
        const hostname = device.description || 'Unknown Device';

        if (!mac) continue;

        if (!knownDevices[mac]) {
          // New device discovered! Add a record to our database.
          console.log(`[NEW DEVICE FOUND] Name: ${hostname} | IP: ${ip} | MAC: ${mac}`);
          knownDevices[mac] = {
            macAddress: mac,
            ipAddress: ip,
            hostname: hostname,
            firstSeen: timestamp,
            lastSeen: timestamp,
            status: isOnline ? 'online' : 'offline'
          };
          hasChanges = true;
        } else {
          // Device exists, check if properties changed
          const existing = knownDevices[mac];
          const newStatus = isOnline ? 'online' : 'offline';

          if (existing.ipAddress !== ip || existing.status !== newStatus || existing.hostname !== hostname) {
            console.log(`[UPDATE] ${hostname} (${mac}) -> IP: ${ip}, Status: ${newStatus}`);
            existing.ipAddress = ip;
            existing.status = newStatus;
            existing.hostname = hostname;
            existing.lastSeen = timestamp;
            hasChanges = true;
          } else if (isOnline) {
            // Keep alive timestamp tracking
            existing.lastSeen = timestamp;
          }
        }
      }

      // Commit changes to disk immediately if something changed
      if (hasChanges) {
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(knownDevices, null, 2), 'utf-8');
        console.log(`Log successfully synchronized to disk at ${timestamp}`);
      }

    } catch (err: any) {
      console.error(`Polling iteration encountered an error: ${err.message}`);
    }

    // Sleep before loop iteration continues
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// Execute script
pollLoop();
