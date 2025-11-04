/**
 * Course Search Component
 * Searchable dropdown for selecting golf courses from DynamoDB
 */

import React, { useState, useRef, useEffect } from 'react';
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const selectedCourse = courses.find((c: CourseData) => c.courseId === selectedCourseId);
  const filteredCourses = searchCourses(searchQuery);
  const displayCourses = filteredCourses.slice(0, 50); // Limit to 50 for performance

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (courseId: string, courseName: string) => {
    onSelect(courseId, courseName);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Display / Search Input */}
      <div
        className={`w-full border rounded px-2 py-1 text-sm flex items-center justify-between cursor-pointer ${
          disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white border-gray-400'
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {loading ? (
          <span className="text-gray-400">Loading courses...</span>
        ) : selectedCourse ? (
          <div className="flex-1 truncate">
            <div className="font-medium">{selectedCourse.name}</div>
            <div className="text-xs text-gray-500">{selectedCourse.location}</div>
          </div>
        ) : (
          <span className="text-gray-400">Search for a course...</span>
        )}
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-hidden flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b">
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Search courses by name or location..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          {/* Results */}
          <div className="overflow-y-auto flex-1">
            {displayCourses.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                {searchQuery ? 'No courses found' : 'Start typing to search'}
              </div>
            ) : (
              <>
                {displayCourses.map((course: CourseData) => (
                  <div
                    key={course.id}
                    className="px-3 py-2 hover:bg-primary-50 cursor-pointer border-b last:border-b-0"
                    onClick={() => handleSelect(course.courseId, course.name)}
                  >
                    <div className="font-medium text-sm">{course.name}</div>
                    <div className="text-xs text-gray-500">{course.location}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {course.tees.length} tee{course.tees.length !== 1 ? 's' : ''} available
                    </div>
                  </div>
                ))}
                {filteredCourses.length > 50 && (
                  <div className="p-2 text-center text-xs text-gray-500 bg-gray-50">
                    Showing first 50 of {filteredCourses.length} results. Refine your search for more.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
