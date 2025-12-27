import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';

import config from '../config.json' assert { type: 'json' };
import { EmbedRequest } from '../models/embed.model';

@Injectable({ providedIn: 'root' })
export class EmbedService {
  private readonly backendUrl = config.backendUrl;

  constructor(private readonly http: HttpClient) {}

  sendEmbed(payload: EmbedRequest, token: string): Observable<unknown> {
    if (!this.backendUrl) {
      return throwError(() => new Error('BACKEND_URL is not configured.'));
    }

    const headers = token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();

    return this.http.post(this.backendUrl + '/message', payload, { headers });
  }
}
