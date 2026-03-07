import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

let cachedClient: ReturnType<typeof generateClient<Schema>> | null = null;

function getClient() {
  if (!cachedClient) {
    cachedClient = generateClient<Schema>();
  }
  return cachedClient;
}

export type CourseIssuePayload = {
  reporterProfileId: string;
  reporterName?: string;
  reporterEmail?: string;
  source: 'create_event' | 'add_score';
  issueType: 'missing_course' | 'missing_tee' | 'wrong_rating' | 'wrong_slope' | 'other';
  courseId?: string;
  courseName?: string;
  teeName?: string;
  notes?: string;
  imageName?: string;
  imageMimeType?: string;
  imageDataUrl?: string;
};

export async function submitCourseIssueReport(payload: CourseIssuePayload) {
  const client = getClient();
  const { data, errors } = await client.models.CourseIssueReport.create({
    reporterProfileId: payload.reporterProfileId,
    reporterName: payload.reporterName || undefined,
    reporterEmail: payload.reporterEmail || undefined,
    source: payload.source,
    issueType: payload.issueType,
    courseId: payload.courseId || undefined,
    courseName: payload.courseName || undefined,
    teeName: payload.teeName || undefined,
    notes: payload.notes || undefined,
    imageName: payload.imageName || undefined,
    imageMimeType: payload.imageMimeType || undefined,
    imageDataUrl: payload.imageDataUrl || undefined,
    status: 'open',
  } as any);

  if (errors?.length) {
    throw new Error(errors[0]?.message || 'Failed to submit course issue report.');
  }

  return data;
}
