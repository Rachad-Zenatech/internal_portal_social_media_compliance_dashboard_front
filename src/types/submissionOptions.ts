/** Brand and publishing account choices used by submission forms. */
export interface BrandOption {
  code: string;
  name: string;
}
export interface AccountOption {
  id: string;
  label: string;
  account_name: string;
  provider: string;
  platform: string;
  handle?: string | null;
  brand_code?: string | null;
  is_ceo: boolean;
  is_demo: boolean;
}

