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
         // Need the app name eg. linksys in http:/server/linksys/ to be able to call the api
         // in the production environment.
         // This is a hack to get the app name from the url.
         // It will not work if the app loaded using a path which includes a filename,
         // eg. http:/server/linksys, http:/server/linksys/index.html, http://localhost/#/.
         // TODO define the data location for production, keep the real data file outside
         // of the app folder.
         //this.serverhost = window.location.href;

         // Attempt to dynamically determine application URL and thus the URL for the data dir.
         // Based on Google AI suggestion.
         const host = window.location.origin;
         const path = window.location.pathname; // e.g., "/applicationname/index.html" or "/applicationname/home"
         // Split the path by slashes and filter out empty strings
         const pathSegments = path.split('/').filter(segment => segment.length > 0);

         // If deployed in a sub-directory, the first segment is your app name
         // e.g., if path is "/applicationname/home", pathSegments[0] is "applicationname"
         let apppath= "/";
         if (pathSegments.length > 0 && !pathSegments[0].includes('.'))
         {
            apppath = `/${pathSegments[0]}/`;
         }

         this.serverhost = host + apppath; // Ends with '/'

         console.log("ExcelDeviceService: serverhost:" + this.serverhost);
      }

      this.apiext = environment.api_ext;
      this.apiapp = environment.folder + environment.api_app;
      this.apiurl = this.serverhost + this.apiapp
      console.log("ExcelDeviceService: apiurl:" + this.apiurl);
   }

   async fetchExcelDevices(): Promise<ExcelDevice[]>
   {
      const url = this.makeApiname("devices");
      console.log("ExcelDeviceService.fetchExcelDevices: url:" + url);

      const devicesResponse = await this.sendRequest<any[]>(url);
      console.log("ExcelDeviceService.fetchExcelDevices: devicesResponse:" + JSON.stringify(devicesResponse));

      const devices = devicesResponse ?? [];
      const excelDevices: ExcelDevice[] = devices.map(device => ({
         macAddress: device.MAC_Address,
         name: device.Name,
         ipAddress: device.IP_Address,
         reserved: device.Reserved,
         comment: device.Comment,
         offline: device.offline
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
      } catch (error: any)
      {
         console.log("ExcelDeviceService.sendRequest: URL: " + url + " error:" + JSON.stringify(error));
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