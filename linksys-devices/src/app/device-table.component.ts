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
    MatProgressSpinnerModule
  ],
  templateUrl: './device-table.component.html',
  styleUrls: ['./device-table.component.scss']
})
export class DeviceTableComponent {
  username = '';
  password = '';
  loading = signal(false);
  error = signal<string | undefined>(undefined);
  devices = signal<DeviceRow[]>([]);
  showCredentialFields = signal(true);
  shareUrl = signal('');
  displayedColumns = ['deviceName', 'ipAddress', 'macAddress', 'dhcpReservation'];

  constructor(private deviceService: DeviceService) {
    const queryParams = new URLSearchParams(window.location.search);
    const usernameFromUrl = queryParams.get('u') ?? queryParams.get('username') ?? '';
    const passwordFromUrl = queryParams.get('p') ?? queryParams.get('password') ?? '';

    if (usernameFromUrl.trim() && passwordFromUrl.trim()) {
      this.username = usernameFromUrl.trim();
      this.password = this.decodePassword(passwordFromUrl.trim());
      this.showCredentialFields.set(false);
      this.syncShareUrl();
      void this.loadDevices();
    }
  }

  onUsernameChanged(value: string): void {
    this.username = value;
    this.syncShareUrl();
  }

  onPasswordChanged(value: string): void {
    this.password = value;
    this.syncShareUrl();
  }

  private decodePassword(input: string): string {
    try {
      const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
      const decoded = atob(padded);
      return decodeURIComponent(escape(decoded));
    } catch {
      return input;
    }
  }

  private encodePassword(input: string): string {
    const encoded = btoa(encodeURIComponent(input).replace(/%([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16))));
    return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  private syncShareUrl(): void {
    const username = this.username.trim();
    const password = this.password.trim();
    const shareUrl = new URL(window.location.href);

    if (!username || !password) {
      shareUrl.searchParams.delete('u');
      shareUrl.searchParams.delete('username');
      shareUrl.searchParams.delete('p');
      shareUrl.searchParams.delete('password');
      this.shareUrl.set('');
      window.history.replaceState({}, '', shareUrl.toString());
      return;
    }

    shareUrl.searchParams.set('u', username);
    shareUrl.searchParams.set('p', this.encodePassword(password));
    shareUrl.searchParams.delete('username');
    shareUrl.searchParams.delete('password');
    this.shareUrl.set(shareUrl.toString());
    window.history.replaceState({}, '', shareUrl.toString());
  }

  async copyShareUrl(): Promise<void> {
    if (!this.shareUrl()) {
      return;
    }

    await navigator.clipboard.writeText(this.shareUrl());
  }

  async loadDevices(): Promise<void> {
    this.error.set(undefined);
    this.loading.set(true);

    try {
      const updatedDevices = await this.deviceService.fetchConnectedDevices(
        this.username,
        this.password
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
