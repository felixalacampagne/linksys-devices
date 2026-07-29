// Original linksysdevlst.js script converted to compile as 'typescript'
//
// Should be possible to run using command line like:
// node --experimental-strip-types linksysdevlst.ts
// probably needs the rest of the content of the directory to work.
// Alternative command line is:
// npx tsx script.ts


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


async function getConnectedDevices() {
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

    const authToken = 'Basic ' + Buffer.from(USERNAME + ":" + PASSWORD).toString('base64');
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

      return {
        'Device Name': finalName,
        'IP Address': ipAddress,
        'MAC Address': macAddress || 'N/A',
        'DHCP Reservation': hasReservation ? 'Yes' : 'No'
      };
    });


    // Display the results in a clean table format
    //console.table(formattedDevices);
    console.table(sortObjectsByIP(formattedDevices, true));

  } catch (error: unknown) {
    console.error('Error executing JNAP script:', JSON.stringify(error));
  }
}

// Run the script
getConnectedDevices();
