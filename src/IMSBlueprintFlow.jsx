/*
Drop this file and ./mockApi.js into src/ in a Vite React app.
Install: npm install react react-dom react-hook-form date-fns tailwindcss
Run: npm run dev
*/
import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, isValid, parseISO, set, startOfWeek } from 'date-fns';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import mockApi from './mockApi';

const ACTION_TYPES = [
  'Classwide scheduled',
  'High Performance',
  'High performance aggregate',
  'Low Performance',
  'Low performance aggregate',
  'Low performance overall grade',
  'Missing Submission',
  'Check Canvas login',
  'Quiz response',
  'Zero-Score',
];
const SORTED_ACTION_TYPES = [...ACTION_TYPES].sort((a, b) => a.localeCompare(b));
const ACTION_TYPES_REQUIRING_PERCENT = new Set([
  'High Performance',
  'Low Performance',
  'High performance aggregate',
  'Low performance aggregate',
  'Low performance overall grade',
]);
const MULTI_ASSIGNMENT_ACTION_TYPES = ['High performance aggregate', 'Low performance aggregate'];
const NON_MULTI_ASSIGNMENT_ACTION_TYPES = SORTED_ACTION_TYPES.filter(
  (action) => !MULTI_ASSIGNMENT_ACTION_TYPES.includes(action)
);
const STANDARD_ASSIGNMENT_ACTION_TYPES = NON_MULTI_ASSIGNMENT_ACTION_TYPES.filter(
  (action) =>
    action !== 'Classwide scheduled' &&
    action !== 'Low performance overall grade' &&
    action !== 'Check Canvas login'
);
const ALL_STUDENTS_ACTION_TYPES = [
  'Classwide scheduled',
  'Low performance overall grade',
  'Check Canvas login',
  'Registration reminder',
].sort((a, b) => a.localeCompare(b));
const ACTION_TYPE_STYLES = {
  'Classwide scheduled': {
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    bar: 'bg-indigo-600',
  },
  'High Performance': {
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    bar: 'bg-emerald-600',
  },
  'High performance aggregate': {
    badge: 'bg-teal-100 text-teal-800 border-teal-200',
    bar: 'bg-teal-600',
  },
  'Low Performance': {
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    bar: 'bg-amber-600',
  },
  'Low performance aggregate': {
    badge: 'bg-orange-100 text-orange-800 border-orange-200',
    bar: 'bg-orange-600',
  },
  'Low performance overall grade': {
    badge: 'bg-red-100 text-red-800 border-red-200',
    bar: 'bg-red-600',
  },
  'Missing Submission': {
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    bar: 'bg-rose-600',
  },
  'Check Canvas login': {
    badge: 'bg-violet-100 text-violet-800 border-violet-200',
    bar: 'bg-violet-600',
  },
  'Registration reminder': {
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    bar: 'bg-cyan-600',
  },
  'Quiz response': {
    badge: 'bg-sky-100 text-sky-800 border-sky-200',
    bar: 'bg-sky-600',
  },
  'Zero-Score': {
    badge: 'bg-slate-200 text-slate-800 border-slate-300',
    bar: 'bg-slate-600',
  },
};
const DEFAULT_ACTION_TYPE_STYLE = {
  badge: 'bg-slate-100 text-slate-700 border-slate-200',
  bar: 'bg-[#0b5f87]',
};
const CSV_COLUMNS = [
  'blueprint_course_id',
  'blueprint_course_code',
  'blueprint_course_name',
  'assignment_id',
  'assignment_title',
  'assignment_due_date',
  'action_type',
  'week_of_term',
  'day_of_week',
  'percent',
  'start_date',
  'due_date',
  'expiration_date',
  'reason',
  'description',
  'aggregate_assignment_ids',
];

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    if (ch !== '\r') cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
const createEmptyRow = () => ({
  assignment_id: '',
  action_type: '',
  percent: '',
  reason: '',
  description: '',
  aggregate_assignment_ids: [],
  week_of_term: '',
  day_of_week: '',
  start_date: '',
  due_date: '',
  expiration_date: '',
  calc_key: '',
});
const createEmptyNewCourseAssignment = () => ({
  title: '',
  assignment_due_date: '',
  points_possible: '',
});
const createEmptyManagedAssignment = () => ({
  id: '',
  title: '',
  assignment_due_date: '',
  points_possible: '',
});

function toInputDateTimeValue(date) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

function toIsoWithOffsetFromInput(value) {
  if (!value) return '';
  return format(parseISO(value), "yyyy-MM-dd'T'HH:mm:ssxxx");
}

function toValidPositiveInt(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeDateToInput(value) {
  const raw = String(value || '').replace(/\u00a0/g, ' ').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);

  // Parse only explicit date tokens and ignore time to avoid ambiguous conversions.
  const token = raw.match(/(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})/)?.[0] || '';
  if (token) {
    const parts = token.split(/[/-]/).map((p) => Number(p));
    if (parts.length === 3) {
      let year;
      let month;
      let day;

      if (String(parts[0]).length === 4) {
        // yyyy-mm-dd or yyyy/m/d
        year = parts[0];
        month = parts[1];
        day = parts[2];
      } else {
        // m/d/yy or m/d/yyyy
        month = parts[0];
        day = parts[1];
        year = String(parts[2]).length === 2 ? 2000 + parts[2] : parts[2];
      }

      const dt = new Date(year, month - 1, day);
      if (dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day) {
        return format(dt, 'yyyy-MM-dd');
      }
    }
  }

  // Optional support for Excel serial dates (days since 1899-12-30).
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (Number.isFinite(serial) && serial > 0) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const dt = new Date(epoch.getTime() + Math.floor(serial) * 24 * 60 * 60 * 1000);
      return format(dt, 'yyyy-MM-dd');
    }
  }

  const isoDate = parseISO(raw);
  if (isValid(isoDate)) return format(isoDate, 'yyyy-MM-dd');
  return '';
}

function formatFriendlyDateTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const parsed = parseISO(raw);
  if (isValid(parsed)) return format(parsed, 'MMM d, yyyy h:mm a');

  const normalized = normalizeDateToInput(raw);
  if (normalized) return format(parseISO(`${normalized}T00:00:00`), 'MMM d, yyyy');
  return raw;
}

function computeDates(blockStartDate, week, day) {
  const blockStart = parseISO(blockStartDate);
  const blockWeekSunday = startOfWeek(blockStart, { weekStartsOn: 0 });
  const offsetDays = (Number(week) - 1) * 7 + (Number(day) - 1);
  const startFromWeekDay = set(addDays(blockWeekSunday, offsetDays), {
    hours: 0,
    minutes: 0,
    seconds: 0,
    milliseconds: 0,
  });
  const startDate = startFromWeekDay;
  const dueDate = addDays(startDate, 3);
  const saturday = addDays(startOfWeek(startDate, { weekStartsOn: 0 }), 6);
  const expirationDate = set(saturday, { hours: 23, minutes: 59, seconds: 0, milliseconds: 0 });

  return {
    start: toInputDateTimeValue(startDate),
    due: toInputDateTimeValue(dueDate),
    expiration: toInputDateTimeValue(expirationDate),
  };
}

