// Field and column definitions that drive the Subjects, Instructors and Rooms screens.
export const subjects = {
  title: 'Subjects',
  path: '/api/subjects',
  defaultSort: 'code',
  columns: [
    { key: 'code', label: 'Code', sort: true },
    { key: 'name', label: 'Name', sort: true },
    { key: 'units', label: 'Units', sort: true },
    { key: 'type', label: 'Type' },
    { key: 'department', label: 'Department', sort: true },
  ],
  fields: [
    { key: 'code', label: 'Subject code', required: true },
    { key: 'name', label: 'Subject name', required: true },
    { key: 'description', label: 'Description' },
    { key: 'units', label: 'Units', type: 'number', default: 3, required: true },
    { key: 'type', label: 'Type', type: 'select', default: 'lecture', options: ['lecture', 'lab'] },
    { key: 'department', label: 'Department' },
  ],
};

export const instructors = {
  title: 'Instructors',
  path: '/api/instructors',
  defaultSort: 'name',
  columns: [
    { key: 'name', label: 'Name', sort: true },
    { key: 'email', label: 'Email' },
    { key: 'department', label: 'Department', sort: true },
    { key: 'employment_type', label: 'Employment' },
    { key: 'max_load_hours', label: 'Max hours/week', sort: true },
    { key: 'employee_number', label: 'Employee no.' },
  ],
  fields: [
    { key: 'name', label: 'Full name', required: true },
    { key: 'employee_number', label: 'Employee number' },
    { key: 'email', label: 'Email' },
    { key: 'department', label: 'Department' },
    { key: 'employment_type', label: 'Employment', type: 'select', default: 'full-time', options: ['full-time', 'part-time'] },
    { key: 'max_load_hours', label: 'Max teaching hours per week', type: 'number', default: 24, required: true },
  ],
};

export const rooms = {
  title: 'Rooms',
  path: '/api/rooms',
  defaultSort: 'name',
  columns: [
    { key: 'name', label: 'Room', sort: true },
    { key: 'building', label: 'Building', sort: true },
    { key: 'capacity', label: 'Capacity', sort: true },
    { key: 'type', label: 'Type' },
    { key: 'is_available', label: 'Available' },
  ],
  fields: [
    { key: 'name', label: 'Room name or number', required: true },
    { key: 'building', label: 'Building' },
    { key: 'capacity', label: 'Capacity', type: 'number', default: 40, required: true },
    { key: 'type', label: 'Type', type: 'select', default: 'lecture hall', options: ['lecture hall', 'laboratory', 'seminar room'] },
    { key: 'is_available', label: 'Available for booking', type: 'bool', default: true },
  ],
};

export const sections = {
  title: 'Sections',
  path: '/api/sections',
  defaultSort: 'section_name',
  columns: [
    { key: 'section_name', label: 'Section', sort: true },
    { key: 'course', label: 'Course', sort: true },
    { key: 'year_level', label: 'Year level', sort: true },
  ],
  fields: [
    { key: 'section_name', label: 'Section name (for example BSIT 3A)', required: true },
    { key: 'course', label: 'Course' },
    { key: 'year_level', label: 'Year level', type: 'number' },
  ],
};
