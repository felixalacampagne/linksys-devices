// Original linksysdevlst.js script converted to compile as 'typescript'
//
// Should be possible to run using command line like:
// node --experimental-strip-types linksysdevlst.ts
// probably needs the rest of the content of the directory to work.
// Alternative command line is:
// npx tsx script.ts

import * as fs from 'fs';
import * as path from 'path';

// --- CONFIGURATION ---
const OUTPUT_FILE = path.join(__dirname, 'network_devices.json');
const POLL_INTERVAL_MS = 10000;  // Poll every 10 seconds

// Configuration
// Temporary solution to avoid hard coding sensitive info in the source file: read env.vars.
// from a local file
process.loadEnvFile("./linksysdevlst.env");
const ROUTER_IP = process.env.ROUTERIP ? process.env.ROUTERIP.trim() : '';
const USERNAME = process.env.ROUTERUSER ? process.env.ROUTERUSER.trim() : '';
const PASSWORD = process.env.ROUTERPWD ? process.env.ROUTERPWD.trim() : '';

const JNAP_URL = `http://${ROUTER_IP}/JNAP/`;
const JNAP_ACTION_PREFIX = 'http://linksys.com/jnap/';

interface JnapResponse<T = any> {
  output?: T;
}

interface Reservation {
  macAddress?: string;
  ipAddress?: string;
}

interface LanSettingsOutput {
  dhcpSettings?: {
    reservations?: Reservation[];
  };
}

interface Device {
  userChangedFriendlyName?: boolean;
  friendlyName?: string;
  properties?: Array<{ name?: string; value?: string }>;
  userGivenName?: string;
  customName?: string;
  modelNumber?: string;
  manufacturer?: string;
  connections?: Array<{ ipAddress?: string }>;
  knownMACAddresses?: string[];
}
interface DevicesOutput {
  devices?: Device[];
}

// This should match ExcelDevice from the GUI component
interface SavedDevice {
  macAddress: string;
  name?: string;
  ipAddress?: string;
  reserved?: string;
  comment?: string;
}

// This should match ExcelDevice from the GUI component
interface RawDevice {
  macAddress: string;
  name?: string;
  ipAddress?: string;
  reserved?: string;
}

// Helper to send JNAP POST requests
async function sendJnapRequest(action : string, payload = {}, authToken = '') {

  const response = await fetch(JNAP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-JNAP-Action': JNAP_ACTION_PREFIX + action,
      'X-JNAP-Authorization': authToken
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`JNAP request failed for ${action}: ${response.statusText}`);
  }
  return response.json();
}

// Helper function to dynamically locate the user-assigned custom name
function extractCustomName(device : Device) {
  // 1. Check if userChangedFriendlyName is true and friendlyName exists
  if (device.userChangedFriendlyName && device.friendlyName?.trim()) {
    return device.friendlyName.trim();
  }

  // 2. Scan the device.properties array if it exists (where the widget often maps custom names)
  if (Array.isArray(device.properties)) {
    // Check for explicit "name", "customName", or "userGivenName" keys
    const customNameProp = device.properties.find(p =>
      ['name', 'customname', 'usergivenname', 'userdevicename'].includes(p.name?.toLowerCase() ?? '')
    );
    if (customNameProp && customNameProp.value?.trim()) {
      return customNameProp.value.trim();
    }
  }

  // 3. Scan for any loose top-level properties or custom nested objects
  if (device.userGivenName?.trim()) return device.userGivenName.trim();
  if (device.customName?.trim()) return device.customName.trim();
  if (device.friendlyName?.trim()) return device.friendlyName.trim();

  // 4. Ultimate fallbacks if no custom name widget properties are found
  return device.modelNumber || device.manufacturer || 'Unknown Device';
}

/**
 * Sorts an array of objects numerically by an IPv4 address field.
 * @param {Array<Object>} array - The array of objects to sort.
 * @param {boolean} [ascending=true] - Sort direction.
 * @returns {Array<Object>} A new sorted array.
 */
function sortObjectsByIP(array: any , ascending = true) {
  // Helper function to convert an IPv4 string to a 32-bit integer
  const ipToLong = (ip: string) => {
    return ip.split('.').reduce((accumulator, octet) => {
      return (accumulator << 8) >>> 0;
    }, 0) + ip.split('.').reduce((acc, oct, i) => acc + parseInt(oct, 10) * Math.pow(256, 3 - i), 0);
  };

  // Cleaner approach for the IP to number conversion
  const ipToNum = (ipString: string) => {
    const parts = ipString.split('.').map(Number);
    return ((parts[0]??0) << 24) | ((parts[1]??0) << 16) | ((parts[2]??0) << 8) | (parts[3]??0);
  };

  // Create a shallow copy to avoid mutating the original array
  return [...array].sort((itemA, itemB) => {
    const ipA = ipToNum(itemA['IP Address']);
    const ipB = ipToNum(itemB['IP Address']);

    return ascending ? ipA - ipB : ipB - ipA;
  });
}


