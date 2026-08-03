
export interface NetworkDevice {
  macAddress: string;
  name?: string;
  ipAddress?: string;
  reserved?: boolean;
  comment?: string;
  offline?: boolean;
}