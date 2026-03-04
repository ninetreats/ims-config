const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const STORAGE_KEY = 'ims_custom_courses_v1';
const ASSIGNMENT_OVERRIDE_KEY = 'ims_assignment_overrides_v1';
const COURSE_OVERRIDE_KEY = 'ims_course_overrides_v1';
const DELETED_BUILTIN_COURSE_KEY = 'ims_deleted_builtin_courses_v1';
const ACTION_CONFIGS_KEY = 'ims_action_configs_v1';

const BUILTIN_COURSES = [
  { id: 202, name: 'PC102 - Professional Skills', course_code: 'PC102', term: '2026 Block 2', block_start_date: '2026-03-02' },
];

const BUILTIN_ASSIGNMENTS_BY_COURSE = {
  202: [
    { id: 9201, title: 'W01 Application Activity: Find a Job Posting', points_possible: 0, assignment_due_date: '2026-03-07T23:59:00' },
    { id: 9202, title: 'W01 PathwayConnect Gathering', points_possible: 0, assignment_due_date: '2026-03-07T23:59:00' },
    { id: 9203, title: 'W01 Planning Ahead: Certificates and Degrees and the Ecclesiastical Endorsement', points_possible: 0, assignment_due_date: '2026-03-07T23:59:00' },
    { id: 9204, title: 'W01 Quiz: Getting Started', points_possible: 0, assignment_due_date: '2026-03-07T23:59:00' },
    { id: 9205, title: 'W01 Survey: Term Start', points_possible: 0, assignment_due_date: '2026-03-07T23:59:00' },
    { id: 9206, title: 'W02 Application Activity: Résumé', points_possible: 55, assignment_due_date: '2026-03-14T23:59:00' },
    { id: 9207, title: 'W02 Math Quiz', points_possible: 0, assignment_due_date: '2026-03-14T23:59:00' },
    { id: 9208, title: 'W02 PathwayConnect Gathering', points_possible: 0, assignment_due_date: '2026-03-14T23:59:00' },
    { id: 9209, title: 'W02 Quiz: Job Crafting', points_possible: 0, assignment_due_date: '2026-03-14T23:59:00' },
    { id: 9210, title: 'W03 Application Activity: Networking', points_possible: 0, assignment_due_date: '2026-03-21T23:59:00' },
    { id: 9211, title: 'W03 Application Activity: Value of a Degree', points_possible: 29, assignment_due_date: '2026-03-21T23:59:00' },
    { id: 9212, title: 'W03 Math Quiz', points_possible: 0, assignment_due_date: '2026-03-21T23:59:00' },
    { id: 9213, title: 'W03 PathwayConnect Gathering', points_possible: 0, assignment_due_date: '2026-03-21T23:59:00' },
    { id: 9214, title: 'W03 Student Feedback to Instructor', points_possible: 0, assignment_due_date: '2026-03-21T23:59:00' },
    { id: 9215, title: 'W04 Application Activity: Team Governance Document', points_possible: 0, assignment_due_date: '2026-03-28T23:59:00' },
    { id: 9216, title: 'W04 Math Quiz', points_possible: 0, assignment_due_date: '2026-03-28T23:59:00' },
    { id: 9217, title: 'W04 PathwayConnect Gathering', points_possible: 0, assignment_due_date: '2026-03-28T23:59:00' },
    { id: 9218, title: 'W05 Application Activity: Break-Even Analysis', points_possible: 0, assignment_due_date: '2026-04-04T23:59:00' },
    { id: 9219, title: 'W05 Application Activity: Personal Reflection', points_possible: 0, assignment_due_date: '2026-04-04T23:59:00' },
    { id: 9220, title: 'W05 Math Quiz', points_possible: 0, assignment_due_date: '2026-04-04T23:59:00' },
    { id: 9221, title: 'W05 PathwayConnect Gathering', points_possible: 0, assignment_due_date: '2026-04-04T23:59:00' },
    { id: 9222, title: 'W06 Application Activity: Email', points_possible: 31, assignment_due_date: '2026-04-11T23:59:00' },
    { id: 9223, title: 'W06 Application Activity: Slide Presentation', points_possible: 0, assignment_due_date: '2026-04-11T23:59:00' },
    { id: 9224, title: 'W06 Math Quiz', points_possible: 0, assignment_due_date: '2026-04-11T23:59:00' },
    { id: 9225, title: 'W06 PathwayConnect Gathering', points_possible: 0, assignment_due_date: '2026-04-11T23:59:00' },
    { id: 9226, title: 'W06 Survey: End of Term', points_possible: 0, assignment_due_date: '2026-04-11T23:59:00' },
    { id: 9227, title: 'W07 Application Activity: Giving Back', points_possible: 0, assignment_due_date: '2026-04-18T23:59:00' },
    { id: 9228, title: 'W07 End-of-Course Evaluation', points_possible: 0, assignment_due_date: '2026-04-18T23:59:00' },
    { id: 9229, title: 'W07 Math Quiz', points_possible: 0, assignment_due_date: '2026-04-18T23:59:00' },
    { id: 9230, title: 'W07 PathwayConnect Gathering', points_possible: 0, assignment_due_date: '2026-04-18T23:59:00' },
  ],
};

function hasStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function toValidPositiveInt(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function toDateOnlyString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekSundayDateOnly(blockStartDate) {
  const base = new Date(`${blockStartDate}T00:00:00`);
  const sunday = new Date(base);
  sunday.setDate(base.getDate() - base.getDay());
  return toDateOnlyString(sunday);
}

function ensureRequiredGlobalAssignments(assignments, courseId, blockStartDate) {
  const list = Array.isArray(assignments) ? assignments : [];
  const fallbackDue = `${getWeekSundayDateOnly(blockStartDate || '2026-01-01')}T00:00:00`;
  const required = [
    { title: 'All students', fallbackId: Number(`${Number(courseId)}000`) },
    { title: 'Multiple assignments', fallbackId: Number(`${Number(courseId)}999`) },
  ];

  let remaining = [...list];
  const ensured = required.map((req) => {
    const idx = remaining.findIndex(
      (assignment) => String(assignment?.title || '').trim().toLowerCase() === req.title.toLowerCase()
    );
    if (idx >= 0) {
      const existing = remaining[idx];
      remaining = remaining.filter((_, i) => i !== idx);
      return {
        ...existing,
        id: toValidPositiveInt(existing.id) ?? req.fallbackId,
        title: req.title,
        points_possible: Number.isFinite(Number(existing.points_possible)) ? Number(existing.points_possible) : 0,
        assignment_due_date: String(existing.assignment_due_date || '').trim() || fallbackDue,
      };
    }
    return {
      id: req.fallbackId,
      title: req.title,
      points_possible: 0,
      assignment_due_date: fallbackDue,
    };
  });

  return [...ensured, ...remaining];
}

function withAssignmentDueDates(assignments, blockStartDate) {
  const base = new Date(`${blockStartDate}T00:00:00`);
  return assignments.map((assignment, idx) => {
    if (assignment.assignment_due_date) return assignment;
    const weekMatch = String(assignment.title || '').match(/^W(\d{2})\b/i);
    const weekNumber = weekMatch ? Math.max(1, Number(weekMatch[1])) : 1;
    const dueDate = new Date(base);
    dueDate.setDate(base.getDate() + (weekNumber - 1) * 7 + 6);

    return {
      id: toValidPositiveInt(assignment.id) ?? idx + 1,
      points_possible: Number.isFinite(Number(assignment.points_possible)) ? Number(assignment.points_possible) : 0,
      ...assignment,
      assignment_due_date: `${toDateOnlyString(dueDate)}T23:59:00`,
    };
  });
}

function readCustomCourses() {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((course) => course && course.id && Array.isArray(course.assignments));
  } catch {
    return [];
  }
}

