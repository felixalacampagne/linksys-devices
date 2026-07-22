import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { DeviceService, DeviceRow } from './device.service';

@Component({
  selector: 'app-device-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatTableModule,
    MatToolbarModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule
  ],
  templateUrl: './device-table.component.html',
  styleUrls: ['./device-table.component.scss']
})
export class DeviceTableComponent {
  routerIp = '';
  username = '';
  password = '';
  useProxy = signal(true);
  loading = signal(false);
  error = signal<string | undefined>(undefined);
  devices = signal<DeviceRow[]>([]);
  displayedColumns = ['deviceName', 'ipAddress', 'macAddress', 'dhcpReservation'];

  constructor(private deviceService: DeviceService) {}

  async loadDevices(): Promise<void> {
    this.error.set(undefined);
    this.loading.set(true);

    try {
      const updatedDevices = await this.deviceService.fetchConnectedDevices(
        this.routerIp,
        this.username,
        this.password,
        this.useProxy()
      );
      this.devices.set(updatedDevices);
    } catch (error: unknown) {
      this.devices.set([]);
      this.error.set(
        error instanceof Error
          ? error.message
          : 'Unable to fetch devices from the router.'
      );
    } finally {
      this.loading.set(false);
    }
  }
}
