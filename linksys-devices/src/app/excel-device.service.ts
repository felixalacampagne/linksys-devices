import { HttpClient, HttpErrorResponse, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

interface JnapResponse<T = any> {
  output?: T;
}

@Injectable({ providedIn: 'root' })
export class ExcelDeviceService {
  constructor(private http: HttpClient) {}


async fetchExcelDevices(
    username: string,
    password: string
  ): Promise<ExcelDevice[]> {
    const url = "Network assignments.json";

    const devicesResponse = await this.sendRequest<ExcelDevice[]>(url);

    const devices = devicesResponse.output ?? [];
    return devices;
  }

  private async sendRequest<T>(
    url: string
  ): Promise<JnapResponse<T>> {
    try {
      return await firstValueFrom(
        this.http.post<JnapResponse<T>>(url, {}, {
          headers: this.createHeaders()
        })
      );
    } catch (error: unknown) {
      throw this.buildHttpError(error);
    }
  }

  private createHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }

    private buildHttpError(error: unknown): Error {
    if (error instanceof HttpErrorResponse) {
      const statusMessage = error.status ? `${error.status} ${error.statusText}` : 'No response from router';
      const bodyMessage =
        typeof error.error === 'string'
          ? error.error
          : error.error?.message || JSON.stringify(error.error ?? {});

      if (error.status === 0) {
        return new Error(
          `Unable to load device data. Check the Angular proxy, the router target, and network/CORS availability.`
        );
      }

      return new Error(`request failed: ${statusMessage}. ${bodyMessage}`);
    }

    return new Error(`Unexpected error during data load.`);
  }
}