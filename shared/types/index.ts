export interface User {
  id: string;
  username: string;
  email: string;
  role: 'OWNER' | 'TECHNICIAN' | 'FRONT_DESK';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  brand: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  jobCode: string;
  accessCode: string;
  customerId: string;
  deviceId: string;
  color?: string;
  reportedProblem: string;
  conditionNotes?: string;
  status: string;
  estimatedCost: number;
  depositAmount?: number;
  estimatedDate?: string;
  isWarrantyReturn: boolean;
  warrantyForJobId?: string;
  createdById: string;
  updatedById?: string;
  technicianId?: string;
  createdAt: string;
  updatedAt: string;
  customer?: Customer;
  device?: Device;
  technician?: User;
  photos?: JobPhoto[];
  notes?: JobNote[];
  partsUsed?: JobPart[];
  repairs?: JobRepair[];
}

export interface JobPhoto {
  id: string;
  jobId: string;
  path: string;
  createdAt: string;
}

export interface JobNote {
  id: string;
  jobId: string;
  content: string;
  isCustomerVisible: boolean;
  createdById: string;
  createdAt: string;
  createdBy?: User;
}

export interface JobPart {
  id: string;
  jobId: string;
  partId?: string;
  partName: string;
  category: string;
  unitPrice: number;
  quantity: number;
  supplier?: string;
  totalCost: number;
  createdById: string;
  createdAt: string;
}

export interface JobRepair {
  id: string;
  jobId: string;
  repairId?: string;
  repairName: string;
  category: string;
  price: number;
  createdById: string;
  createdAt: string;
}