function CourseSelector({ onSelectCourse, onProceedWithoutBlueprint }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [result, setResult] = useState({ page: 1, totalPages: 1, results: [] });
  const listRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await mockApi.searchBlueprintCourses(query, page);
        setResult(res);
        setHighlighted(res.results.length ? 0 : -1);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [query, page]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (!listRef.current || highlighted < 0) return;
    const selectedEl = listRef.current.querySelector(`[data-row="${highlighted}"]`);
    if (selectedEl) selectedEl.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  function chooseCourse(course) {
    onSelectCourse(course);
    setQuery(`${course.course_code} - ${course.name}`);
    setIsOpen(false);
  }

  return (
    <section className="rounded-md border border-slate-300 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#00597b]">Course Selector</h2>
        <button
          type="button"
          onClick={() => {
            onProceedWithoutBlueprint();
            setQuery('');
            setIsOpen(false);
          }}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          Proceed without blueprint
        </button>
      </div>

      <div className="relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (!isOpen) setIsOpen(true);
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlighted((curr) => Math.min(curr + 1, result.results.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlighted((curr) => Math.max(curr - 1, 0));
            }
            if (e.key === 'Enter' && highlighted >= 0 && result.results[highlighted]) {
              e.preventDefault();
              chooseCourse(result.results[highlighted]);
            }
            if (e.key === 'Escape') setIsOpen(false);
          }}
          placeholder="Search blueprint course (name/code/term)"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#00597b] focus:outline-none"
        />

        {isOpen && (
          <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-300 bg-white shadow-lg">
            <div ref={listRef} className="max-h-60 overflow-auto p-1">
              {isLoading && <p className="px-2 py-2 text-sm text-slate-500">Searching...</p>}
              {!isLoading && result.results.length === 0 && <p className="px-2 py-2 text-sm text-slate-500">No courses found.</p>}
              {!isLoading &&
                result.results.map((course, idx) => (
                  <button
                    key={course.id}
                    data-row={idx}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      chooseCourse(course);
                    }}
                    className={`w-full rounded-md px-2 py-2 text-left text-sm ${
                      idx === highlighted ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-medium text-slate-800">{course.name}</div>
                    <div className="text-xs text-slate-500">
                      {course.course_code} • {course.term} • block start {course.block_start_date}
                    </div>
                  </button>
                ))}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-2 py-1.5 text-xs text-slate-600">
              <button
                type="button"
                disabled={!result.hasPrevPage}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.max(1, p - 1));
                }}
                className="rounded border border-slate-300 px-2 py-0.5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              <span>
                Page {result.page} / {result.totalPages}
              </span>
              <button
                type="button"
                disabled={!result.hasNextPage}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setPage((p) => p + 1);
                }}
                className="rounded border border-slate-300 px-2 py-0.5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function IMSBlueprintFlow() {
  const {
    control,
    register,
    setValue,
    trigger,
    getValues,
    formState: { errors },
  } = useForm({
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      blueprint_course_id: null,
      assignment_rows: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'assignment_rows',
  });

  const [selectedCourse, setSelectedCourse] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPayloadOpen, setIsPayloadOpen] = useState(false);
  const [csvNotice, setCsvNotice] = useState('');
  const [courseSaveNotice, setCourseSaveNotice] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseTerm, setNewCourseTerm] = useState('');
  const [newCourseBlockStartDate, setNewCourseBlockStartDate] = useState('');
  const [newCourseAssignments, setNewCourseAssignments] = useState([createEmptyNewCourseAssignment()]);
  const [activeAppTab, setActiveAppTab] = useState('action');
  const [activeTab, setActiveTab] = useState('table');
  const [columnSort, setColumnSort] = useState({ key: 'none', dir: 'none' });
  const [chronologicalSortDir, setChronologicalSortDir] = useState('none');
  const [activeDetailsRowId, setActiveDetailsRowId] = useState(null);
  const [collapsedTimelineWeeks, setCollapsedTimelineWeeks] = useState({});
  const [courseCatalog, setCourseCatalog] = useState([]);
  const [managedCourseId, setManagedCourseId] = useState('');
  const [managedCourseName, setManagedCourseName] = useState('');
  const [managedCourseCode, setManagedCourseCode] = useState('');
  const [managedCourseTerm, setManagedCourseTerm] = useState('');
  const [managedCourseBlockStartDate, setManagedCourseBlockStartDate] = useState('');
  const [managedAssignments, setManagedAssignments] = useState([createEmptyManagedAssignment()]);
  const [managedLoading, setManagedLoading] = useState(false);
  const [managedNotice, setManagedNotice] = useState('');
  const csvInputRef = useRef(null);
  const managedCsvInputRef = useRef(null);

  const rows = useWatch({ control, name: 'assignment_rows' }) || [];
  const sortedAssignments = useMemo(
    () => [...assignments].sort((a, b) => a.title.localeCompare(b.title)),
    [assignments]
  );
  const sortedCourseCatalog = useMemo(
    () =>
      [...courseCatalog].sort((a, b) =>
        `${a.course_code} - ${a.name}`.localeCompare(`${b.course_code} - ${b.name}`)
      ),
    [courseCatalog]
  );
  const assignmentTitleById = useMemo(
    () =>
      Object.fromEntries(assignments.map((assignment) => [String(assignment.id), assignment.title])),
    [assignments]
  );
  const assignmentDueDateById = useMemo(
    () =>
      Object.fromEntries(assignments.map((assignment) => [String(assignment.id), assignment.assignment_due_date || ''])),
    [assignments]
  );
  const assignmentTitleByIdLower = useMemo(
    () =>
      Object.fromEntries(assignments.map((assignment) => [String(assignment.id), String(assignment.title || '').trim().toLowerCase()])),
    [assignments]
  );
  const selectedManagedCourse = useMemo(
    () => courseCatalog.find((course) => String(course.id) === String(managedCourseId)) || null,
    [courseCatalog, managedCourseId]
  );

  useEffect(() => {
    if (!selectedManagedCourse) {
      setManagedCourseName('');
      setManagedCourseCode('');
      setManagedCourseTerm('');
      setManagedCourseBlockStartDate('');
      return;
    }
    setManagedCourseName(String(selectedManagedCourse.name || ''));
    setManagedCourseCode(String(selectedManagedCourse.course_code || ''));
    setManagedCourseTerm(String(selectedManagedCourse.term || ''));
    setManagedCourseBlockStartDate(String(selectedManagedCourse.block_start_date || '').slice(0, 10));
  }, [selectedManagedCourse]);

  useEffect(() => {
    if (!selectedCourse) return;

    rows.forEach((row, idx) => {
      if (!row?.assignment_id || !row?.action_type || row.week_of_term === '' || row.day_of_week === '') return;
      const assignmentDueDate = assignmentDueDateById[String(row.assignment_id)] || '';
      if (!assignmentDueDate) return;

      const nextKey = `${selectedCourse.id}|${row.assignment_id}|${row.action_type}|${row.week_of_term}|${row.day_of_week}|${assignmentDueDate}`;
      if (row.calc_key === nextKey) return;

      const computed = computeDates(selectedCourse.block_start_date, row.week_of_term, row.day_of_week);
      setValue(`assignment_rows.${idx}.start_date`, computed.start, { shouldDirty: true, shouldValidate: true });
      setValue(`assignment_rows.${idx}.due_date`, computed.due, { shouldDirty: true, shouldValidate: true });
      setValue(`assignment_rows.${idx}.expiration_date`, computed.expiration, { shouldDirty: true, shouldValidate: true });
      setValue(`assignment_rows.${idx}.calc_key`, nextKey, { shouldDirty: true });
    });
  }, [rows, selectedCourse, assignmentDueDateById, setValue]);

  useEffect(() => {
    rows.forEach((row, idx) => {
      const title = assignmentTitleByIdLower[String(row?.assignment_id)] || '';
      const isAllStudents = title === 'all students';
      const isMultipleAssignments = title === 'multiple assignments';
      const allowed = isAllStudents
        ? ALL_STUDENTS_ACTION_TYPES
        : isMultipleAssignments
          ? MULTI_ASSIGNMENT_ACTION_TYPES
          : STANDARD_ASSIGNMENT_ACTION_TYPES;
      if (row?.action_type && !allowed.includes(row.action_type)) {
        setValue(`assignment_rows.${idx}.action_type`, allowed[0] || '', {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    });
  }, [rows, assignmentTitleByIdLower, setValue]);

  async function handleCourseSelect(course) {
    setSelectedCourse(course);
    setValue('blueprint_course_id', course.id);
    setColumnSort({ key: 'none', dir: 'none' });
    setChronologicalSortDir('none');
    setActiveDetailsRowId(null);
    setLoadingAssignments(true);
    try {
      const list = await mockApi.listAssignmentsForCourse(course.id);
      setAssignments(list);
      replace([createEmptyRow()]);
    } finally {
      setLoadingAssignments(false);
    }
  }

  function handleProceedWithoutBlueprint() {
    setSelectedCourse(null);
    setAssignments([]);
    setValue('blueprint_course_id', null);
    replace([]);
    setColumnSort({ key: 'none', dir: 'none' });
    setChronologicalSortDir('none');
    setActiveDetailsRowId(null);
  }

  function addEmptyRow() {
    append(createEmptyRow());
  }

  function getSortIndicator(columnKey) {
    if (columnSort.key !== columnKey) return '↕';
    return columnSort.dir === 'asc' ? '↑' : '↓';
  }

  function sortByColumn(columnKey, getComparable) {
    if (!rows.length) return;
    const nextDir = columnSort.key === columnKey && columnSort.dir === 'asc' ? 'desc' : 'asc';
    const sortedRows = [...rows].sort((a, b) => {
      const aValue = getComparable(a);
      const bValue = getComparable(b);
      if (aValue === bValue) return 0;
      if (nextDir === 'asc') return aValue > bValue ? 1 : -1;
      return aValue > bValue ? -1 : 1;
    });
    replace(sortedRows);
    setColumnSort({ key: columnKey, dir: nextDir });
    setChronologicalSortDir('none');
    setActiveDetailsRowId(null);
  }

  function sortByAssignment() {
    sortByColumn('assignment', (row) => (assignmentTitleById[String(row.assignment_id)] || '').toLowerCase());
  }

  function sortByActionType() {
    sortByColumn('action_type', (row) => String(row.action_type || '').toLowerCase());
  }

  function sortByAssignmentDueDate() {
    sortByColumn('assignment_due_date', (row) => {
      const due = assignmentDueDateById[String(row.assignment_id)] || '';
      if (!due) return Number.POSITIVE_INFINITY;
      const ts = parseISO(due).getTime();
      return Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY;
    });
  }

  function sortByWeek() {
    sortByColumn('week_of_term', (row) => (row.week_of_term === '' ? Number.POSITIVE_INFINITY : Number(row.week_of_term)));
  }

  function sortByDay() {
    sortByColumn('day_of_week', (row) => (row.day_of_week === '' ? Number.POSITIVE_INFINITY : Number(row.day_of_week)));
  }

  function sortByChronological() {
    if (!rows.length) return;
    const nextDir = chronologicalSortDir === 'asc' ? 'desc' : 'asc';
    const toNumber = (v) => {
      if (v === '' || v === null || v === undefined) return Number.POSITIVE_INFINITY;
      const n = Number(v);
      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
    };
    const sortedRows = [...rows].sort((a, b) => {
      const aWeek = toNumber(a.week_of_term);
      const bWeek = toNumber(b.week_of_term);
      if (aWeek !== bWeek) return nextDir === 'asc' ? aWeek - bWeek : bWeek - aWeek;

      const aDay = toNumber(a.day_of_week);
      const bDay = toNumber(b.day_of_week);
      return nextDir === 'asc' ? aDay - bDay : bDay - aDay;
    });
    replace(sortedRows);
    setChronologicalSortDir(nextDir);
    setColumnSort({ key: 'none', dir: 'none' });
    setActiveDetailsRowId(null);
  }

  const activeDetailsRowIndex = useMemo(
    () => fields.findIndex((field) => field.id === activeDetailsRowId),
    [fields, activeDetailsRowId]
  );

  useEffect(() => {
    if (activeDetailsRowIndex < 0) return;
    void trigger([
      `assignment_rows.${activeDetailsRowIndex}.start_date`,
      `assignment_rows.${activeDetailsRowIndex}.due_date`,
      `assignment_rows.${activeDetailsRowIndex}.expiration_date`,
    ]);
  }, [activeDetailsRowIndex, trigger]);

  const payload = useMemo(
    () => ({
      blueprint_course_id: selectedCourse?.id ?? null,
      assignments: rows.filter((row) => row.assignment_id !== '').map((row) => ({
        assignment_id: row.assignment_id === '' ? null : Number(row.assignment_id),
        action_type: row.action_type || null,
        percent: row.percent === '' ? null : Number(row.percent),
        reason: row.reason || '',
        description: row.description || '',
        aggregate_assignment_ids: Array.isArray(row.aggregate_assignment_ids)
          ? row.aggregate_assignment_ids
              .map((id) => Number(id))
              .filter((id) => Number.isFinite(id))
          : [],
        week_of_term: row.week_of_term === '' ? null : Number(row.week_of_term),
        day_of_week: row.day_of_week === '' ? null : Number(row.day_of_week),
        calculated_start_date: toIsoWithOffsetFromInput(row.start_date),
        calculated_due_date: toIsoWithOffsetFromInput(row.due_date),
        calculated_expire_on: toIsoWithOffsetFromInput(row.expiration_date),
      })),
    }),
    [rows, selectedCourse]
  );

  const timelineRows = useMemo(() => {
    return rows
      .filter((row) => row.assignment_id !== '' && row.start_date && row.expiration_date)
      .map((row) => {
        const assignmentId = String(row.assignment_id);
        const startDate = parseISO(row.start_date);
        const expirationDate = parseISO(row.expiration_date);
        const actionDueDate = row.due_date ? parseISO(row.due_date) : null;
        const assignmentDueValue = assignmentDueDateById[assignmentId] || '';
        const assignmentDueDate = assignmentDueValue ? parseISO(assignmentDueValue) : null;
        return {
          assignmentId,
          title: assignmentTitleById[assignmentId] || `Assignment ${assignmentId}`,
          actionType: row.action_type || 'Unspecified',
          reason: row.reason || '',
          description: row.description || '',
          startDate,
          actionDueDate,
          expirationDate,
          assignmentDueDate,
        };
      })
      .filter((row) => Number.isFinite(row.startDate.getTime()) && Number.isFinite(row.expirationDate.getTime()))
      .sort((a, b) => {
        const delta = a.startDate.getTime() - b.startDate.getTime();
        if (delta !== 0) return delta;
        return a.title.localeCompare(b.title);
      });
  }, [rows, assignmentTitleById, assignmentDueDateById]);

  const timelineRange = useMemo(() => {
    if (!timelineRows.length) return null;
    const starts = timelineRows.map((r) => r.startDate.getTime());
    const expirations = timelineRows.map((r) => r.expirationDate.getTime());
    const actionDue = timelineRows
      .map((r) => r.actionDueDate?.getTime())
      .filter((t) => Number.isFinite(t));
    const assignmentDue = timelineRows
      .map((r) => r.assignmentDueDate?.getTime())
      .filter((t) => Number.isFinite(t));

    const minTs = Math.min(...starts, ...(assignmentDue.length ? assignmentDue : starts));
    let maxTs = Math.max(...expirations, ...(actionDue.length ? actionDue : expirations));
    if (maxTs <= minTs) maxTs = minTs + 24 * 60 * 60 * 1000;
    return { minTs, maxTs };
  }, [timelineRows]);

  const timelineGroups = useMemo(() => {
    const groups = new Map();
    timelineRows.forEach((row) => {
      const basis = row.assignmentDueDate || row.startDate;
      const weekStart = startOfWeek(basis, { weekStartsOn: 0 });
      const key = format(weekStart, 'yyyy-MM-dd');
      if (!groups.has(key)) {
        groups.set(key, { key, weekStart, rows: [] });
      }
      groups.get(key).rows.push(row);
    });

    return [...groups.values()].sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  }, [timelineRows]);

  async function copyPayload() {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  }

  async function refreshCourseCatalog() {
    try {
      const list = await mockApi.listAllCourses();
      setCourseCatalog(list);
    } catch {
      setCourseCatalog([]);
    }
  }

  useEffect(() => {
    void refreshCourseCatalog();
  }, []);

  function exportConfigCsv() {
    if (!selectedCourse) {
      setCsvNotice('Select a course before exporting CSV.');
      return;
    }
    const exportRows = rows.filter((row) => row.assignment_id !== '').map((row) => {
      const assignmentId = String(row.assignment_id);
      return [
        selectedCourse.id,
        selectedCourse.course_code,
        selectedCourse.name,
        row.assignment_id,
        assignmentTitleById[assignmentId] || '',
        assignmentDueDateById[assignmentId] || '',
        row.action_type || '',
        row.week_of_term ?? '',
        row.day_of_week ?? '',
        row.percent ?? '',
        row.start_date || '',
        row.due_date || '',
        row.expiration_date || '',
        row.reason || '',
        row.description || '',
        Array.isArray(row.aggregate_assignment_ids) ? row.aggregate_assignment_ids.join('|') : '',
      ];
    });

    const lines = [CSV_COLUMNS.join(',')];
    exportRows.forEach((r) => lines.push(r.map(csvEscape).join(',')));
    const csvText = lines.join('\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const coursePart = (selectedCourse.course_code || 'course').replace(/[^a-z0-9-_]+/gi, '_');
    a.href = url;
    a.download = `${coursePart}_assignment_config.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setCsvNotice(`Exported ${exportRows.length} assignment rows.`);
  }

  async function importConfigCsv(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.length) throw new Error('CSV is empty.');
      const header = parsed[0];
      const rowsParsed = parsed.slice(1).filter((r) => r.some((c) => c && c.trim() !== ''));
      const idx = Object.fromEntries(header.map((h, i) => [h, i]));

      const courseIdRaw = rowsParsed[0]?.[idx.blueprint_course_id];
      const courseId = Number(courseIdRaw);
      if (!Number.isFinite(courseId)) throw new Error('Missing or invalid blueprint_course_id in CSV.');

      // Resolve course from mock API search pages.
      let foundCourse = null;
      let page = 1;
      let keepGoing = true;
      while (keepGoing) {
        const result = await mockApi.searchBlueprintCourses('', page);
        foundCourse = result.results.find((c) => c.id === courseId) || null;
        if (foundCourse || !result.hasNextPage) keepGoing = false;
        page += 1;
      }
      if (!foundCourse) throw new Error(`Course ${courseId} not found in sample data.`);

      await handleCourseSelect(foundCourse);

      const importedRows = rowsParsed.map((r) => ({
        assignment_id: r[idx.assignment_id] || '',
        action_type: r[idx.action_type] || '',
        percent: r[idx.percent] || '',
        reason: r[idx.reason] || '',
        description: r[idx.description] || '',
        aggregate_assignment_ids: String(r[idx.aggregate_assignment_ids] || '')
          .split('|')
          .map((id) => id.trim())
          .filter(Boolean),
        week_of_term: r[idx.week_of_term] || '',
        day_of_week: r[idx.day_of_week] || '',
        start_date: r[idx.start_date] || '',
        due_date: r[idx.due_date] || '',
        expiration_date: r[idx.expiration_date] || '',
        calc_key: '',
      }));
      replace(importedRows.length ? importedRows : [createEmptyRow()]);
      setCsvNotice(`Imported ${importedRows.length} assignment rows for ${foundCourse.course_code}.`);
    } catch (err) {
      setCsvNotice(err?.message || 'Failed to import CSV.');
    }
  }

  async function saveAsNewCourse() {
    try {
      const name = newCourseName.trim();
      const code = newCourseCode.trim();
      const term = newCourseTerm.trim();
      const blockStart = newCourseBlockStartDate.trim();
      if (!name || !code || !term || !blockStart) {
        throw new Error('Name, code, term, and block start date are required.');
      }

      const assignmentList = newCourseAssignments
        .map((assignment) => ({
          title: String(assignment.title || '').trim(),
          dueDate: String(assignment.assignment_due_date || '').trim(),
          points: String(assignment.points_possible || '').trim(),
        }))
        .filter((assignment) => assignment.title || assignment.dueDate || assignment.points)
        .map((assignment) => {
          if (!assignment.title || !assignment.dueDate) {
            throw new Error('Each assignment row must include title and due date.');
          }
          const dueValue = assignment.dueDate.includes('T')
            ? assignment.dueDate
            : `${assignment.dueDate}T23:59:00`;
          return {
            title: assignment.title,
            assignment_due_date: dueValue,
            points_possible: assignment.points === '' ? 0 : Number(assignment.points),
          };
        });

      if (!assignmentList.length) {
        throw new Error('Add at least one assignment before saving a new course.');
      }

      const created = await mockApi.createCourseWithAssignments(
        {
          name,
          course_code: code,
          term,
          block_start_date: blockStart,
        },
        assignmentList
      );
      setCourseSaveNotice(`Saved ${created.course_code} with ${assignmentList.length} assignments.`);
      await refreshCourseCatalog();
      setNewCourseName('');
      setNewCourseCode('');
      setNewCourseTerm('');
      setNewCourseBlockStartDate('');
      setNewCourseAssignments([createEmptyNewCourseAssignment()]);
    } catch (err) {
      setCourseSaveNotice(err?.message || 'Failed to save course.');
    }
  }

  async function handleManagedCourseSelect(courseIdValue) {
    setManagedCourseId(courseIdValue);
    setManagedNotice('');
    if (!courseIdValue) {
      setManagedAssignments([createEmptyManagedAssignment()]);
      return;
    }
    setManagedLoading(true);
    try {
      const list = await mockApi.listAssignmentsForCourse(Number(courseIdValue));
      setManagedAssignments(
        list.length
          ? list.map((a) => ({
              id: a.id,
              title: a.title || '',
              assignment_due_date: normalizeDateToInput(a.assignment_due_date),
              points_possible: a.points_possible ?? '',
            }))
          : [createEmptyManagedAssignment()]
      );
    } finally {
      setManagedLoading(false);
    }
  }

  function addManagedAssignmentRow() {
    setManagedAssignments((prev) => [...prev, createEmptyManagedAssignment()]);
  }

  function updateManagedAssignmentRow(index, patch) {
    setManagedAssignments((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row))
    );
  }

  function removeManagedAssignmentRow(index) {
    setManagedAssignments((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.length ? next : [createEmptyManagedAssignment()];
    });
  }

  async function importManagedAssignmentsCsv(file) {
    if (!file) return;
    try {
      if (!managedCourseId) throw new Error('Select a course before importing CSV.');
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.length) throw new Error('CSV is empty.');

      const header = parsed[0].map((h) =>
        String(h || '')
          .replace(/^\uFEFF/, '')
          .replace(/\u200B/g, '')
          .trim()
          .toLowerCase()
      );
      const rowsParsed = parsed.slice(1).filter((r) => r.some((c) => String(c || '').trim() !== ''));
      if (!rowsParsed.length) throw new Error('CSV has no assignment rows.');

      const indexOf = (...names) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
      const idIdx = indexOf('id', 'assignment_id');
      const titleIdx = indexOf('title', 'assignment_title');
      const dueIdx = indexOf('assignment_due_date', 'due_date', 'due date');
      const pointsIdx = indexOf('points_possible', 'points', 'points possible');

      if (titleIdx < 0 || dueIdx < 0) {
        throw new Error('CSV must include title and assignment_due_date (or due_date) columns.');
      }

      const imported = rowsParsed.map((row, idx) => {
        const title = String(row[titleIdx] || '').trim();
        const dueRaw = String(row[dueIdx] || '').trim();
        const dueDate = normalizeDateToInput(dueRaw);
        const points = pointsIdx >= 0 ? String(row[pointsIdx] || '').trim() : '';
        const idRaw = idIdx >= 0 ? String(row[idIdx] || '').trim() : '';
        if (!title || !dueDate) throw new Error(`Row ${idx + 2} must include title and a valid due date.`);
        return {
          id: idRaw,
          title,
          assignment_due_date: dueDate,
          points_possible: points,
        };
      });

      setManagedAssignments(imported.length ? imported : [createEmptyManagedAssignment()]);
      setManagedNotice(`Imported ${imported.length} assignments from CSV. Click "Save Course Assignments" to persist.`);
    } catch (err) {
      setManagedNotice(err?.message || 'Failed to import assignment CSV.');
    }
  }

  async function saveManagedAssignments() {
    try {
      if (!managedCourseId) throw new Error('Select a course first.');
      const metadataPayload = {
        name: managedCourseName.trim(),
        course_code: managedCourseCode.trim(),
        term: managedCourseTerm.trim(),
        block_start_date: managedCourseBlockStartDate.trim(),
      };
      if (!metadataPayload.name || !metadataPayload.course_code || !metadataPayload.term || !metadataPayload.block_start_date) {
        throw new Error('Course name, code, term, and block start date are required.');
      }
      const cleaned = managedAssignments
        .map((a) => ({
          id: a.id,
          title: String(a.title || '').trim(),
          assignment_due_date: normalizeDateToInput(a.assignment_due_date),
          points_possible: String(a.points_possible || '').trim(),
        }))
        .filter((a) => a.title || a.assignment_due_date || a.points_possible);
      if (!cleaned.length) throw new Error('Add at least one assignment row.');

      const assignmentsPayload = cleaned.map((a, idx) => {
        if (!a.title || !a.assignment_due_date) {
          throw new Error('Each assignment must include title and due date.');
        }
        return {
          id: toValidPositiveInt(a.id) ?? Number(`${managedCourseId}${idx + 1}`),
          title: a.title,
          assignment_due_date: `${a.assignment_due_date}T23:59:00`,
          points_possible: a.points_possible === '' ? 0 : Number(a.points_possible),
        };
      });

      const updatedCourse = await mockApi.updateCourseMetadata(Number(managedCourseId), metadataPayload);
      await mockApi.saveAssignmentsForCourse(Number(managedCourseId), assignmentsPayload);
      setManagedNotice(`Saved ${updatedCourse.course_code} and ${assignmentsPayload.length} assignments.`);
      await refreshCourseCatalog();
      if (selectedCourse && Number(selectedCourse.id) === Number(managedCourseId)) {
        setSelectedCourse(updatedCourse);
      }
    } catch (err) {
      setManagedNotice(err?.message || 'Failed to save assignments.');
    }
  }

  async function deleteManagedCourse() {
    try {
      if (!managedCourseId) throw new Error('Select a course first.');
      const selected = selectedManagedCourse;
      const label = selected ? `${selected.course_code} - ${selected.name}` : `Course ${managedCourseId}`;
      if (!window.confirm(`Delete ${label} and all associated assignments? This cannot be undone.`)) return;

      await mockApi.deleteCourse(Number(managedCourseId));
      if (selectedCourse && Number(selectedCourse.id) === Number(managedCourseId)) {
        handleProceedWithoutBlueprint();
      }
      setManagedCourseId('');
      setManagedAssignments([createEmptyManagedAssignment()]);
      setManagedNotice(`Deleted ${label}.`);
      await refreshCourseCatalog();
    } catch (err) {
      setManagedNotice(err?.message || 'Failed to delete course.');
    }
  }

  function addNewCourseAssignmentRow() {
    setNewCourseAssignments((prev) => [...prev, createEmptyNewCourseAssignment()]);
  }

  function updateNewCourseAssignmentRow(index, patch) {
    setNewCourseAssignments((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row))
    );
  }

  function removeNewCourseAssignmentRow(index) {
    setNewCourseAssignments((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.length ? next : [createEmptyNewCourseAssignment()];
    });
  }

  function timelinePercent(date) {
    if (!timelineRange || !date) return 0;
    const span = timelineRange.maxTs - timelineRange.minTs;
    if (span <= 0) return 0;
    const value = ((date.getTime() - timelineRange.minTs) / span) * 100;
    return Math.min(100, Math.max(0, value));
  }

  function toggleTimelineWeek(weekKey) {
    setCollapsedTimelineWeeks((prev) => ({ ...prev, [weekKey]: !prev[weekKey] }));
  }

  return (
    <main className="min-h-screen bg-[#e5e7ea] text-slate-900">
      <div className="bg-[#f4c20d] px-6 py-4">
        <div className="mx-auto flex max-w-[1400px] items-center">
          <h1 className="text-[2rem] font-bold leading-none tracking-tight text-black">Instruction Management System</h1>
        </div>
      </div>
      <div className="mx-auto max-w-[1400px] space-y-4 p-6">
        <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setActiveAppTab('action')}
            className={`rounded px-3 py-1 text-xs font-semibold ${
              activeAppTab === 'action' ? 'bg-[#0b5f87] text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Action Configuration
          </button>
          <button
            type="button"
            onClick={() => setActiveAppTab('course')}
            className={`rounded px-3 py-1 text-xs font-semibold ${
              activeAppTab === 'course' ? 'bg-[#0b5f87] text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Course Management
          </button>
          <button
            type="button"
            onClick={() => setActiveAppTab('admin')}
            className={`rounded px-3 py-1 text-xs font-semibold ${
              activeAppTab === 'admin' ? 'bg-[#0b5f87] text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Admin
          </button>
        </div>

        {activeAppTab === 'action' && (
          <>
            <CourseSelector onSelectCourse={handleCourseSelect} onProceedWithoutBlueprint={handleProceedWithoutBlueprint} />

        <section className="rounded-md border border-slate-300 bg-[#eef0f2] p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#00597b]">Assignments</h2>
            <div className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab('table')}
                className={`rounded px-3 py-1 text-xs font-semibold ${
                  activeTab === 'table' ? 'bg-[#0b5f87] text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`rounded px-3 py-1 text-xs font-semibold ${
                  activeTab === 'timeline' ? 'bg-[#0b5f87] text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Timeline
              </button>
            </div>
          </div>

        {!selectedCourse && <p className="text-sm text-slate-500">Pick a blueprint course first.</p>}
        {selectedCourse && (
          <div className="mb-3 rounded-md bg-slate-50 p-2 text-sm text-slate-700">
            Selected course: <span className="font-medium">{selectedCourse.name}</span> ({selectedCourse.course_code})
          </div>
        )}

        {loadingAssignments && <p className="text-sm text-slate-500">Loading assignments...</p>}

        {activeTab === 'table' && fields.length === 0 && selectedCourse && !loadingAssignments && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-500">No rows yet.</p>
            <button
              type="button"
              onClick={addEmptyRow}
              className="rounded-md bg-[#00597b] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#004965]"
            >
              Add assignment
            </button>
          </div>
        )}

        {activeTab === 'table' && fields.length > 0 && (
          <div className="overflow-x-auto">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={sortByChronological}
                className="inline-flex items-center gap-1 rounded-md bg-[#00597b] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#004965]"
              >
                Chronological Sort (Week -&gt; Day)
                <span className="text-white/80">
                  {chronologicalSortDir === 'asc' ? '↑' : chronologicalSortDir === 'desc' ? '↓' : '↕'}
                </span>
              </button>
            </div>
            <table className="min-w-[1180px] table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[380px]" />
                <col className="w-[210px]" />
                <col className="w-[240px]" />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[100px]" />
                <col className="w-[90px]" />
              </colgroup>
              <thead>
                <tr className="bg-[#f5f6f7] text-slate-800">
                  <th className="border border-slate-200 px-2 py-2 text-left">
                    <button
                      type="button"
                      onClick={sortByAssignment}
                      className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                    >
                      Assignment
                      <span className="text-xs text-slate-500">
                        {getSortIndicator('assignment')}
                      </span>
                    </button>
                  </th>
                  <th className="border border-slate-200 px-2 py-2 text-left">
                    <button
                      type="button"
                      onClick={sortByAssignmentDueDate}
                      className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                    >
                      Assignment Due Date
                      <span className="text-xs text-slate-500">{getSortIndicator('assignment_due_date')}</span>
                    </button>
                  </th>
                  <th className="border border-slate-200 px-2 py-2 text-left">
                    <button
                      type="button"
                      onClick={sortByActionType}
                      className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                    >
                      Action Type
                      <span className="text-xs text-slate-500">{getSortIndicator('action_type')}</span>
                    </button>
                  </th>
                  <th className="border border-slate-200 px-2 py-2 text-left">
                    <button
                      type="button"
                      onClick={sortByWeek}
                      className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                    >
                      Week of Term
                      <span className="text-xs text-slate-500">
                        {getSortIndicator('week_of_term')}
                      </span>
                    </button>
                  </th>
                  <th className="border border-slate-200 px-2 py-2 text-left">
                    <button
                      type="button"
                      onClick={sortByDay}
                      className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900"
                    >
                      Day of Week
                      <span className="text-xs text-slate-500">{getSortIndicator('day_of_week')}</span>
                    </button>
                  </th>
                  <th className="border border-slate-200 px-2 py-2 text-left">Details</th>
                  <th className="border border-slate-200 px-2 py-2 text-left">Row</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, idx) => {
                  const row = rows[idx] || {};
                  const assignmentDueDate = assignmentDueDateById[String(row.assignment_id)] || '';
                  const assignmentTitleLower = assignmentTitleByIdLower[String(row.assignment_id)] || '';
                  const isAllStudentsAssignment = assignmentTitleLower === 'all students';
                  const isMultipleAssignments = assignmentTitleLower === 'multiple assignments';
                  const enableActionType = Boolean(row.assignment_id);
                  const enableWeekDay = enableActionType && Boolean(row.action_type);
                  const rowErrors = errors.assignment_rows?.[idx];
                  const rowHasErrors = Boolean(rowErrors && Object.keys(rowErrors).length > 0);
                  const rowActionTypeOptions = isAllStudentsAssignment
                    ? ALL_STUDENTS_ACTION_TYPES
                    : isMultipleAssignments
                      ? MULTI_ASSIGNMENT_ACTION_TYPES
                      : STANDARD_ASSIGNMENT_ACTION_TYPES;

                  return [
                      <tr key={`${field.id}-main`} className={`align-middle ${rowHasErrors ? 'bg-rose-50/60' : 'bg-white'}`}>
                        <td className="border border-slate-200 px-2 py-2">
                          <select
                            {...register(`assignment_rows.${idx}.assignment_id`)}
                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                          >
                            <option value="">Select assignment</option>
                            {sortedAssignments.map((assignment) => (
                              <option key={assignment.id} value={assignment.id}>
                                {assignment.title}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="border border-slate-200 px-2 py-2">
                        <div className="rounded-md bg-slate-50 px-2 py-1.5 text-sm text-slate-700">
                          {formatFriendlyDateTime(assignmentDueDate)}
                        </div>
                      </td>
                      <td className="border border-slate-200 px-2 py-2">
                        <select
                          {...register(`assignment_rows.${idx}.action_type`)}
                            disabled={!enableActionType}
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          <option value="">Select action</option>
                            {rowActionTypeOptions.map((action) => (
                              <option key={action} value={action}>
                                {action}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="border border-slate-200 px-2 py-2">
                          <select
                            {...register(`assignment_rows.${idx}.week_of_term`, {
                              validate: (value) => (value !== '' ? true : 'Week of term is required'),
                            })}
                            disabled={!enableWeekDay}
                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                          >
                            <option value="">Week</option>
                            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                          {errors.assignment_rows?.[idx]?.week_of_term && (
                            <p className="mt-1 text-xs text-rose-600">
                              {errors.assignment_rows[idx].week_of_term.message}
                            </p>
                          )}
                        </td>

                        <td className="border border-slate-200 px-2 py-2">
                          <select
                            {...register(`assignment_rows.${idx}.day_of_week`, {
                              validate: (value) => (value !== '' ? true : 'Day of term is required'),
                            })}
                            disabled={!enableWeekDay}
                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                          >
                            <option value="">Day</option>
                            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                          {errors.assignment_rows?.[idx]?.day_of_week && (
                            <p className="mt-1 text-xs text-rose-600">
                              {errors.assignment_rows[idx].day_of_week.message}
                            </p>
                          )}
                        </td>

                        <td className="border border-slate-200 px-2 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveDetailsRowId((curr) => (curr === field.id ? null : field.id))}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-[#00597b] hover:bg-slate-100"
                            >
                              {activeDetailsRowId === field.id ? 'Hide' : 'Open'}
                            </button>
                            {rowHasErrors && (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                                Has errors
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="border border-slate-200 px-2 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              remove(idx);
                              if (activeDetailsRowId === field.id) setActiveDetailsRowId(null);
                            }}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-[#00597b] hover:bg-slate-100"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>,

                      activeDetailsRowId === field.id ? (
                        <tr key={`${field.id}-details`} className="bg-[#f7f9fb]">
                          <td colSpan={7} className="border border-slate-200 px-3 py-3">
                            <div className="space-y-3 rounded-md border border-slate-300 bg-white p-3">
                              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <div>
                                  <h3 className="text-sm font-semibold uppercase tracking-wide text-[#00597b]">Assignment Settings</h3>
                                  <p className="mt-0.5 text-xs text-slate-600">
                                    {assignmentTitleById[String(row.assignment_id)] || 'Select assignment'}
                                  </p>
                                </div>
                              </div>

                              <div className="grid gap-4 lg:grid-cols-2">
                                <div className="space-y-3">
                                  <label className="text-sm">
                                    <span className="mb-1 block text-xs font-medium text-slate-600">Action Start Date</span>
                                    <input
                                      type="datetime-local"
                                      min={assignmentDueDate ? assignmentDueDate.slice(0, 16) : undefined}
                                      {...register(`assignment_rows.${idx}.start_date`, {
                                        validate: (value) => {
                                          if (!value) return 'Action start date is required';
                                          const assignmentId = getValues(`assignment_rows.${idx}.assignment_id`);
                                          const due = assignmentDueDateById[String(assignmentId)] || '';
                                          if (!due) return true;
                                          return parseISO(value).getTime() >= parseISO(due).getTime()
                                            || 'Action start date cannot be before assignment due date';
                                        },
                                        onChange: () => {
                                          void trigger([
                                            `assignment_rows.${idx}.start_date`,
                                            `assignment_rows.${idx}.due_date`,
                                            `assignment_rows.${idx}.expiration_date`,
                                          ]);
                                        },
                                      })}
                                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                                    />
                                    {errors.assignment_rows?.[idx]?.start_date && (
                                      <p className="mt-1 text-xs text-rose-600">
                                        {errors.assignment_rows[idx].start_date.message}
                                      </p>
                                    )}
                                  </label>

                                  <label className="text-sm">
                                    <span className="mb-1 block text-xs font-medium text-slate-600">Action Due Date</span>
                                    <input
                                      type="datetime-local"
                                      min={row.start_date || undefined}
                                      {...register(`assignment_rows.${idx}.due_date`, {
                                        validate: (value) => {
                                          if (!value) return 'Action due date is required';
                                          const startDate = getValues(`assignment_rows.${idx}.start_date`);
                                          if (!startDate) return true;
                                          return parseISO(value).getTime() >= parseISO(startDate).getTime()
                                            || 'Due date cannot be before start date';
                                        },
                                        onChange: () => {
                                          void trigger([
                                            `assignment_rows.${idx}.start_date`,
                                            `assignment_rows.${idx}.due_date`,
                                            `assignment_rows.${idx}.expiration_date`,
                                          ]);
                                        },
                                      })}
                                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                                    />
                                    {errors.assignment_rows?.[idx]?.due_date && (
                                      <p className="mt-1 text-xs text-rose-600">
                                        {errors.assignment_rows[idx].due_date.message}
                                      </p>
                                    )}
                                  </label>

                                  <label className="text-sm">
                                    <span className="mb-1 block text-xs font-medium text-slate-600">Expiration Date (Sat 11:59pm)</span>
                                    <input
                                      type="datetime-local"
                                      min={row.start_date || undefined}
                                      {...register(`assignment_rows.${idx}.expiration_date`, {
                                        validate: (value) => {
                                          if (!value) return 'Expiration date is required';
                                          const startDate = getValues(`assignment_rows.${idx}.start_date`);
                                          if (!startDate) return true;
                                          return parseISO(value).getTime() >= parseISO(startDate).getTime()
                                            || 'Expiration date cannot be before start date';
                                        },
                                        onChange: () => {
                                          void trigger([
                                            `assignment_rows.${idx}.start_date`,
                                            `assignment_rows.${idx}.due_date`,
                                            `assignment_rows.${idx}.expiration_date`,
                                          ]);
                                        },
                                      })}
                                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                                    />
                                    {errors.assignment_rows?.[idx]?.expiration_date && (
                                      <p className="mt-1 text-xs text-rose-600">
                                        {errors.assignment_rows[idx].expiration_date.message}
                                      </p>
                                    )}
                                  </label>
                                </div>

                                <div className="space-y-3">
                                  <label className="text-sm">
                                    <span className="mb-1 block text-xs font-medium text-slate-600">Reason</span>
                                    <input
                                      type="text"
                                      {...register(`assignment_rows.${idx}.reason`, {
                                        validate: (value) => (value && value.trim() ? true : 'Reason is required'),
                                      })}
                                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                                      placeholder="Reason"
                                    />
                                    {errors.assignment_rows?.[idx]?.reason && (
                                      <p className="mt-1 text-xs text-rose-600">
                                        {errors.assignment_rows[idx].reason.message}
                                      </p>
                                    )}
                                  </label>

                                  <label className="text-sm">
                                    <span className="mb-1 block text-xs font-medium text-slate-600">Description</span>
                                    <textarea
                                      rows={5}
                                      {...register(`assignment_rows.${idx}.description`, {
                                        validate: (value) => (value && value.trim() ? true : 'Description is required'),
                                      })}
                                      className="w-full resize-y rounded-md border border-slate-300 px-2 py-1.5 leading-5 text-sm"
                                      placeholder="Description"
                                    />
                                    {errors.assignment_rows?.[idx]?.description && (
                                      <p className="mt-1 text-xs text-rose-600">
                                        {errors.assignment_rows[idx].description.message}
                                      </p>
                                    )}
                                  </label>

                                  {['High performance aggregate', 'Low performance aggregate'].includes(row.action_type) && (
                                    <label className="block text-sm">
                                      <span className="mb-1 block text-xs font-medium text-slate-600">
                                        Aggregate Assignments (select 2 or more)
                                      </span>
                                      <Controller
                                        control={control}
                                        name={`assignment_rows.${idx}.aggregate_assignment_ids`}
                                        rules={{
                                          validate: (value) => {
                                            if (!['High performance aggregate', 'Low performance aggregate'].includes(getValues(`assignment_rows.${idx}.action_type`))) {
                                              return true;
                                            }
                                            return Array.isArray(value) && value.length >= 2
                                              ? true
                                              : 'Select at least 2 assignments';
                                          },
                                        }}
                                        render={({ field: controllerField }) => {
                                          const selected = Array.isArray(controllerField.value)
                                            ? controllerField.value.map((id) => String(id))
                                            : [];
                                          return (
                                            <div className="max-h-48 overflow-y-auto rounded-md border border-slate-300 bg-slate-50 p-2">
                                              {sortedAssignments.map((assignment) => {
                                                const assignmentId = String(assignment.id);
                                                const checked = selected.includes(assignmentId);
                                                return (
                                                  <label key={`agg-${idx}-${assignment.id}`} className="mb-1 flex items-center gap-2 text-xs text-slate-700 last:mb-0">
                                                    <input
                                                      type="checkbox"
                                                      checked={checked}
                                                      onChange={(e) => {
                                                        const next = e.target.checked
                                                          ? [...selected, assignmentId]
                                                          : selected.filter((id) => id !== assignmentId);
                                                        controllerField.onChange(next);
                                                        void trigger(`assignment_rows.${idx}.aggregate_assignment_ids`);
                                                      }}
                                                      className="h-4 w-4 rounded border-slate-300"
                                                    />
                                                    <span>{assignment.title}</span>
                                                  </label>
                                                );
                                              })}
                                            </div>
                                          );
                                        }}
                                      />
                                      {errors.assignment_rows?.[idx]?.aggregate_assignment_ids && (
                                        <p className="mt-1 text-xs text-rose-600">
                                          {errors.assignment_rows[idx].aggregate_assignment_ids.message}
                                        </p>
                                      )}
                                    </label>
                                  )}

                                  {ACTION_TYPES_REQUIRING_PERCENT.has(row.action_type) && (
                                    <label className="text-sm">
                                      <span className="mb-1 block text-xs font-medium text-slate-600">Percent</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        {...register(`assignment_rows.${idx}.percent`, {
                                          validate: (value) => {
                                            if (!ACTION_TYPES_REQUIRING_PERCENT.has(getValues(`assignment_rows.${idx}.action_type`))) {
                                              return true;
                                            }
                                            return value !== '' ? true : 'Percent is required';
                                          },
                                        })}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                                        placeholder="e.g. 85"
                                      />
                                      {errors.assignment_rows?.[idx]?.percent && (
                                        <p className="mt-1 text-xs text-rose-600">
                                          {errors.assignment_rows[idx].percent.message}
                                        </p>
                                      )}
                                    </label>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null,
                    ];
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="rounded-md border border-slate-300 bg-white">
            {!timelineRows.length && (
              <p className="p-4 text-sm text-slate-500">
                Add and configure assignments in the table to see the timeline view.
              </p>
            )}
            {timelineRows.length > 0 && timelineRange && (
              <div className="overflow-x-auto">
                <div className="grid min-w-[980px] grid-cols-[360px_1fr]">
                  <div className="border-b border-r border-slate-300 bg-[#f5f6f7] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Assignment
                  </div>
                  <div className="border-b border-slate-300 bg-[#f5f6f7] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Timeline ({format(new Date(timelineRange.minTs), 'MMM d, yyyy')} - {format(new Date(timelineRange.maxTs), 'MMM d, yyyy')})
                  </div>

                  {timelineGroups.map((group) => {
                    const isCollapsed = Boolean(collapsedTimelineWeeks[group.key]);
                    const weekEnd = addDays(group.weekStart, 6);
                    return (
                      <div key={group.key} className="contents">
                        <div className="border-b border-r border-slate-300 bg-[#ecf0f3] px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleTimelineWeek(group.key)}
                            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#00597b]"
                          >
                            <span>{isCollapsed ? '▸' : '▾'}</span>
                            Week of {format(group.weekStart, 'MMM d, yyyy')} ({group.rows.length})
                          </button>
                        </div>
                        <div className="border-b border-slate-300 bg-[#ecf0f3] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
                          {format(group.weekStart, 'MMM d')} - {format(weekEnd, 'MMM d')}
                        </div>

                        {!isCollapsed &&
                          group.rows.map((row, rowIdx) => {
                            const startPct = timelinePercent(row.startDate);
                            const endPct = timelinePercent(row.expirationDate);
                            const widthPct = Math.max(1, endPct - startPct);
                            const actionDuePct = row.actionDueDate ? timelinePercent(row.actionDueDate) : null;
                            const assignmentDuePct = row.assignmentDueDate ? timelinePercent(row.assignmentDueDate) : null;
                            const style = ACTION_TYPE_STYLES[row.actionType] || DEFAULT_ACTION_TYPE_STYLE;
                            return (
                              <div key={`${group.key}-${row.assignmentId}-${rowIdx}`} className="contents">
                                <div className="group relative border-b border-r border-slate-200 px-3 py-3">
                                  <div className="text-sm font-medium text-slate-800">{row.title}</div>
                                  <div className="mt-1">
                                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}>
                                      {row.actionType}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    Start: {format(row.startDate, 'MMM d')} • Expire: {format(row.expirationDate, 'MMM d')}
                                  </div>
                                  {(row.reason || row.description) && (
                                    <div className="pointer-events-none absolute left-3 top-full z-20 mt-2 hidden w-[320px] rounded-md border border-slate-300 bg-white p-3 text-xs text-slate-700 shadow-lg group-hover:block">
                                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reason</div>
                                      <div className="mb-2">{row.reason || '—'}</div>
                                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</div>
                                      <div className="max-h-24 overflow-hidden whitespace-pre-wrap">{row.description || '—'}</div>
                                    </div>
                                  )}
                                </div>
                                <div className="relative border-b border-slate-200 px-3 py-3">
                                  <div className="relative h-10 rounded bg-slate-100">
                                    <div
                                      className={`absolute top-1/2 h-4 -translate-y-1/2 rounded ${style.bar}`}
                                      style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                                    />
                                    {assignmentDuePct !== null && (
                                      <div
                                        className="absolute top-0 h-10 w-0 border-l-2 border-slate-600"
                                        style={{ left: `${assignmentDuePct}%` }}
                                        title={`Assignment Due: ${format(row.assignmentDueDate, 'MMM d, yyyy HH:mm')}`}
                                      />
                                    )}
                                    {actionDuePct !== null && (
                                      <div
                                        className="absolute top-0 h-10 w-0 border-l-2 border-amber-600"
                                        style={{ left: `${actionDuePct}%` }}
                                        title={`Action Due: ${format(row.actionDueDate, 'MMM d, yyyy HH:mm')}`}
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-4 rounded bg-[#0b5f87]" />
                    Start to Expiration
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-3 w-0 border-l-2 border-slate-600" />
                    Assignment Due
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-3 w-0 border-l-2 border-amber-600" />
                    Action Due
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={addEmptyRow}
            disabled={!selectedCourse}
            className="rounded-md bg-[#00597b] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#004965] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add assignment
          </button>
        </div>
        </section>

            <section className="rounded-md border border-slate-300 bg-[#eef0f2] p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#00597b]">Configuration Files</h2>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={exportConfigCsv}
                  className="rounded-md bg-[#0b5f87] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0a5275]"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => csvInputRef.current?.click()}
                  className="rounded-md bg-[#0b5f87] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0a5275]"
                >
                  Import CSV
                </button>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const [file] = e.target.files || [];
                    void importConfigCsv(file);
                    e.target.value = '';
                  }}
                />
              </div>
              {csvNotice && <p className="mt-2 text-xs text-slate-700">{csvNotice}</p>}
            </section>
          </>
        )}

        {activeAppTab === 'course' && (
          <>
            <section className="rounded-md border border-slate-300 bg-[#eef0f2] p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#00597b]">Existing Courses</h2>
              <div className="grid gap-3 md:grid-cols-[320px_1fr]">
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Select Course</span>
                  <select
                    value={managedCourseId}
                    onChange={(e) => void handleManagedCourseSelect(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">Select course</option>
                    {sortedCourseCatalog.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.course_code} - {course.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {managedCourseId && (
                <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-600">Course Name</span>
                    <input
                      type="text"
                      value={managedCourseName}
                      onChange={(e) => setManagedCourseName(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-600">Course Code</span>
                    <input
                      type="text"
                      value={managedCourseCode}
                      onChange={(e) => setManagedCourseCode(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-600">Term</span>
                    <input
                      type="text"
                      value={managedCourseTerm}
                      onChange={(e) => setManagedCourseTerm(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-slate-600">Block Start Date</span>
                    <input
                      type="date"
                      value={managedCourseBlockStartDate}
                      onChange={(e) => setManagedCourseBlockStartDate(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>
              )}

              {managedLoading && <p className="mt-2 text-sm text-slate-500">Loading assignments...</p>}

              {managedCourseId && !managedLoading && (
                <div className="mt-4 rounded-md border border-slate-300 bg-white">
                  <div className="grid grid-cols-[1fr_170px_120px_90px] border-b border-slate-300 bg-[#f5f6f7] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
                    <div>Assignment Title</div>
                    <div>Assignment Due Date</div>
                    <div>Points Possible</div>
                    <div>Row</div>
                  </div>
                  {managedAssignments.map((assignment, idx) => (
                    <div key={`managed-assignment-${idx}`} className="grid grid-cols-[1fr_170px_120px_90px] items-center gap-2 border-b border-slate-200 px-3 py-2 last:border-b-0">
                      <input
                        type="text"
                        value={assignment.title}
                        onChange={(e) => updateManagedAssignmentRow(idx, { title: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        placeholder="Assignment title"
                      />
                      <input
                        type="date"
                        value={assignment.assignment_due_date}
                        onChange={(e) => updateManagedAssignmentRow(idx, { assignment_due_date: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                      <input
                        type="number"
                        min="0"
                        value={assignment.points_possible}
                        onChange={(e) => updateManagedAssignmentRow(idx, { points_possible: e.target.value })}
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        placeholder="0"
                      />
                      <button
                        type="button"
                        onClick={() => removeManagedAssignmentRow(idx)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-[#00597b] hover:bg-slate-100"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={addManagedAssignmentRow}
                  disabled={!managedCourseId}
                  className="rounded-md bg-[#00597b] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#004965] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add assignment row
                </button>
                <button
                  type="button"
                  onClick={() => managedCsvInputRef.current?.click()}
                  disabled={!managedCourseId}
                  className="rounded-md bg-[#0b5f87] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0a5275] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Import Assignments CSV
                </button>
                <input
                  ref={managedCsvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const [file] = e.target.files || [];
                    void importManagedAssignmentsCsv(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => void saveManagedAssignments()}
                  disabled={!managedCourseId}
                  className="rounded-md bg-[#0b5f87] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0a5275] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save Course Assignments
                </button>
                <button
                  type="button"
                  onClick={() => void deleteManagedCourse()}
                  disabled={!managedCourseId}
                  className="rounded-md bg-rose-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete Course
                </button>
                {managedNotice && <span className="text-xs text-slate-700">{managedNotice}</span>}
              </div>
            </section>

        <section className="rounded-md border border-slate-300 bg-[#eef0f2] p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#00597b]">Save New Course</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Course Name</span>
              <input
                type="text"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="PC103 - Life Skills"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Course Code</span>
              <input
                type="text"
                value={newCourseCode}
                onChange={(e) => setNewCourseCode(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="PC103-BP"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Term</span>
              <input
                type="text"
                value={newCourseTerm}
                onChange={(e) => setNewCourseTerm(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Summer 2026"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-slate-600">Block Start Date</span>
              <input
                type="date"
                value={newCourseBlockStartDate}
                onChange={(e) => setNewCourseBlockStartDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <div className="mt-4 rounded-md border border-slate-300 bg-white">
            <div className="grid grid-cols-[1fr_170px_120px_90px] border-b border-slate-300 bg-[#f5f6f7] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
              <div>Assignment Title</div>
              <div>Assignment Due Date</div>
              <div>Points Possible</div>
              <div>Row</div>
            </div>
            {newCourseAssignments.map((assignment, idx) => (
              <div key={`new-course-assignment-${idx}`} className="grid grid-cols-[1fr_170px_120px_90px] items-center gap-2 border-b border-slate-200 px-3 py-2 last:border-b-0">
                <input
                  type="text"
                  value={assignment.title}
                  onChange={(e) => updateNewCourseAssignmentRow(idx, { title: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  placeholder="Assignment title"
                />
                <input
                  type="date"
                  value={assignment.assignment_due_date}
                  onChange={(e) => updateNewCourseAssignmentRow(idx, { assignment_due_date: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  value={assignment.points_possible}
                  onChange={(e) => updateNewCourseAssignmentRow(idx, { points_possible: e.target.value })}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  placeholder="0"
                />
                <button
                  type="button"
                  onClick={() => removeNewCourseAssignmentRow(idx)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs text-[#00597b] hover:bg-slate-100"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={addNewCourseAssignmentRow}
              className="rounded-md bg-[#00597b] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#004965]"
            >
              Add assignment row
            </button>
            <button
              type="button"
              onClick={saveAsNewCourse}
              className="rounded-md bg-[#0b5f87] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0a5275]"
            >
              Save New Course
            </button>
            {courseSaveNotice && <span className="text-xs text-slate-700">{courseSaveNotice}</span>}
          </div>
        </section>
          </>
        )}

        {activeAppTab === 'admin' && (
        <section className="rounded-md border border-slate-300 bg-[#eef0f2] p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#00597b]">Payload</h2>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={copyPayload}
              className="rounded-md bg-[#0b5f87] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0a5275]"
            >
              Copy payload
            </button>
            <button
              type="button"
              onClick={() => setIsPayloadOpen((v) => !v)}
              className="rounded-md bg-[#0b5f87] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0a5275]"
            >
              {isPayloadOpen ? 'Hide payload' : 'Show payload'}
            </button>
            {copied && <span className="text-xs text-emerald-700">Copied to clipboard</span>}
          </div>

          {isPayloadOpen && (
            <pre className="mt-3 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-xs text-slate-100">
{JSON.stringify(payload, null, 2)}
            </pre>
          )}
        </section>
        )}
      </div>

    </main>
  );
}
