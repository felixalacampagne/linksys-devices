import { TestBed, ComponentFixture } from '@angular/core/testing';

import { DeviceTableComponent } from './device-table.component';
import { DeviceService } from './device.service';

describe('DeviceTableComponent', () => {
  let fixture: ComponentFixture<DeviceTableComponent>;
  let component: DeviceTableComponent;
  let deviceService: { fetchConnectedDevices: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    const url = new URL(window.location.href);
    url.search = '?u=admin&p=secret';
    window.history.pushState({}, '', url.toString());

    deviceService = {
      fetchConnectedDevices: vi.fn().mockResolvedValue([])
    };

    await TestBed.configureTestingModule({
      imports: [DeviceTableComponent],
      providers: [{ provide: DeviceService, useValue: deviceService }]
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('reads credentials from the URL, hides the credential inputs, and auto-fetches devices', async () => {
    expect(component.username).toBe('admin');
    expect(component.password).toBe('secret');
    expect(component.showCredentialFields()).toBe(false);
    expect(deviceService.fetchConnectedDevices).toHaveBeenCalledWith('admin', 'secret');
  });
});
