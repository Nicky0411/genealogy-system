export interface ApiOptions extends RequestInit {
    token?: string | null;
}
export declare function apiRequest<T>(path: string, options?: ApiOptions): Promise<T>;
