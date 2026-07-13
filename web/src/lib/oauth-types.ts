export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in?: number;
  refresh_token?: string;
  token_type: string;
  scope?: string;
}

export interface StoredToken {
  accessToken: string;
  expiresIn?: number | null;
  refreshExpiresIn?: number | null;
  tokenType?: string | null;
  scope?: string | null;
  expiryDate?: Date | null;
  providerId?: string | null;
}
