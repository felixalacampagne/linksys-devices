// Original linksysdevlst.js script converted to compile as 'typescript'
//
// Should be possible to run using command line like:
// node --experimental-strip-types linksysdevlst.ts
// probably needs the rest of the content of the directory to work.
// Alternative command line is:
// npx tsx script.ts

import console from 'console';
import * as fs from 'fs';
import * as path from 'path';

// --- CONFIGURATION ---

// Configuration
// Temporary solution to avoid hard coding sensitive info in the source file: read env.vars.
// from a local file
process.loadEnvFile("./linksysdevlst.env");
const ROUTER_IP = process.env.ROUTERIP ? process.env.ROUTERIP.trim() : '';
const USERNAME = process.env.ROUTERUSER ? process.env.ROUTERUSER.trim() : '';
const PASSWORD = process.env.ROUTERPWD ? process.env.ROUTERPWD.trim() : '';
const DATADIR = process.env.DATADIR ? process.env.DATADIR.trim() : '';
const POLL_INTERVAL_MS = process.env.POLLINTERVAL ? parseInt(process.env.POLLINTERVAL) : 10000;  // Poll every 10 seconds

const JNAP_URL = `http://${ROUTER_IP}/JNAP/`;
const JNAP_ACTION_PREFIX = 'http://linksys.com/jnap/';

const OUTPUT_FILE = path.join(DATADIR, 'network_devices.json');

interface JnapResponse<T = any> {
  output?: T;
}

// {   "macAddress": "04:0E:3C:22:30:11",
//     "ipAddress": "192.168.18.25",
//     "description": "chunkyeth"
// }
interface Reservation {
  macAddress: string;
  ipAddress: string;
  description: string;
}

interface LanSettingsOutput {
  dhcpSettings?: {
    reservations?: Reservation[];
  };
}

// {
//     "deviceID": "33573f16-e953-4425-93cc-983e933e6353",
//     "lastChangeRevision": 593224,
//     "model": {
//         "deviceType": ""
//     },
//     "unit": {
//     },
//     "isAuthority": false,
//     "friendlyName": "Linda’s MacBook Air",
//     "knownMACAddresses": [
//         "1E:E5:18:CD:BC:F4",
//         "EE:A7:D3:E3:B3:88"
//     ],
//     "connections": [
//         {
//             "macAddress": "1E:E5:18:CD:BC:F4",
//             "ipAddress": "192.168.18.26",
//             "ipv6Address": "fe80:0000:0000:0000:0048:73cf:977e:37ba"
//         }
//     ],
      // "properties": [
      //     {
      //         "name": "userDeviceName",
      //         "value": "Tapa Camera C51A"
      //     },
      //     {
      //         "name": "userDeviceType",
      //         "value": "wemo-netcam"
      //     }
      // ],
//     "maxAllowedProperties": 16
// }
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
  MAC_Address: string;
  Name?: string;
  IP_Address?: string;
  Reserved?: string;
  Comment?: string;
}

