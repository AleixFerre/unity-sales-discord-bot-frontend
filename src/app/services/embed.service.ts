import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';

import config from '../config.json' assert { type: 'json' };
import { EmbedRequest } from '../models/embed.model';

export type AssetStoreData = {
  title?: string;
  description?: string;
  imageUrl?: string;
};

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

  fetchAssetStoreData(url: string, token: string): Observable<AssetStoreData> {
    if (!this.backendUrl) {
      return throwError(() => new Error('BACKEND_URL is not configured.'));
    }

    const params = new HttpParams().set('url', url);
    const headers = token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
    return this.http.get<AssetStoreData>(this.backendUrl + '/assetstore/scrape', {
      params,
      headers,
    });
  }
}
