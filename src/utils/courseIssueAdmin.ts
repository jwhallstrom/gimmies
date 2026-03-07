import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

let cachedClient: ReturnType<typeof generateClient<Schema>> | null = null;

function getClient() {
  if (!cachedClient) {
    cachedClient = generateClient<Schema>();
  }
  return cachedClient;
}

export type CourseIssueAdminReport = {
  id: string;
  reporterProfileId?: string | null;
  reporterName?: string | null;
  reporterEmail?: string | null;
  source?: string | null;
  issueType?: string | null;
  courseId?: string | null;
  courseName?: string | null;
  teeName?: string | null;
  notes?: string | null;
  imageName?: string | null;
  imageMimeType?: string | null;
  imageDataUrl?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export async function listCourseIssueReports(): Promise<CourseIssueAdminReport[]> {
  const client = getClient();
  const { data, errors } = await client.queries.listCourseIssueReports();
  if (errors?.length) {
    throw new Error(errors[0]?.message || 'Failed to load course issue reports.');
  }
  return (data || []) as CourseIssueAdminReport[];
}

export async function updateCourseIssueReportStatus(reportId: string, status: 'open' | 'completed') {
  const client = getClient();
  const { data, errors } = await client.mutations.updateCourseIssueReportStatus({ reportId, status });
  if (errors?.length) {
    throw new Error(errors[0]?.message || 'Failed to update course issue status.');
  }
  if (!data?.success) {
    throw new Error(data?.error || 'Failed to update course issue status.');
  }
  return data;
}
