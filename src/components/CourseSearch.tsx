/**
 * Course Search Component
 * Mobile-first searchable selector for golf courses
 * Uses full-screen modal on mobile for better UX
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCourses, type CourseData } from '../hooks/useCourses';

interface CourseSearchProps {
  selectedCourseId?: string;
  onSelect: (courseId: string, courseName: string) => void;
  disabled?: boolean;
}

export function CourseSearch({ selectedCourseId, onSelect, disabled }: CourseSearchProps) {
  const { courses, loading, searchCourses } = useCourses();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const selectedCourse = courses.find((c: CourseData) => c.courseId === selectedCourseId);
  const filteredCourses = searchCourses(searchQuery);
  const displayCourses = filteredCourses.slice(0, 50);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleSelect = (courseId: string, courseName: string) => {
    onSelect(courseId, courseName);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className={`w-full border rounded-xl px-3 py-2.5 text-sm text-left flex items-center justify-between gap-2 transition-colors ${
          disabled 
            ? 'bg-gray-100 cursor-not-allowed border-gray-200' 
            : 'bg-white border-gray-300 hover:border-gray-400'
        }`}
      >
        {loading ? (
          <span className="text-gray-400">Loading...</span>
        ) : selectedCourse ? (
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">{selectedCourse.name}</div>
            <div className="text-xs text-gray-500 truncate">{selectedCourse.location}</div>
          </div>
        ) : (
          <span className="text-gray-400">Search for a course...</span>
        )}
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Full-screen Modal */}
      {isOpen && !disabled && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm">
          <div className="h-full flex flex-col bg-white sm:max-w-lg sm:mx-auto sm:my-8 sm:rounded-2xl sm:h-[calc(100%-4rem)] sm:shadow-2xl">
            {/* Header */}
            <div className="bg-primary-700 px-4 py-4 flex items-center gap-3 sm:rounded-t-2xl">
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-white/80 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <h2 className="text-lg font-bold text-white flex-1">Select Course</h2>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                  placeholder="Search by course name or city..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="text-xs text-gray-500 mt-2">
                  {displayCourses.length} {displayCourses.length === 1 ? 'course' : 'courses'} found
                </p>
              )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {displayCourses.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-4xl mb-3">⛳</div>
                  <p className="text-gray-500">
                    {searchQuery ? 'No courses match your search' : 'Start typing to find a course'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {displayCourses.map((course: CourseData) => (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => handleSelect(course.courseId, course.name)}
                      className={`w-full px-4 py-4 text-left hover:bg-primary-50 transition-colors ${
                        course.courseId === selectedCourseId ? 'bg-primary-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-lg">⛳</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900">{course.name}</div>
                          <div className="text-sm text-gray-500 mt-0.5">{course.location}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {course.tees?.length || 0} tees available
                          </div>
                        </div>
                        {course.courseId === selectedCourseId && (
                          <svg className="w-5 h-5 text-primary-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="p-3 border-t border-gray-200 bg-gray-50 text-center sm:rounded-b-2xl">
              <p className="text-xs text-gray-400">
                Tap a course to select it
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default CourseSearch;
