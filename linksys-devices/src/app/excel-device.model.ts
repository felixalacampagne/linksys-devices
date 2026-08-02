// From linksysdevlst.ts
//interface SavedDevice {
//   MAC_Address: string;
//   Name?: string;
//   IP_Address?: string;
//   Reserved?: boolean;
//   Comment?: string;
//   offline?: boolean;
// }

interface ExcelDevice {
  macAddress: string;
  name?: string;
  ipAddress?: string;
  reserved?: boolean;
  comment?: string;
  offline?: boolean;
}