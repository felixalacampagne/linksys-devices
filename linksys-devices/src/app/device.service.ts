import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface DeviceRow {
  deviceName: string;
  ipAddress: string;
  macAddress: string;
  dhcpReservation: 'Yes' | 'No';
}

interface JnapResponse<T = any> {
  output?: T;
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

interface Reservation {
  macAddress?: string;
}

interface LanSettingsOutput {
  dhcpSettings?: {
    reservations?: Reservation[];
  };
}

interface DevicesOutput {
  devices?: Device[];
}

@Injectable({ providedIn: 'root' })
export class DeviceService {
  constructor(private http: HttpClient) {}

  /**
   * Build the JNAP URL from the router IP and normalize the value.
   */
  private buildRouterUrl(routerIp: string): string {
    const sanitized = routerIp
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '');

    return `http://${sanitized}/JNAP/`;
  }

  private buildAuthToken(username: string, password: string): string {
    return 'Basic ' + btoa(`${username.trim()}:${password}`);
  }

  private createHeaders(action: string, authToken: string): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'X-JNAP-Action': `http://linksys.com/jnap/${action}`,
      'X-JNAP-Authorization': authToken
    });
  }

  private extractCustomName(device: Device): string {
    if (device.userChangedFriendlyName && device.friendlyName?.trim()) {
      return device.friendlyName.trim();
    }

    if (Array.isArray(device.properties)) {
      const customNameProp = device.properties.find((prop) =>
        ['name', 'customname', 'usergivenname', 'userdevicename'].includes(
          prop.name?.toLowerCase() ?? ''
        )
      );
      if (customNameProp?.value?.trim()) {
        return customNameProp.value.trim();
      }
    }

    if (device.userGivenName?.trim()) {
      return device.userGivenName.trim();
    }

    if (device.customName?.trim()) {
      return device.customName.trim();
    }

    if (device.friendlyName?.trim()) {
      return device.friendlyName.trim();
    }

    return device.modelNumber || device.manufacturer || 'Unknown Device';
  }

  private ipToNumber(ip: string): number {
    if (!ip || ip === 'Offline') {
      return Number.MAX_SAFE_INTEGER;
    }

    const parts = ip.split('.').map((segment) => Number(segment) || 0);
    return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
  }

  async fetchConnectedDevices(
    routerIp: string,
    username: string,
    password: string,
    useProxy: boolean
  ): Promise<DeviceRow[]> {
    const url = useProxy ? '/JNAP/' : this.buildRouterUrl(routerIp);
    const authToken = this.buildAuthToken(username, password);

    const devicesResponse = await firstValueFrom(
      this.http.post<JnapResponse<DevicesOutput>>(url, {}, {
        headers: this.createHeaders('devicelist/GetDevices', authToken)
      })
    );

    const lanSettingsResponse = await firstValueFrom(
      this.http.post<JnapResponse<LanSettingsOutput>>(url, {}, {
        headers: this.createHeaders('router/GetLANSettings', authToken)
      })
    );

    const devices = devicesResponse.output?.devices ?? [];
    const reservations = lanSettingsResponse.output?.dhcpSettings?.reservations ?? [];
    const reservedMacs = new Set(
      reservations.map((reservation: Reservation) => reservation.macAddress?.toUpperCase())
    );

    const rows: DeviceRow[] = devices.map((device: Device) => {
      const connection = device.connections?.find(
        (item: { ipAddress?: string }) => !!item.ipAddress && !item.ipAddress.includes(':')
      );
      const ipAddress = connection?.ipAddress ?? 'Offline';
      const macAddress = (device.knownMACAddresses?.[0] ?? 'N/A').toUpperCase();
      const hasReservation = macAddress !== 'N/A' && reservedMacs.has(macAddress);
      const dhcpReservation: DeviceRow['dhcpReservation'] = hasReservation ? 'Yes' : 'No';

      return {
        deviceName: this.extractCustomName(device),
        ipAddress,
        macAddress,
        dhcpReservation
      };
    });

    return rows.sort((a, b) => this.ipToNumber(a.ipAddress) - this.ipToNumber(b.ipAddress));
  }
}
