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
import { ExcelDeviceService } from './excel-device.service';

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
   devices = signal<ExcelDevice[]>([]);
   displayedColumns = ['macAddress', 'name', 'ipAddress', 'comment'];
   dataSource = new MatTableDataSource();

   // Grab a reference to the matSort directive from the HTML template
   @ViewChild(MatSort) set matSort(sort: MatSort)
   {
      this.dataSource.sort = sort;
   };

   constructor(private deviceService: ExcelDeviceService)
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
}