function writeCustomCourses(courses) {
  if (!hasStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
}

function readAssignmentOverrides() {
  if (!hasStorage()) return {};
  try {
    const raw = window.localStorage.getItem(ASSIGNMENT_OVERRIDE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAssignmentOverrides(overrides) {
  if (!hasStorage()) return;
  window.localStorage.setItem(ASSIGNMENT_OVERRIDE_KEY, JSON.stringify(overrides));
}

function readCourseOverrides() {
  if (!hasStorage()) return {};
  try {
    const raw = window.localStorage.getItem(COURSE_OVERRIDE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCourseOverrides(overrides) {
  if (!hasStorage()) return;
  window.localStorage.setItem(COURSE_OVERRIDE_KEY, JSON.stringify(overrides));
}

function readDeletedBuiltInCourses() {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(DELETED_BUILTIN_COURSE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
  } catch {
    return [];
  }
}

function writeDeletedBuiltInCourses(courseIds) {
  if (!hasStorage()) return;
  window.localStorage.setItem(DELETED_BUILTIN_COURSE_KEY, JSON.stringify(courseIds));
}

function readActionConfigs() {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(ACTION_CONFIGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((cfg) => cfg && cfg.id && Number.isFinite(Number(cfg.course_id)) && Array.isArray(cfg.rows));
  } catch {
    return [];
  }
}

function writeActionConfigs(configs) {
  if (!hasStorage()) return;
  window.localStorage.setItem(ACTION_CONFIGS_KEY, JSON.stringify(configs));
}

function getAllCourses() {
  const deletedBuiltIns = new Set(readDeletedBuiltInCourses());
  const courseOverrides = readCourseOverrides();
  const effectiveBuiltInCourses = BUILTIN_COURSES.map((course) => ({
    ...course,
    ...(courseOverrides[course.id] || {}),
  })).filter((course) => !deletedBuiltIns.has(Number(course.id)));
  const customCourses = readCustomCourses().map(({ assignments, ...course }) => course);
  return [...effectiveBuiltInCourses, ...customCourses];
}

function getBuiltInAssignmentsByCourseWithDueDates() {
  const courseById = Object.fromEntries(BUILTIN_COURSES.map((course) => [course.id, course]));
  return Object.fromEntries(
    Object.entries(BUILTIN_ASSIGNMENTS_BY_COURSE).map(([courseId, assignments]) => {
      const course = courseById[Number(courseId)];
      const blockStartDate = course?.block_start_date || '2026-01-01';
      return [
        courseId,
        ensureRequiredGlobalAssignments(
          withAssignmentDueDates(assignments, blockStartDate),
          Number(courseId),
          blockStartDate
        ),
      ];
    })
  );
}

function includesQuery(course, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [course.name, course.course_code, course.term].some((text) => String(text || '').toLowerCase().includes(needle));
}

export async function searchBlueprintCourses(q = '', page = 1) {
  await wait(180);
  const pageSize = 5;
  const filtered = getAllCourses()
    .filter((course) => includesQuery(course, q))
    .sort((a, b) =>
      `${a.course_code || ''} - ${a.name || ''}`.localeCompare(
        `${b.course_code || ''} - ${b.name || ''}`
      )
    );
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    page: safePage,
    pageSize,
    total,
    totalPages,
    hasPrevPage: safePage > 1,
    hasNextPage: safePage < totalPages,
    results: filtered.slice(start, start + pageSize),
  };
}

export async function listAssignmentsForCourse(courseId) {
  await wait(140);
  const builtIn = getBuiltInAssignmentsByCourseWithDueDates()[courseId];
  const overrides = readAssignmentOverrides();
  if (overrides[courseId]) {
    const course = getAllCourses().find((c) => Number(c.id) === Number(courseId));
    return ensureRequiredGlobalAssignments(
      withAssignmentDueDates(overrides[courseId], course?.block_start_date || '2026-01-01'),
      Number(courseId),
      course?.block_start_date || '2026-01-01'
    );
  }
  if (builtIn) return builtIn;

  const customCourse = readCustomCourses().find((course) => Number(course.id) === Number(courseId));
  if (customCourse) {
    return ensureRequiredGlobalAssignments(
      withAssignmentDueDates(customCourse.assignments, customCourse.block_start_date),
      Number(courseId),
      customCourse.block_start_date
    );
  }

  return ensureRequiredGlobalAssignments([
    { id: Number(`${courseId}01`), title: 'Weekly Check-In', points_possible: 10, assignment_due_date: '2026-01-07T23:59:00' },
    { id: Number(`${courseId}02`), title: 'Module Quiz', points_possible: 25, assignment_due_date: '2026-01-07T23:59:00' },
    { id: Number(`${courseId}03`), title: 'Reflection Journal', points_possible: 20, assignment_due_date: '2026-01-07T23:59:00' },
  ], Number(courseId), '2026-01-01');
}

export async function createCourseWithAssignments(courseInput, assignmentsInput) {
  await wait(80);
  const customCourses = readCustomCourses();
  const allCourses = getAllCourses();

  const name = String(courseInput?.name || '').trim();
  const courseCode = String(courseInput?.course_code || '').trim();
  const term = String(courseInput?.term || '').trim();
  const blockStartDate = String(courseInput?.block_start_date || '').trim();

  if (!name || !courseCode || !term || !blockStartDate) {
    throw new Error('Course name, code, term, and block start date are required.');
  }
  if (!Array.isArray(assignmentsInput) || assignmentsInput.length === 0) {
    throw new Error('At least one assignment is required.');
  }
  const duplicateCode = allCourses.some((course) => String(course.course_code).toLowerCase() === courseCode.toLowerCase());
  if (duplicateCode) {
    throw new Error(`Course code ${courseCode} already exists.`);
  }

  const nextCourseId = Math.max(...allCourses.map((course) => Number(course.id)), 999) + 1;
  const normalizedAssignments = assignmentsInput.map((assignment, idx) => ({
    id: toValidPositiveInt(assignment.id) ?? Number(`${nextCourseId}${idx + 1}`),
    title: String(assignment.title || `Assignment ${idx + 1}`),
    points_possible: Number.isFinite(Number(assignment.points_possible)) ? Number(assignment.points_possible) : 0,
    assignment_due_date: String(assignment.assignment_due_date || '').trim(),
  }));

  const newCourse = {
    id: nextCourseId,
    name,
    course_code: courseCode,
    term,
    block_start_date: blockStartDate,
    assignments: ensureRequiredGlobalAssignments(
      withAssignmentDueDates(normalizedAssignments, blockStartDate),
      nextCourseId,
      blockStartDate
    ),
  };

  writeCustomCourses([...customCourses, newCourse]);
  return newCourse;
}

export async function listAllCourses() {
  await wait(60);
  return getAllCourses();
}

export async function saveAssignmentsForCourse(courseId, assignmentsInput) {
  await wait(80);
  const course = getAllCourses().find((c) => Number(c.id) === Number(courseId));
  if (!course) throw new Error(`Course ${courseId} not found.`);
  if (!Array.isArray(assignmentsInput)) throw new Error('Assignments payload must be an array.');

  const normalizedAssignments = assignmentsInput.map((assignment, idx) => ({
    id: toValidPositiveInt(assignment.id) ?? Number(`${courseId}${idx + 1}`),
    title: String(assignment.title || `Assignment ${idx + 1}`),
    points_possible: Number.isFinite(Number(assignment.points_possible)) ? Number(assignment.points_possible) : 0,
    assignment_due_date: String(assignment.assignment_due_date || '').trim(),
  }));
  const withDueDates = ensureRequiredGlobalAssignments(
    withAssignmentDueDates(normalizedAssignments, course.block_start_date),
    Number(courseId),
    course.block_start_date
  );

  const customCourses = readCustomCourses();
  const customIndex = customCourses.findIndex((c) => Number(c.id) === Number(courseId));
  if (customIndex >= 0) {
    const updated = [...customCourses];
    updated[customIndex] = { ...updated[customIndex], assignments: withDueDates };
    writeCustomCourses(updated);
    return withDueDates;
  }

  // Built-in course: persist assignment override by course id.
  const overrides = readAssignmentOverrides();
  overrides[courseId] = withDueDates;
  writeAssignmentOverrides(overrides);
  return withDueDates;
}

export async function updateCourseMetadata(courseId, updates) {
  await wait(80);
  const numericId = Number(courseId);
  if (!Number.isFinite(numericId)) throw new Error('Invalid course id.');

  const name = String(updates?.name || '').trim();
  const courseCode = String(updates?.course_code || '').trim();
  const term = String(updates?.term || '').trim();
  const blockStartDate = String(updates?.block_start_date || '').trim();
  if (!name || !courseCode || !term || !blockStartDate) {
    throw new Error('Course name, code, term, and block start date are required.');
  }

  const allCourses = getAllCourses();
  const current = allCourses.find((course) => Number(course.id) === numericId);
  if (!current) throw new Error(`Course ${courseId} not found.`);

  const duplicateCode = allCourses.some(
    (course) =>
      Number(course.id) !== numericId &&
      String(course.course_code || '').toLowerCase() === courseCode.toLowerCase()
  );
  if (duplicateCode) throw new Error(`Course code ${courseCode} already exists.`);

  const normalized = {
    name,
    course_code: courseCode,
    term,
    block_start_date: blockStartDate,
  };

  const customCourses = readCustomCourses();
  const customIndex = customCourses.findIndex((course) => Number(course.id) === numericId);
  if (customIndex >= 0) {
    const updated = [...customCourses];
    updated[customIndex] = { ...updated[customIndex], ...normalized };
    writeCustomCourses(updated);
    const { assignments, ...courseWithoutAssignments } = updated[customIndex];
    return courseWithoutAssignments;
  }

  const builtInExists = BUILTIN_COURSES.some((course) => Number(course.id) === numericId);
  if (!builtInExists) throw new Error(`Course ${courseId} not found.`);

  const overrides = readCourseOverrides();
  overrides[numericId] = { ...(overrides[numericId] || {}), ...normalized };
  writeCourseOverrides(overrides);
  return { ...current, ...normalized };
}

export async function deleteCourse(courseId) {
  await wait(80);
  const numericId = Number(courseId);
  if (!Number.isFinite(numericId)) throw new Error('Invalid course id.');

  const customCourses = readCustomCourses();
  const customIndex = customCourses.findIndex((course) => Number(course.id) === numericId);
  if (customIndex >= 0) {
    const nextCustom = customCourses.filter((course) => Number(course.id) !== numericId);
    writeCustomCourses(nextCustom);

    const assignmentOverrides = readAssignmentOverrides();
    if (assignmentOverrides[numericId]) {
      delete assignmentOverrides[numericId];
      writeAssignmentOverrides(assignmentOverrides);
    }

    const courseOverrides = readCourseOverrides();
    if (courseOverrides[numericId]) {
      delete courseOverrides[numericId];
      writeCourseOverrides(courseOverrides);
    }

    const configs = readActionConfigs().filter((cfg) => Number(cfg.course_id) !== numericId);
    writeActionConfigs(configs);
    return { deleted: true, courseId: numericId };
  }

  const builtInExists = BUILTIN_COURSES.some((course) => Number(course.id) === numericId);
  if (!builtInExists) throw new Error(`Course ${courseId} not found.`);

  const deletedBuiltIns = readDeletedBuiltInCourses();
  if (!deletedBuiltIns.includes(numericId)) {
    writeDeletedBuiltInCourses([...deletedBuiltIns, numericId]);
  }

  const assignmentOverrides = readAssignmentOverrides();
  if (assignmentOverrides[numericId]) {
    delete assignmentOverrides[numericId];
    writeAssignmentOverrides(assignmentOverrides);
  }

  const courseOverrides = readCourseOverrides();
  if (courseOverrides[numericId]) {
    delete courseOverrides[numericId];
    writeCourseOverrides(courseOverrides);
  }

  const configs = readActionConfigs().filter((cfg) => Number(cfg.course_id) !== numericId);
  writeActionConfigs(configs);

  return { deleted: true, courseId: numericId };
}

export async function listActionConfigs(courseId) {
  await wait(60);
  const numericCourseId = Number(courseId);
  return readActionConfigs()
    .filter((cfg) => (!Number.isFinite(numericCourseId) ? true : Number(cfg.course_id) === numericCourseId))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export async function getActionConfig(configId) {
  await wait(60);
  const targetId = String(configId || '').trim();
  if (!targetId) throw new Error('Configuration id is required.');
  const config = readActionConfigs().find((cfg) => String(cfg.id) === targetId);
  if (!config) throw new Error('Configuration file not found.');
  return config;
}

export async function saveActionConfig(input) {
  await wait(80);
  const courseId = Number(input?.course_id);
  const name = String(input?.name || '').trim();
  const rows = Array.isArray(input?.rows) ? input.rows : [];
  if (!Number.isFinite(courseId)) throw new Error('A valid course is required.');
  if (!name) throw new Error('Configuration file name is required.');

  const now = new Date().toISOString();
  const configs = readActionConfigs();
  const existingId = String(input?.id || '').trim();
  const normalizedRows = rows.map((row) => ({
    assignment_id: row.assignment_id ?? '',
    assignment_due_date: row.assignment_due_date ?? '',
    assignment_due_date_source: row.assignment_due_date_source ?? '',
    action_type: row.action_type ?? '',
    percent: row.percent ?? '',
    reason: row.reason ?? '',
    description: row.description ?? '',
    aggregate_assignment_ids: Array.isArray(row.aggregate_assignment_ids) ? row.aggregate_assignment_ids : [],
    week_of_term: row.week_of_term ?? '',
    day_of_week: row.day_of_week ?? '',
    start_date: row.start_date ?? '',
    due_date: row.due_date ?? '',
    expiration_date: row.expiration_date ?? '',
    calc_key: row.calc_key ?? '',
  }));

  if (existingId) {
    const idx = configs.findIndex((cfg) => String(cfg.id) === existingId);
    if (idx < 0) throw new Error('Configuration file not found.');
    const updated = [...configs];
    updated[idx] = {
      ...updated[idx],
      name,
      course_id: courseId,
      rows: normalizedRows,
      updated_at: now,
    };
    writeActionConfigs(updated);
    return updated[idx];
  }

  const id = `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const created = {
    id,
    name,
    course_id: courseId,
    rows: normalizedRows,
    created_at: now,
    updated_at: now,
  };
  writeActionConfigs([created, ...configs]);
  return created;
}

export async function deleteActionConfig(configId) {
  await wait(80);
  const targetId = String(configId || '').trim();
  if (!targetId) throw new Error('Configuration id is required.');
  const configs = readActionConfigs();
  const exists = configs.some((cfg) => String(cfg.id) === targetId);
  if (!exists) throw new Error('Configuration file not found.');
  writeActionConfigs(configs.filter((cfg) => String(cfg.id) !== targetId));
  return { deleted: true, id: targetId };
}

const mockApi = {
  searchBlueprintCourses,
  listAssignmentsForCourse,
  createCourseWithAssignments,
  listAllCourses,
  saveAssignmentsForCourse,
  updateCourseMetadata,
  deleteCourse,
  listActionConfigs,
  getActionConfig,
  saveActionConfig,
  deleteActionConfig,
};

export default mockApi;
