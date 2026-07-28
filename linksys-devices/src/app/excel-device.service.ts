import { HttpClient, HttpErrorResponse, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class ExcelDeviceService
{
   serverhost: string;
   apiext: string;
   apiapp: string;
   apiurl: string;

   constructor(private http: HttpClient)
   {
      if (environment.api_host.length > 0)
      {
         this.serverhost = environment.api_host;
      }
      else
      {
         this.serverhost = window.location.origin;
      }

      this.apiext = environment.api_ext;
      this.apiapp = environment.folder + environment.api_app;
      this.apiurl = this.serverhost + this.apiapp
   }

   async fetchExcelDevices(): Promise<ExcelDevice[]>
   {
      const url = this.makeApiname("devices");
      // console.log("ExcelDeviceService.fetchExcelDevices: url:" + url);

      const devicesResponse = await this.sendRequest<any[]>(url);
      // console.log("ExcelDeviceService.fetchExcelDevices: devicesResponse:" + JSON.stringify(devicesResponse));

      const devices = devicesResponse ?? [];
      const excelDevices: ExcelDevice[] = devices.map(device => ({
         macAddress: device.MAC_Address,
         name: device.Name,
         ipAddress: device.IP_Address,
         reserved: device.Reserved,
         comment: device.Comment,
         sortableIp: device.Sortable_IP
      }));
      // console.log("ExcelDeviceService.fetchExcelDevices: excelDevices:" + JSON.stringify(excelDevices));
      return excelDevices;
   }

   private async sendRequest<T>(url: string): Promise<T>
   {
      try
      {
         return await firstValueFrom(
            this.http.get<T>(url, {
               headers: this.createHeaders()
            })
         );
      } catch (error: unknown)
      {
         console.log("ExcelDeviceService.sendRequest: error:" + JSON.stringify(error));
         throw this.buildHttpError(error);
      }
   }

   private createHeaders(): HttpHeaders
   {
      return new HttpHeaders({
         'Content-Type': 'application/json'
      });
   }

   private buildHttpError(error: unknown): Error
   {
      if (error instanceof HttpErrorResponse)
      {
         const statusMessage = error.status ? `${error.status} ${error.statusText}` : 'No response from router';
         const bodyMessage =
            typeof error.error === 'string'
               ? error.error
               : error.error?.message || JSON.stringify(error.error ?? {});

         if (error.status === 0)
         {
            return new Error(
               `Unable to load device data. Check the Angular proxy, the router target, and network/CORS availability.`
            );
         }

         return new Error(`request failed: ${statusMessage}. ${bodyMessage}`);
      }

      return new Error(`Unexpected error during data load.`);
   }

   private makeApiname(api: string): string
   {
      // Since Angular 20 files in the assets directory without an extension are served
      // with garbage at the end of the file making them unparsable as JSON files.
      // One workaround is to handle every response as a pure text, remove the garbage
      // and then parse as JSON (used by sattimers). This is a very annoying thing to
      // need to do for all the api of account and defeats the purpose of having the
      // parsing handled automatically.
      //
      // It appears that giving the test data file and extension of .json prevents the
      // garbage from being appended to the respone and thus allows the automatic
      // to be performed. Obviously the actual apis should not be given an extension
      // but using the environment file allows the extension to be added only when
      // running in the backend less test environment. It still requires all api calls
      // to be updated but not as annoying as converting everything to text.
      return this.apiurl + api + this.apiext;
   }
}