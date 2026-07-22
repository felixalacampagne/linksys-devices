import { Component, signal } from '@angular/core';
import { DeviceTableComponent } from './device-table.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DeviceTableComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  protected readonly title = signal('linksys-devices');
}
