import { z } from 'zod';

// File upload validation schema
export const fileUploadSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => {
      const allowedTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      return allowedTypes.includes(file.type);
    },
    { message: 'File must be CSV or Excel format' }
  ).refine(
    (file) => file.size <= 10 * 1024 * 1024, // 10MB
    { message: 'File size must be less than 10MB' }
  ),
});

// API route input validation schemas
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export const filterSchema = z.object({
  zone: z.string().optional(),
  status: z.enum(['delivered', 'pending', 'failed', 'in_transit']).optional(),
  dateRange: dateRangeSchema.optional(),
});

export const parcelIdSchema = z.object({
  id: z.string().uuid(),
});

export const uploadMetadataSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.enum(['parcel_logs', 'delivery_details', 'collector_report', 'prepare_report']),
  uploadedBy: z.string().uuid().optional(),
});
