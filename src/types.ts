export interface PRDSection {
  title: string;
  content: string;
}

export type ProductType = 'e-commerce' | 'SaaS' | 'IoT' | 'Mobile App' | 'Internal Tool' | 'Unknown';

export interface GeneratePRDResponse {
  prd: string;
  error?: string;
}

export interface PRDComment {
  sectionIndex: number;
  text: string;
}

export interface PRDVersion {
  id: string;
  timestamp: number;
  content: string;
  prompt: string;
  productType: ProductType;
}