interface RawDevice {
  macAddress: string;
  name?: string;
  ipAddress?: string;
  reserved?: boolean;
  comment?: string;
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
function sortObjectsByIP(array: any , ipProperty: string, ascending = true) {
  // IP to number conversion
  const ipToNum = (ipString: string) => {
    if (!ipString || !ipString.includes('.')) return 0; // Return 0 for invalid IPs
    const parts = ipString.split('.').map(Number);
    return ((parts[0]??0) << 24) | ((parts[1]??0) << 16) | ((parts[2]??0) << 8) | (parts[3]??0);
  };

  // Create a shallow copy to avoid mutating the original array
  return [...array].sort((itemA, itemB) => {
    const ipA = ipToNum(itemA[ipProperty]);
    const ipB = ipToNum(itemB[ipProperty]);

    return ascending ? ipA - ipB : ipB - ipA;
  });
}


async function getConnectedDevices() : Promise<RawDevice[]> {
  try {

    // The token should just be the Basic auth credentials each time
    const authToken = 'Basic ' + btoa(`${USERNAME}:${PASSWORD}`);

    // Step 2: Fetch connected devices
    console.log('Fetching connected devices...');
    const devicesResult = await sendJnapRequest('devicelist/GetDevices', {}, authToken)  as JnapResponse<DevicesOutput>;
    //console.log('Devices...');
    //console.log(JSON.stringify(devicesResult, null, 3));
    const devices = devicesResult.output?.devices || [];


    // Step 3: Fetch DHCP reservations
    const dhcpResult = await sendJnapRequest('router/GetLANSettings', {}, authToken) as JnapResponse<LanSettingsOutput>;
    // console.log('DHCP reservations...');
    // console.log(JSON.stringify(dhcpResult, null, 3));

    const reservations = dhcpResult.output?.dhcpSettings?.reservations || [];
    // console.log(reservations);

    // Create a Set of reserved MAC addresses for fast lookup
    const reservedMacs = new Map(
      reservations
        .filter((reservation: Reservation) => reservation.macAddress?.trim() && reservation.ipAddress?.trim())
        .map((reservation: Reservation) => [reservation.macAddress?.toUpperCase(), reservation])
    );

    // Step 4: Combine and format the data

    // TODO: The 'Device' may contain multiple mac addresses and no IP address. When there is a DHCP reservation
    // for the MAC address the assigned IP address should be used and the 'description' of the reservation field should be
    // used for the name.
    // Not sure how to handle the case where there are
    // multiple MAC addresses for a single device. For now, just use the first MAC address.
    // When no DHCP reservation is found for the first MAC address then use the first IP address found in the
    // connections array, and user custom name or the friendlyName. If no IP address is found then use 'N/A' for the IP address.
    const formattedDevices = devices
    .filter(device => device.knownMACAddresses
                   && device.knownMACAddresses.length > 0
                   && device.knownMACAddresses[0]
                   && device.knownMACAddresses[0] != '')  // Filter out devices without known MAC addresses
    .map(device => {
      if (!device.knownMACAddresses || device.knownMACAddresses.length === 0 || !device.knownMACAddresses[0]) {
        // This should never happen with the filter
        console.warn(`Device with friendlyName "${device.friendlyName}" has no known MAC address. Skipping.`);
        return null; // Skip this device
      }
      // Find the first available IPv4 connections
      const ipv4Connection = device.connections?.find(conn => conn.ipAddress && !conn.ipAddress.includes(':'));
      let ipAddress = ipv4Connection ? ipv4Connection.ipAddress : '';
      const macAddress = device.knownMACAddresses ? (device.knownMACAddresses[0]?? '').toUpperCase() || '' : '';
      if(macAddress === '') {
        console.warn(`Device with friendlyName "${device.friendlyName}" has no known MAC address. Skipping.`);
        return null; // Skip this device
      }
      // console.log(`Processing device: MAC=${macAddress}, IP=${ipAddress}, Name=${device.friendlyName}`);
      // Check if the MAC address exists in the DHCP reservations array
      const reservation = reservedMacs.get(macAddress);
      const hasReservation = !!reservation;
      let finalName = '';
      let comment: string | undefined = '';
      if(reservation)
      {
        finalName = reservation.description;
        ipAddress = reservation.ipAddress;  // Override IP address with the reserved one
        comment = extractCustomName(device);
      }
      else
      {
        finalName = extractCustomName(device);
      }

      return {   // RawDevice
        name: finalName,
        ipAddress: ipAddress,
        macAddress: macAddress,
        reserved: hasReservation, //  ? 'Yes' : 'No'
        comment: comment
      };
    });

    // Display the results in a clean table format
    const sortedDevices = sortObjectsByIP(formattedDevices, "ipAddress", true);
    console.log('Sorted RawDevices:');
    console.table(sortedDevices);
    return sortedDevices;

  }
  catch (error) {
    console.error('Error executing JNAP script:', JSON.stringify(error));
    return [];
  }

}
/**
 * Loads previously logged entries from the JSON flat file safely
 */
function loadExistingLog():SavedDevice [] {
  if (!fs.existsSync(OUTPUT_FILE)) {
    return [];
  }
  try {
    const rawData = fs.readFileSync(OUTPUT_FILE, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error('Could not parse existing log file. Starting fresh.');
    return [];
  }
}

async function checkRouterForChanges() {
const jnapDevices = await getConnectedDevices();
      const knownDevices : SavedDevice[] = loadExistingLog();
      let hasChanges = false;
      const timestamp = new Date().toISOString();

      for (const device of jnapDevices) {
        const mac = device.macAddress;
        const ip = device.ipAddress ?? 'unknown';
        const breserved = device.reserved ?? false;
        const hostname = device.name ?? 'Unknown Device';
        const comment = device.comment ?? '';

        if (!mac) continue;

        if (!knownDevices.find(d => d.MAC_Address === mac)) {
          // New device discovered! Add a record to our database.
          console.log(`[NEW DEVICE FOUND] Name: ${hostname} | IP: ${ip} | MAC: ${mac}`);
          knownDevices.push({
            MAC_Address: mac,
            IP_Address: ip,
            Name: hostname,
            Reserved: breserved ? "Y" : "",
            Comment: comment,
          });
          hasChanges = true;
        } else {
          // Device exists, check if properties changed
          const existing = knownDevices.find(d => d.MAC_Address === mac);
          const reserved = breserved ? "Y" : "";
          let hasNewChanges = false;
          if(existing)
          {
            if(existing.IP_Address !== ip)
            {
              existing.IP_Address = ip;
              hasNewChanges = true;
            }
            if(existing.Name?.toLowerCase() !== hostname.toLowerCase())
            {
              existing.Name = hostname;
              hasNewChanges = true;
            }
            if(existing.Reserved !== reserved)
            {
              existing.Reserved = reserved;
              hasNewChanges = true;
            }
            if((comment && (comment != existing.Comment)
                        && (comment.toLowerCase() != hostname.toLowerCase())))
            {
              existing.Comment = comment;
              hasNewChanges = true;
            }
            if (hasNewChanges)
            {
              console.log(`[UPDATE] ${existing.Name} (${mac}) -> IP: ${ip}, Reserved: ${reserved} Comment: ${comment}`);
              hasChanges = true;
            }
          }
        }
      }

      // Commit changes to disk immediately if something changed
      if (hasChanges) {
        // console.log("Changes detected, updating log file...", JSON.stringify(knownDevices, null, 2));
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(knownDevices, null, 2), 'utf-8');
        console.log(`Log successfully synchronized to disk at ${timestamp}`);
      }
}

// --- MAIN LOOP ---
async function pollLoop() {
  console.log(`Starting device monitoring log targeted at http://${ROUTER_IP}...`);

  while (true) {
    try {
      await checkRouterForChanges();
    } catch (err: any) {
      console.error(`Polling iteration encountered an error: ${err.message}`);
    }

    // Sleep before loop iteration continues
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
// Run the script
//getConnectedDevices();
//checkRouterForChanges();
// Run this instead to poll the router
pollLoop();
