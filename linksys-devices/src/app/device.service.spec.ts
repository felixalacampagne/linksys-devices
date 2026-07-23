import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { DeviceService } from './device.service';

describe('DeviceService', () => {
  let service: DeviceService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });

    service = TestBed.inject(DeviceService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the reserved DHCP IP for an offline device that has a reservation', async () => {
    const sendJnapRequestSpy = vi.spyOn(service as any, 'sendJnapRequest');
    sendJnapRequestSpy
      .mockResolvedValueOnce({
        output: {
          devices: [
            {
              friendlyName: 'Offline reserved device',
              knownMACAddresses: ['AA:BB:CC:DD:EE:FF'],
              connections: [
                {
                  ipAddress: 'Offline'
                }
              ]
            }
          ]
        }
      })
      .mockResolvedValueOnce({
        output: {
          dhcpSettings: {
            reservations: [
              {
                macAddress: 'AA:BB:CC:DD:EE:FF',
                ipAddress: '192.168.1.31'
              }
            ]
          }
        }
      });

    const rows = await service.fetchConnectedDevices('admin', 'password');

    expect(rows).toHaveLength(1);
    expect(rows[0].ipAddress).toBe('192.168.1.31');
    expect(rows[0].dhcpReservation).toBe('Yes');
    expect(rows[0].isOffline).toBe(true);
  });
});
