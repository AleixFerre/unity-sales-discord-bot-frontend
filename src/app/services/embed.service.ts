import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';

import config from '../config.json' assert { type: 'json' };
import { EmbedRequest } from '../models/embed.model';

export type AssetStoreData = {
  title?: string;
  imageUrl?: string;
  price?: string;
  promoCode?: string;
};

export type AssetStoreListData = {
  title?: string;
  imageUrls?: string[];
};

export type FabFreeItem = {
  title?: string;
  imageUrl?: string;
  price?: string;
  freeUntil?: string;
  url?: string;
};

@Injectable({ providedIn: 'root' })
export class EmbedService {
  private readonly http = inject(HttpClient);
  private readonly backendUrl = config.backendUrl;

  sendEmbed(payload: EmbedRequest, token: string): Observable<unknown> {
    if (!this.backendUrl) {
      return throwError(() => new Error('BACKEND_URL is not configured.'));
    }
    return this.http.post(this.backendUrl + '/message', payload, {
      headers: this.authHeaders(token),
    });
  }

  fetchAssetStoreData(url: string, token: string): Observable<AssetStoreData> {
    if (!this.backendUrl) {
      return throwError(() => new Error('BACKEND_URL is not configured.'));
    }
    const params = new HttpParams().set('url', url);
    return this.http.get<AssetStoreData>(this.backendUrl + '/assetstore/scrape', {
      params,
      headers: this.authHeaders(token),
    });
  }

  fetchAssetStoreList(url: string, token: string): Observable<AssetStoreListData> {
    if (!this.backendUrl) {
      return throwError(() => new Error('BACKEND_URL is not configured.'));
    }
    const params = new HttpParams().set('url', url);
    return this.http.get<AssetStoreListData>(this.backendUrl + '/assetstore/list', {
      params,
      headers: this.authHeaders(token),
    });
  }

  fetchFabFree(token: string): Observable<{ items: FabFreeItem[] }> {
    if (!this.backendUrl) {
      return throwError(() => new Error('BACKEND_URL is not configured.'));
    }
    return this.http.get<{ items: FabFreeItem[] }>(this.backendUrl + '/fab/free', {
      headers: this.authHeaders(token),
    });
  }

  private authHeaders(token: string): HttpHeaders {
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}
