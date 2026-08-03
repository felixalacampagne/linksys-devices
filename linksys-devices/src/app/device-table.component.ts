import { Component, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { NetworkDeviceService } from './excel-device.service';

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
      MatSortModule
   ],
   templateUrl: './device-table.component.html',
   styleUrls: ['./device-table.component.scss']
})
export class DeviceTableComponent
{
   loading = signal(false);
   error = signal<string | undefined>(undefined);
   devices = signal<NetworkDevice[]>([]);
   displayedColumns = ['macAddress', 'name', 'ipAddress', 'comment'];
   dataSource = new MatTableDataSource<NetworkDevice>();

   // Grab a reference to the matSort directive from the HTML template
   @ViewChild(MatSort) set matSort(sort: MatSort)
   {
      this.dataSource.sort = sort;

      // Custom sorting logic
      this.dataSource.sortingDataAccessor = (item: NetworkDevice, property: string): string | number => {
       switch (property) {
         // Column 1 & 2: Explicitly force case-insensitive string sorting
         case 'macAddress':
         case 'name':
           return item[property] ? item[property].toString().toLowerCase() : '';

         // Column 3: Convert IP Address string to a sortable 32-bit number
         case 'ipAddress':
            const ipaddr =  item.ipAddress;
            // Check if the cell value is genuinely empty, blank, null or undefined
            if (ipaddr === '' || ipaddr === null || ipaddr === undefined)
            {
               // Pin to bottom: Return maximum value for ASC, minimum value for DESC
               const isAsc = this.dataSource.sort?.direction === 'asc';
               return isAsc ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
            }
           return this.ipToNumber(ipaddr);

         // Fallback for any other columns
         default:
           const value = (item as any)[property];
           return typeof value === 'string' ? value.toLowerCase() : value;
       }
      };
   };

   constructor(private deviceService: NetworkDeviceService)
   {
   }

   ngOnInit()
   {
      console.log("DeviceTableComponent.ngOnInit: loading devices...");
      this.loadDevices();
   }

   ngAfterViewInit() {
      // Bind the sorting logic to your data source
      // Does not work with ngIf. Replaced with setter on @ViewChild
      //this.dataSource.sort = this.sort;
   }

   async loadDevices(): Promise<void>
   {
      this.error.set(undefined);
      this.loading.set(true);

      try
      {
         const updatedDevices = await this.deviceService.fetchExcelDevices();
         this.devices.set(updatedDevices);
         this.dataSource.data = updatedDevices;

      } catch (error: unknown)
      {
         this.devices.set([]);
         this.error.set(
            error instanceof Error
               ? error.message
               : 'Unable to fetch devices from the router.'
         );
      } finally
      {
         this.loading.set(false);
      }
   }

   /**
    * Converts an IP address string (e.g., '192.168.0.10')
    * into a unique numeric value for mathematical sorting.
    */
   private ipToNumber(ip: string): number {
      if(ip.length==0) return 0; // Handle empty IP addresses
      return ip
         .split('.')
         .reduce((ipInt, octet) => (ipInt << 8) + parseInt(octet, 10), 0) >>> 0;
   }
}
