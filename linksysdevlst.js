// Configuration
// Temporary solution to avoid hard coding sensitive info in the source file: read env.vars.
// from a local file
process.loadEnvFile("./linksysdevlst.env");
const ROUTER_IP = process.env.ROUTERIP.trim();
const USERNAME = process.env.ROUTERUSER.trim();
const PASSWORD = process.env.ROUTERPWD.trim();

const JNAP_URL = `http://${ROUTER_IP}/JNAP/`;
const JNAP_ACTION_PREFIX = 'http://linksys.com/jnap/';
// Helper to send JNAP POST requests
async function sendJnapRequest(action, payload = {}, authToken = '') {

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
function extractCustomName(device) {
  // 1. Check if userChangedFriendlyName is true and friendlyName exists
  if (device.userChangedFriendlyName && device.friendlyName?.trim()) {
    return device.friendlyName.trim();
  }

  // 2. Scan the device.properties array if it exists (where the widget often maps custom names)
  if (Array.isArray(device.properties)) {
    // Check for explicit "name", "customName", or "userGivenName" keys
    const customNameProp = device.properties.find(p => 
      ['name', 'customname', 'usergivenname', 'userdevicename'].includes(p.name?.toLowerCase())
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
    const devicesResult = await sendJnapRequest('devicelist/GetDevices', {}, authToken);
    // console.log(devicesResult);
    const devices = devicesResult.output?.devices || [];
    // console.log('Devices...');
    // console.log(devices);
    
    // Step 3: Fetch DHCP reservations
    console.log('Fetching DHCP reservations...');
    const dhcpResult = await sendJnapRequest('router/GetLANSettings', {}, authToken);
    //console.log(dhcpResult);
    
    const reservations = dhcpResult.output?.dhcpSettings.reservations || [];
    //console.log('DHCP reservations...');
    //console.log(reservations);
    
    // Create a Set of reserved MAC addresses for fast lookup
    const reservedMacs = new Set(reservations.map(res => res.macAddress?.toUpperCase()));

    // Step 4: Combine and format the data
    console.log('\n--- Connected Devices Report ---');
    
    const formattedDevices = devices.map(device => {
      // Find the first available IPv4 connections
      const ipv4Connection = device.connections?.find(conn => conn.ipAddress && !conn.ipAddress.includes(':'));
      const ipAddress = ipv4Connection ? ipv4Connection.ipAddress : 'Offline';
      const macAddress = device.knownMACAddresses ? device.knownMACAddresses[0].toUpperCase() : 'N/A';
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
    console.table(formattedDevices);

  } catch (error) {
    console.error('Error executing JNAP script:', error.message);
  }
}

// Run the script
getConnectedDevices();
