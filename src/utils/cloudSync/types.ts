export interface CloudBackupFile {
  id: string;
  name: string;
  size?: number;
  modifiedTime: string;
}

export interface CloudProvider {
  id: string;
  name: string;
  signIn(): Promise<{ accessToken: string; expiresAt: number }>;
  signOut(): Promise<void>;
  isSignedIn(): boolean;
  getEmail(): string | null;
  getName(): string | null;
  getPicture(): string | null;
  upload(json: string, filename: string): Promise<CloudBackupFile>;
  list(): Promise<CloudBackupFile[]>;
  download(fileId: string): Promise<string>;
  delete(fileId: string): Promise<void>;
}
