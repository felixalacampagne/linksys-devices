export const environment = {
   production: false,

   envName: ' DEV',
   uiversion: ' v0.1',
   // When folder starts with '/'
   // data file url is constructed from: api_host + folder + api_app + datafilename + api_ext
   // eg. http://host/data/devices.json
   // When folder does not start with '/'
   // data file url is constructed from: api_host + derived application path + folder + api_app + datafilename + api_ext
   // eg. http://host/linksysdevices/data/devices.json

   api_host: "", // "http://localhost:4200", // "",
   folder: 'data',
   api_app: "/",
   api_ext: '.json'
 };