import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface DeviceRow {
  deviceName: string;
  ipAddress: string;
  macAddress: string;
  dhcpReservation: 'Yes' | 'No';
  isOffline: boolean;
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
  ipAddress?: string;
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

  private buildProxyUrl(): string {
    const basePath = new URL(document.baseURI).pathname.replace(/\/+$/, '');
    const normalizedBasePath = basePath && basePath !== '/' ? basePath : '';
    return `${normalizedBasePath}/JNAP/`;
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

  private buildHttpError(error: unknown, action: string): Error {
    if (error instanceof HttpErrorResponse) {
      const statusMessage = error.status ? `${error.status} ${error.statusText}` : 'No response from router';
      const bodyMessage =
        typeof error.error === 'string'
          ? error.error
          : error.error?.message || JSON.stringify(error.error ?? {});

      if (error.status === 0) {
        return new Error(
          `Unable to connect to the router for ${action}. Check the Angular proxy, the router target, and network/CORS availability.`
        );
      }

      return new Error(`JNAP request ${action} failed: ${statusMessage}. ${bodyMessage}`);
    }

    return new Error(`Unexpected error during ${action}.`);
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
    username: string,
    password: string
  ): Promise<DeviceRow[]> {
    const url = this.buildProxyUrl();
    const authToken = this.buildAuthToken(username, password);

    const devicesResponse = await this.sendJnapRequest<DevicesOutput>(
      url,
      'devicelist/GetDevices',
      authToken
    );

    const lanSettingsResponse = await this.sendJnapRequest<LanSettingsOutput>(
      url,
      'router/GetLANSettings',
      authToken
    );

    const devices = devicesResponse.output?.devices ?? [];
    const reservations = lanSettingsResponse.output?.dhcpSettings?.reservations ?? [];
    const reservedIpsByMac = new Map(
      reservations
        .filter((reservation: Reservation) => reservation.macAddress?.trim() && reservation.ipAddress?.trim())
        .map((reservation: Reservation) => [reservation.macAddress?.toUpperCase(), reservation.ipAddress?.trim()])
    );

    const rows: DeviceRow[] = devices.map((device: Device) => {
      const connection = device.connections?.find(
        (item: { ipAddress?: string }) => !!item.ipAddress && !item.ipAddress.includes(':')
      );
      const macAddress = (device.knownMACAddresses?.[0] ?? 'N/A').toUpperCase();
      const reservedIpAddress = reservedIpsByMac.get(macAddress);
      const isOffline = !connection?.ipAddress || connection.ipAddress === 'Offline';
      const hasReservation = macAddress !== 'N/A' && !!reservedIpAddress;
      const dhcpReservation: DeviceRow['dhcpReservation'] = hasReservation ? 'Yes' : 'No';
      const ipAddress = isOffline && hasReservation ? reservedIpAddress! : connection?.ipAddress ?? 'Offline';

      return {
        deviceName: this.extractCustomName(device),
        ipAddress,
        macAddress,
        dhcpReservation,
        isOffline
      };
    });

    return rows.sort((a, b) => this.ipToNumber(a.ipAddress) - this.ipToNumber(b.ipAddress));
  }

  private async sendJnapRequest<T>(
    url: string,
    action: string,
    authToken: string
  ): Promise<JnapResponse<T>> {
    try {
      return await firstValueFrom(
        this.http.post<JnapResponse<T>>(url, {}, {
          headers: this.createHeaders(action, authToken)
        })
      );
    } catch (error: unknown) {
      throw this.buildHttpError(error, action);
    }
  }
}
