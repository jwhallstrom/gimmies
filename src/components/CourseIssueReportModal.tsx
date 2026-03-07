import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import useStore from '../state/store';
import { submitCourseIssueReport } from '../utils/courseIssueReports';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  source: 'create_event' | 'add_score';
  selectedCourseId?: string;
  selectedCourseName?: string;
  selectedTeeName?: string;
  initialIssueType?: 'missing_course' | 'missing_tee' | 'wrong_rating' | 'wrong_slope' | 'other';
};

type IssueType = 'missing_course' | 'missing_tee' | 'wrong_rating' | 'wrong_slope' | 'other';

const ISSUE_OPTIONS: { id: IssueType; label: string; description: string }[] = [
  { id: 'missing_course', label: 'Course missing', description: 'The course is not listed.' },
  { id: 'missing_tee', label: 'Tee missing', description: 'The course exists, but the tee is missing.' },
  { id: 'wrong_rating', label: 'Wrong rating', description: 'Course rating appears incorrect.' },
  { id: 'wrong_slope', label: 'Wrong slope', description: 'Slope appears incorrect.' },
  { id: 'other', label: 'Other issue', description: 'Anything else wrong with the course data.' },
];

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read image.'));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image.'));
    img.src = originalDataUrl;
  });

  const maxWidth = 1400;
  const scale = Math.min(1, maxWidth / image.width);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare image upload.');

  ctx.drawImage(image, 0, 0, width, height);

  let quality = 0.82;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > 330000 && quality > 0.45) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  if (dataUrl.length > 330000) {
    throw new Error('Image is still too large after compression. Try a tighter crop.');
  }

  return { dataUrl, mimeType: 'image/jpeg' };
}

const CourseIssueReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  source,
  selectedCourseId,
  selectedCourseName,
  selectedTeeName,
  initialIssueType = 'other',
}) => {
  const currentProfile = useStore((s) => s.currentProfile);
  const addToast = useStore((s) => s.addToast);

  const [issueType, setIssueType] = useState<IssueType>(initialIssueType);
  const [courseNameInput, setCourseNameInput] = useState('');
  const [teeNameInput, setTeeNameInput] = useState('');
  const [notes, setNotes] = useState('');
  const [imageName, setImageName] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [imageMimeType, setImageMimeType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolvedCourseName = useMemo(
    () => selectedCourseName || courseNameInput.trim(),
    [selectedCourseName, courseNameInput]
  );
  const resolvedTeeName = useMemo(
    () => selectedTeeName || teeNameInput.trim(),
    [selectedTeeName, teeNameInput]
  );

  if (!isOpen) return null;

  const resetAndClose = () => {
    setIssueType(initialIssueType);
    setCourseNameInput('');
    setTeeNameInput('');
    setNotes('');
    setImageName('');
    setImageDataUrl('');
    setImageMimeType('');
    setIsSubmitting(false);
    onClose();
  };

  const handleFileChange = async (file?: File | null) => {
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setImageName(file.name);
      setImageMimeType(compressed.mimeType);
      setImageDataUrl(compressed.dataUrl);
      addToast('Scorecard photo attached.', 'success');
    } catch (error: any) {
      console.error('Failed to prepare course issue image:', error);
      addToast(error?.message || 'Could not attach image.', 'error');
    }
  };

  const handleSubmit = async () => {
    if (!currentProfile) {
      addToast('Please sign in before submitting a course issue.', 'error');
      return;
    }

    if (!resolvedCourseName && issueType !== 'missing_course') {
      addToast('Add the course name so we know what to fix.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitCourseIssueReport({
        reporterProfileId: currentProfile.id,
        reporterName: currentProfile.name,
        reporterEmail: currentProfile.email,
        source,
        issueType,
        courseId: selectedCourseId || undefined,
        courseName: resolvedCourseName || undefined,
        teeName: resolvedTeeName || undefined,
        notes: notes.trim() || undefined,
        imageName: imageName || undefined,
        imageMimeType: imageMimeType || undefined,
        imageDataUrl: imageDataUrl || undefined,
      });

      addToast('Course issue submitted. We will review the scorecard photo.', 'success');
      resetAndClose();
    } catch (error: any) {
      console.error('Failed to submit course issue report:', error);
      addToast(error?.message || 'Could not submit course issue.', 'error');
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[100dvh] sm:max-h-[calc(100dvh-2rem)]">
        <div className="bg-primary-700 px-4 py-4 text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Report Course Issue</h2>
            <p className="text-sm text-primary-100">Send us the scorecard so we can fix course data.</p>
          </div>
          <button onClick={resetAndClose} className="p-2 rounded-lg hover:bg-white/10" aria-label="Close report course issue">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This saves the issue in Gimmies so we can review and update the course. A scorecard photo is recommended.
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-gray-900">What is wrong?</div>
            <div className="grid gap-2">
              {ISSUE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setIssueType(option.id)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    issueType === option.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="font-semibold text-gray-900">{option.label}</div>
                  <div className="text-sm text-gray-500">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Course</label>
              {selectedCourseName ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{selectedCourseName}</div>
              ) : (
                <input
                  type="text"
                  value={courseNameInput}
                  onChange={(e) => setCourseNameInput(e.target.value)}
                  placeholder="Course name"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Tee</label>
              {selectedTeeName ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{selectedTeeName}</div>
              ) : (
                <input
                  type="text"
                  value={teeNameInput}
                  onChange={(e) => setTeeNameInput(e.target.value)}
                  placeholder="Tee name"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="What looks wrong? Missing tee, wrong slope/rating, incorrect yardages, etc."
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Scorecard photo</label>
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-700 hover:bg-gray-100">
              <span>{imageName || 'Choose photo or take picture'}</span>
              <span className="rounded-lg bg-primary-600 px-3 py-1.5 font-semibold text-white">Attach</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
              />
            </label>
            {imageDataUrl && (
              <img src={imageDataUrl} alt="Scorecard preview" className="mt-3 max-h-56 rounded-xl border border-gray-200 object-contain" />
            )}
          </div>
        </div>

        <div className="border-t bg-gray-50 px-4 py-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={resetAndClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Issue'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CourseIssueReportModal;