async function getConnectedDevices() : Promise<RawDevice[]> {
  try {

    // This is not required - the token should just be the Basic auth credentials each time
    //// Step 1: Authenticate with the router
    //console.log('Authenticating with router...');
    //const loginResult = await sendJnapRequest('core/Login', { username: USERNAME, password: PASSWORD });
    //
    //if (loginResult.output?.result !== 'OK') {
    //  throw new Error('Authentication failed. Check your password.');
    //}
    //const authToken = loginResult.output.authToken;

    //const authToken = 'Basic ' + Buffer.from(USERNAME + ":" + PASSWORD).toString('base64');
    const authToken = 'Basic ' + btoa(`${USERNAME}:${PASSWORD}`);
    // console.log(USERNAME + ":" + PASSWORD + "... Auth Token: " + authToken);

    // Step 2: Fetch connected devices
    console.log('Fetching connected devices...');
    const devicesResult = await sendJnapRequest('devicelist/GetDevices', {}, authToken)  as JnapResponse<DevicesOutput>;
    // console.log(devicesResult);
    const devices = devicesResult.output?.devices || [];
    // console.log('Devices...');
    // console.log(devices);

    // Step 3: Fetch DHCP reservations
    console.log('Fetching DHCP reservations...');
    const dhcpResult = await sendJnapRequest('router/GetLANSettings', {}, authToken) as JnapResponse<LanSettingsOutput>;
    //console.log(dhcpResult);

    const reservations = dhcpResult.output?.dhcpSettings?.reservations || [];
    //console.log('DHCP reservations...');
    //console.log(reservations);

    // Create a Set of reserved MAC addresses for fast lookup
    const reservedMacs = new Set(reservations.map(res => res.macAddress?.toUpperCase()));
    const reservedIpsByMac = new Map(
      reservations
        .filter((reservation: Reservation) => reservation.macAddress?.trim() && reservation.ipAddress?.trim())
        .map((reservation: Reservation) => [reservation.macAddress?.toUpperCase(), reservation.ipAddress?.trim()])
    );

    // Step 4: Combine and format the data
    console.log('\n--- Connected Devices Report ---');

    // TODO: There maybe multiple mac addresses here
    const formattedDevices = devices.map(device => {
      // Find the first available IPv4 connections
      const ipv4Connection = device.connections?.find(conn => conn.ipAddress && !conn.ipAddress.includes(':'));
      const ipAddress = ipv4Connection ? ipv4Connection.ipAddress : 'Offline';
      const macAddress = device.knownMACAddresses ? device.knownMACAddresses[0]?.toUpperCase() : 'N/A';
      // console.log("MAC: " + device.knownMACAddresses + ", " + macAddress);
      // Extract the correct name handling the widget property anomaly
      const finalName = extractCustomName(device);

      // Check if the MAC address exists in the DHCP reservations array
      const hasReservation = reservedMacs.has(macAddress);
      return {   // RawDevice
        name: finalName,
        ipAddress: ipAddress,
        macAddress: macAddress || 'N/A',
        reserved: hasReservation ? 'Yes' : 'No'
      };
    });


    // Display the results in a clean table format
    //console.table(formattedDevices);
    const sortedDevices = sortObjectsByIP(formattedDevices, true);
    console.table(sortedDevices);
    return sortedDevices;

  } catch (error: unknown) {
    console.error('Error executing JNAP script:', JSON.stringify(error));
    return [];
  }
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
      const jnapDevices = await getConnectedDevices();
      const knownDevices = loadExistingLog();
      let hasChanges = false;
      const timestamp = new Date().toISOString();

      for (const device of jnapDevices) {
        const mac = device.macAddress;
        const ip = device.ipAddress ?? 'unknown';
        const breserved = device.reserved ?? false;
        const hostname = device.name ?? 'Unknown Device';

        if (!mac) continue;

        if (!knownDevices[mac]) {
          // New device discovered! Add a record to our database.
          console.log(`[NEW DEVICE FOUND] Name: ${hostname} | IP: ${ip} | MAC: ${mac}`);
          knownDevices[mac] = {
            macAddress: mac,
            ipAddress: ip,
            name: hostname,
            reserved: breserved ? "Y" : "N"
          };
          hasChanges = true;
        } else {
          // Device exists, check if properties changed
          const existing = knownDevices[mac];
          const reserved = breserved ? "Y" : "N";

          if (existing.ipAddress !== ip || existing.name !== hostname || existing.reserved !== reserved) {
            console.log(`[UPDATE] ${hostname} (${mac}) -> IP: ${ip}, Reserved: ${reserved}`);
            existing.ipAddress = ip;
            existing.name = hostname;
            existing.reserved = reserved;
            hasChanges = true;
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
// Run the script
getConnectedDevices();

// Run this instead to poll the router
// pollLoop();
