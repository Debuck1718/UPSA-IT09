const express = require("express");
const session = require("express-session");
const fileUpload = require("express-fileupload");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// 1. GLOBAL SECURITY & PARSERS (MUST BE FIRST)
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "5mb" })); // Increased limit for larger metadata
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// 2. FILE UPLOAD CONFIGURATION
app.use(
  fileUpload({
    limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 25) * 1024 * 1024 },
    abortOnLimit: true,
    useTempFiles: false, // Keep in memory for fast Supabase transfer
  }),
);

// 3. DATABASE & SUPABASE INIT
const db = require("./db_pg");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_KEY) 
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) 
    : null;

// 4. CORS CONFIG
if (process.env.NODE_ENV !== "production") {
  app.use(cors({ origin: true, credentials: true }));
}

// 5. SESSION MANAGEMENT (After Parsers)
const pgSession = require("connect-pg-simple")(session);
const isProd = process.env.RENDER || process.env.NODE_ENV === "production";

app.use(
  session({
    store: new pgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      tableName: "user_sessions",
    }),
    name: "sid",
    secret: process.env.SESSION_SECRET || "your_secret_key",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

// 6. STATIC FILES
app.use("/public", express.static(path.join(__dirname, "public")));

// --- Static pages ---
app.get("/", (req, res) => {
  res.redirect(302, "/public/index.html");
});

// Middleware to sanitize any downstream redirect Location headers (defense-in-depth)
app.use((req, res, next) => {
  const originalRedirect = res.redirect.bind(res);
  res.redirect = (statusOrUrl, maybeUrl) => {
    let status = 302;
    let url = statusOrUrl;
    if (typeof statusOrUrl === "number") {
      status = statusOrUrl;
      url = maybeUrl;
    }
    if (typeof url === "string") {
      const isAbsolute = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url);
      if (isAbsolute) {
        // Never allow absolute localhost or mismatched host redirects
        try {
          const u = new URL(url);
          if (
            /^localhost$/i.test(u.hostname) ||
            /^127\.0\.0\.1$/i.test(u.hostname)
          ) {
            url = "/public/index.html";
          } else {
            // Convert any absolute URL to a relative path to stay same-origin
            url = u.pathname + (u.search || "") + (u.hash || "");
          }
        } catch {
          url = "/public/index.html";
        }
      } else {
        const safe = path.posix.normalize(url);
        url = safe.startsWith("/") ? safe : `/${safe}`;
      }
    }
    return originalRedirect(status, url);
  };
  next();
});

// Sanitize path segments for Supabase Storage keys
function sanitizeSegment(value, fallback = "x") {
  let v = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]/g, "_") // replace unsafe chars
    .replace(/_+/g, "_") // collapse multiple underscores
    .replace(/^_+|_+$/g, ""); // trim leading/trailing underscores

  if (!v) v = fallback;
  return v;
}

app.get("/dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/public/index.html");
  const role = req.session.user.role;
  if (role === "admin") {
    return res.redirect("/public/admin.html");
  }
  if (role === "rep") {
    return res.redirect("/rep-dashboard");
  }
  // student (default)
  return res.sendFile(path.join(__dirname, "public", "dashboard-modern.html"));
});

// Rep dashboard route
app.get("/rep-dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/public/index.html");
  const role = req.session.user.role;
  if (role === "admin") return res.redirect("/public/admin.html");
  if (role !== "rep") return res.redirect("/dashboard");
  return res.sendFile(path.join(__dirname, "public", "rep-dashboard.html"));
});

// Who am I (quick role check)
app.get("/api/whoami", (req, res) => {
  if (!req.session.user) return res.status(401).json({ ok: false });
  return res.json({ ok: true, user: req.session.user });
});

// Admin guard
function requireAdmin(req, res, next) {
  const u = req.session?.user;
  if (!u) return res.status(401).json({ ok: false, message: "Unauthorized" });
  if (u.role !== "admin")
    return res.status(403).json({ ok: false, message: "Forbidden" });
  next();
}

const requireLeader = (req, res, next) => {
  const u = req.session?.user;
  if (!u) return res.status(401).json({ ok: false });

  if (u.role === "admin" || u.is_leader) return next();

  return res.status(403).json({
    ok: false,
    message: "Leader access required",
  });
};

// List users for admin
app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json({ ok: true, users });
  } catch (e) {
    console.error("List users error:", e);
    res.status(500).json({ ok: false, message: "Failed to load users" });
  }
});

// Update user role (admin only)
app.post("/api/admin/users/:studentId", requireAdmin, async (req, res) => {
  try {
    const sid = String(req.params.studentId || "").trim();
    const role = String(req.body?.role || "").trim();
    if (!sid || !role) {
      return res
        .status(400)
        .json({ ok: false, message: "Student ID and role are required" });
    }
    const allowed = new Set(["student", "rep", "teacher", "admin"]);
    if (!allowed.has(role)) {
      return res.status(400).json({ ok: false, message: "Invalid role" });
    }
    const r = await db.pool.query(
      "update users_app set role=$1 where student_id=$2 returning id, student_id, role",
      [role, sid],
    );
    if (!r.rowCount) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }
    return res.json({ ok: true, user: r.rows[0] });
  } catch (e) {
    console.error("Update role error:", e);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

// Update program / academicYearStart / classGroup (admin only)
app.post(
  "/api/admin/users/:studentId/update-cohort",
  requireAdmin,
  async (req, res) => {
    try {
      const sid = String(req.params.studentId || "").trim();
      if (!sid)
        return res
          .status(400)
          .json({ ok: false, message: "Student ID is required" });

      // Accept partial updates
      const program = (req.body?.program || "").toString().trim();
      const yearRaw = req.body?.academicYearStart;
      const classGroupRaw = (req.body?.classGroup || "").toString().trim();

      // Fetch existing user
      const userRes = await db.pool.query(
        "select * from users_app where student_id=$1",
        [sid],
      );
      if (!userRes.rowCount)
        return res.status(404).json({ ok: false, message: "User not found" });
      const u = userRes.rows[0];

      // Determine new values (falling back to existing ones)
      const newProgram = program || u.program || "";
      const newProgramId = newProgram
        ? db.programIdFromName(newProgram)
        : u.program_id || "";
      const newYear =
        typeof yearRaw === "number" && !Number.isNaN(yearRaw)
          ? yearRaw
          : (() => {
              const m = String(u.cohort_id || "").split("|"); // upsa|programId|year
              const yr = m[2] ? Number(m[2]) : undefined;
              return Number.isFinite(yr) ? yr : new Date().getFullYear();
            })();
      const classGroup = classGroupRaw
        ? db.normalizeClassGroup(classGroupRaw)
        : u.class_group || "";

      // Recompute cohort and classGroup IDs
      const institutionId = u.institution_id || "upsa";
      const cohortId = db.makeCohortId(institutionId, newProgramId, newYear);
      const classGroupId = classGroup
        ? db.makeClassGroupId(cohortId, classGroup)
        : u.class_group_id;

      // Apply update
      const q = `
      update users_app
         set program = $1,
             program_id = $2,
             cohort_id = $3,
             class_group = $4,
             class_group_id = $5
       where student_id = $6
       returning id, student_id, role, program, class_group, cohort_id, class_group_id
    `;
      const vals = [
        newProgram || null,
        newProgramId || null,
        cohortId || null,
        classGroup || null,
        classGroupId || null,
        sid,
      ];
      const upd = await db.pool.query(q, vals);
      return res.json({ ok: true, user: upd.rows[0] });
    } catch (e) {
      console.error("Update cohort error:", e);
      return res.status(500).json({ ok: false, message: "Server error" });
    }
  },
);

// --- API: authentication & session ---
app.post("/api/login", async (req, res) => {
  try {
    const sid = (req.body?.studentId || "").trim();
    const password = req.body?.password || "";

    if (!sid || !password) {
      return res.status(400).json({
        ok: false,
        message: "Student ID and password are required",
      });
    }

    const user = await db.findUserByStudentId(sid);
    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "Invalid credentials",
      });
    }

    const crypto = require("crypto");
    const shaValid =
      user.password_hash &&
      user.password_hash.length === 64 &&
      user.password_hash ===
        crypto.createHash("sha256").update(String(password)).digest("hex");

    const bcryptValid =
      user.password_hash &&
      user.password_hash.startsWith("$2") &&
      bcrypt.compareSync(password, user.password_hash);

    if (!shaValid && !bcryptValid) {
      return res.status(401).json({
        ok: false,
        message: "Invalid credentials",
      });
    }

    const fullName = user.full_name || "";
    const firstName =
      fullName.trim().split(/\s+/)[0] || user.student_id || "User";

    // Always normalize classGroupId for session
    let classGroupId = user.class_group_id;
    if (db.makeClassGroupId && user.cohort_id && user.class_group) {
      classGroupId = db.makeClassGroupId(user.cohort_id, user.class_group);
    }
    const sessionUser = {
      id: user.id,
      role: user.role,
      studentId: user.student_id,
      institutionId: user.institution_id,
      program: user.program || null,
      programId: user.program_id,
      cohortId: user.cohort_id,
      classGroup: user.class_group,
      classGroupId,
      fullName,
      firstName,
      is_rep: !!user.is_rep, 
      is_leader: !!user.is_leader, 
      is_creator: !!user.is_creator
    };

    // Role-based redirect hint
    let redirect = "/dashboard";
    if (sessionUser.role === "admin") redirect = "/public/admin.html";
    else if (sessionUser.role === "rep") redirect = "/rep-dashboard";
    else if (sessionUser.role === "student") redirect = "/dashboard";

    req.session.user = sessionUser;

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({
          ok: false,
          message: "Session error",
        });
      }

      return res.json({
        ok: true,
        user: sessionUser,
        redirect,
      });
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error",
    });
  }
});

app.post("/api/signup", async (req, res) => {
  try {
    const {
      studentId,
      full_name,
      email,
      password,
      program,
      classGroup,
      academicYearStart,
      institution,
    } = req.body || {};
    if (
      !studentId ||
      !full_name ||
      !email ||
      !password ||
      !program ||
      !classGroup ||
      !academicYearStart
    ) {
      return res.status(400).json({ ok: false, message: "Missing fields" });
    }

    // Enforce Student ID 6–12 digits to support different schools (UPSA is 8)
    const idOk = /^\d{6,12}$/.test(String(studentId).trim());
    if (!idOk) {
      return res
        .status(400)
        .json({
          ok: false,
          message: "Please enter a valid Student ID (6–12 digits).",
        });
    }

    // Uniqueness checks
    const [byId, byEmail] = await Promise.all([
      db.findUserByStudentId(studentId),
      db.findUserByEmail(email),
    ]);
    if (byId)
      return res
        .status(409)
        .json({ ok: false, message: "Student ID already exists." });
    if (byEmail)
      return res
        .status(409)
        .json({ ok: false, message: "Email already registered." });

    const user = await db.createUser({
      studentId,
      full_name,
      email,
      program,
      classGroup: db.normalizeClassGroup(classGroup),
      password, // db_pg hashes to sha256
      role: "student",
      institutionId: institution || "upsa",
      academicYearStart: Number(academicYearStart),
    });

    // Auto-login: set session so the user can access /dashboard immediately after signup
    const fullName = user.full_name || full_name || "";
    const firstName =
      fullName.trim().split(/\s+/)[0] || user.student_id || studentId || "User";

    // Always normalize classGroupId for session
    let classGroupId = user.class_group_id;
    if (db.makeClassGroupId && user.cohort_id && user.class_group) {
      classGroupId = db.makeClassGroupId(user.cohort_id, user.class_group);
    }
    const sessionUser = {
      id: user.id,
      role: user.role,
      studentId: user.student_id || studentId,
      institutionId: user.institution_id || institution || "upsa",
      program: user.program || program || null,
      programId: user.program_id,
      cohortId: user.cohort_id,
      classGroup: user.class_group || db.normalizeClassGroup(classGroup),
      classGroupId,
      fullName,
      firstName,
    };
    req.session.user = sessionUser;

    // Provide a redirect hint to the client
    return res.json({ ok: true, user: sessionUser, redirect: "/dashboard" });
  } catch (e) {
    // Handle unique constraint gracefully if it still happens (race)
    if (e && e.code === "23505") {
      const msg =
        e.detail && /Key \(email\)/.test(e.detail)
          ? "Email already registered."
          : "Student ID already exists.";
      return res.status(409).json({ ok: false, message: msg });
    }
    console.error("Signup error:", e);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

// Availability check for signup
// GET /api/check-availability?studentId=&email=
app.get("/api/check-availability", async (req, res) => {
  try {
    const sid = (req.query.studentId || "").toString().trim();
    const email = (req.query.email || "").toString().trim().toLowerCase();
    let studentIdAvailable = true;
    let emailAvailable = true;

    if (sid) {
      const u = await db.findUserByStudentId(sid);
      studentIdAvailable = !u;
    }
    if (email) {
      const e = await db.findUserByEmail(email);
      emailAvailable = !e;
    }
    return res.json({ ok: true, studentIdAvailable, emailAvailable });
  } catch (err) {
    console.error("Availability check error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

// Courses endpoints
// List distinct legacy/global course names across all slides
app.get("/api/courses", async (req, res) => {
  try {
    if (!db.listCourses) {
      return res.json({ ok: true, courses: [] });
    }
    // If user is logged in, filter by their classGroupId
    let classGroupId = null;
    if (req.session && req.session.user && req.session.user.classGroupId) {
      classGroupId = req.session.user.classGroupId;
    }
    const courses = await db.listCourses(classGroupId);
    return res.json({ ok: true, courses });
  } catch (e) {
    console.error("List courses error:", e);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load courses" });
  }
});

// List course titles for current user's classGroupId (rep/student)
app.get("/api/courses/mine", async (req, res) => {
  try {
    const u = req.session?.user;
    if (!u) return res.status(401).json({ ok: false, message: "Unauthorized" });
    if (!db.listCourseTitlesForClassGroupId) {
      return res.json({ ok: true, titles: [] });
    }
    const titles = await db.listCourseTitlesForClassGroupId(u.classGroupId);
    return res.json({ ok: true, titles });
  } catch (e) {
    console.error("List my course titles error:", e);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load titles" });
  }
});

// Add course title for current rep/teacher/admin (for this classGroupId)
app.post("/api/courses/manage", async (req, res) => {
  try {
    const u = req.session?.user;
    if (!u) return res.status(401).json({ ok: false, message: "Unauthorized" });
    const allowed = new Set(["rep", "admin", "teacher"]);
    if (!allowed.has(u.role))
      return res.status(403).json({ ok: false, message: "Forbidden" });

    const title = (req.body?.title || "").toString().trim();
    if (!title)
      return res.status(400).json({ ok: false, message: "Title is required" });

    if (!db.addCourseTitleForClassGroupId) {
      return res
        .status(500)
        .json({ ok: false, message: "Course title storage not available" });
    }
    await db.addCourseTitleForClassGroupId(u.classGroupId, title);
    return res.json({ ok: true, message: "Added", title });
  } catch (e) {
    console.error("Add course title error:", e);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

// Upload slide (rep/admin/teacher) to Supabase Storage and save metadata
app.post("/api/upload", async (req, res) => {
  try {
    const u = req.session?.user;
    if (!u) return res.status(401).json({ ok: false, message: "Unauthorized" });

    if (!req.files || !req.files.file) {
      return res.status(400).json({ ok: false, message: "No file uploaded" });
    }
    const file = req.files.file;
    const maxMb = Number(process.env.MAX_UPLOAD_MB || 25);
    if (file.size > maxMb * 1024 * 1024) {
      return res
        .status(413)
        .json({ ok: false, message: `File too large. Max ${maxMb}MB` });
    }
    if (!/\.(pdf|ppt|pptx)$/i.test(file.name)) {
      return res
        .status(400)
        .json({
          ok: false,
          message: "Only PDF, PPT, or PPTX files are allowed.",
        });
    }

    const slideTitle = (req.body?.slideTitle || "").toString().trim();
    const courseTitle = (req.body?.courseTitle || "").toString().trim();
    if (!slideTitle)
      return res
        .status(400)
        .json({ ok: false, message: "Slide Title is required." });
    if (!courseTitle)
      return res
        .status(400)
        .json({ ok: false, message: "Course Title is required." });

    if (!supabase) {
      return res
        .status(500)
        .json({ ok: false, message: "Storage not configured" });
    }

    const { v4: uuidv4 } = require("uuid");
    const id = uuidv4();
    const safeName = (function safeFileName(base, id) {
      const p = require("path");
      const ext = p.extname(base);
      const nm = p.basename(base, ext).replace(/[^a-zA-Z0-9._-]/g, "_");
      return `${id}-${nm}${ext}`;
    })(file.name, id);

    // Build object path: institution/program/cohort/classGroup/courseTitle/filename
    // Sanitize each path segment
    const institutionSeg = sanitizeSegment(u.institutionId || "upsa");
    const programSeg = sanitizeSegment(u.programId || "general");
    const cohortSeg = sanitizeSegment(u.cohortId || "cohort");
    const classSeg = sanitizeSegment(u.classGroupId || "class");
    const courseSeg = sanitizeSegment(courseTitle || "course");

    // Build safe prefix
    const prefix = [
      institutionSeg,
      programSeg,
      cohortSeg,
      classSeg,
      courseSeg,
    ].join("/");

    // Final object path
    const objectPath = `${prefix}/${safeName}`;

    // Upload to Supabase Storage
    const { error: upErr } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(objectPath, file.data, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (upErr) {
      console.error("Supabase upload error:", upErr);
      return res
        .status(500)
        .json({ ok: false, message: "Upload failed (storage)" });
    }

    // Save metadata in Postgres
    await db.insertSlide({
      id,
      classGroupId: u.classGroupId,
      courseTitle,
      slideTitle,
      objectPath,
      originalName: file.name,
      contentType: file.mimetype,
      sizeBytes: file.size,
      uploaderId: u.id,
      institutionId: u.institutionId,
      programId: u.programId,
      cohortId: u.cohortId,
    });

    // Remember course title for future
    if (db.addCourseTitleForClassGroupId) {
      try {
        await db.addCourseTitleForClassGroupId(u.classGroupId, courseTitle);
      } catch (_) {}
    }

    return res.json({
      ok: true,
      message: "Uploaded",
      id,
      filename: objectPath,
    });
  } catch (e) {
    console.error("Upload error:", e);
    const status = e?.code === "LIMIT_FILE_SIZE" ? 413 : 500;
    return res
      .status(status)
      .json({
        ok: false,
        message: status === 413 ? "File too large" : "Upload failed",
      });
  }
});


// Email verification flow not used in current production path (skipped)

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/session", (req, res) => {
  if (!req.session.user) return res.status(401).json({ ok: false });
  return res.json({ ok: true, user: req.session.user });
});

app.post("/api/admin/create", async (req, res) => {
  try {
    const setupSecret = process.env.ADMIN_SETUP_SECRET;
    const provided =
      req.get("X-Admin-Setup-Secret") || req.get("x-admin-setup-secret");
    if (!setupSecret || !provided || setupSecret !== provided) {
      return res.status(403).json({ ok: false, message: "Forbidden" });
    }

    const { studentId, full_name, email, password } = req.body || {};
    if (!studentId || !full_name || !email || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "Missing required fields" });
    }

    // Avoid duplicates
    const exists = await db.findUserByStudentId(studentId);
    if (exists) {
      return res
        .status(409)
        .json({ ok: false, message: "Student ID already exists" });
    }

    const currentYear = new Date().getFullYear();
    const institutionId = "upsa";
    const program = "Administration";
    const programId = db.programIdFromName
      ? db.programIdFromName(program)
      : "administration";
    const cohortId = db.makeCohortId
      ? db.makeCohortId(institutionId, programId, currentYear)
      : `${institutionId}|${programId}|${currentYear}`;
    const classGroup = db.normalizeClassGroup
      ? db.normalizeClassGroup("ADM")
      : "ADM";
    const classGroupId = db.makeClassGroupId
      ? db.makeClassGroupId(cohortId, classGroup)
      : `${cohortId}|${classGroup}`;

    // Hash password (bcrypt) to align with current bcrypt usage in this file
    const hashed = bcrypt.hashSync(password, 10);

    // Insert directly with elevated role using db.createUser if it supports role, else create+update
    let user = null;
    if (typeof db.createUser === "function") {
      user = await db.createUser({
        studentId,
        full_name,
        email,
        program,
        classGroup,
        password, // db_pg.createUser hashes with sha256 by default; we want bcrypt here for app.js compatibility
        role: "admin",
        institutionId,
        academicYearStart: currentYear,
      });
      // If db.createUser hashed differently, force-set bcrypt by updating password_hash
      if (user && user.id && db.pool) {
        try {
          await db.pool.query(
            "update users_app set role=$1, password_hash=$2, program=$3, program_id=$4, institution_id=$5, cohort_id=$6, class_group=$7, class_group_id=$8 where id=$9",
            [
              "admin",
              hashed,
              program,
              programId,
              institutionId,
              cohortId,
              classGroup,
              classGroupId,
              user.id,
            ],
          );
          const r = await db.findUserByStudentId(studentId);
          user = r || user;
        } catch (_) {}
      }
    } else if (db.pool) {
      const { rows } = await db.pool.query(
        `insert into users_app (student_id, full_name, email, role, institution_id, program, program_id, cohort_id, class_group, class_group_id, password_hash)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         returning *`,
        [
          studentId,
          full_name,
          email,
          "admin",
          institutionId,
          program,
          programId,
          cohortId,
          classGroup,
          classGroupId,
          hashed,
        ],
      );
      user = rows[0];
    } else {
      return res.status(500).json({ ok: false, message: "DB not available" });
    }

    if (!user) {
      return res
        .status(500)
        .json({ ok: false, message: "Failed to create admin" });
    }

    return res.json({
      ok: true,
      user: {
        id: user.id,
        student_id: user.student_id || studentId,
        role: "admin",
      },
    });
  } catch (e) {
    console.error("Admin create error:", e);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});


app.get("/api/admin/users", requireAdmin, async (req, res) => {
  const all = await db.getAllUsers();
  return res.json({ ok: true, users: all });
});

app.post("/api/admin/promote", requireAdmin, async (req, res) => {
  const { studentId, role } = req.body;
  const allowed = [
    "student",
    "course_rep",
    "rep_assistant",
    "course_secretary",
    "admin",
  ];
  if (!studentId || !role)
    return res.status(400).json({ ok: false, message: "Missing fields" });
  if (!allowed.includes(role))
    return res.status(400).json({ ok: false, message: "Invalid role" });
  const u =
    (await db.findUserByStudentId(studentId)) ||
    (await db.getUserById(studentId));
  if (!u) return res.status(404).json({ ok: false, message: "User not found" });
  const updated = await db.setUserRole(u.id, role);
  return res.json({ ok: true, user: { id: updated.id, role: updated.role } });
});
app.post("/api/admin/import", requireAdmin, async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ ok: false, message: "No file uploaded" });
    }

    const file = req.files.file;
    const name = String(file.name || "").toLowerCase();
    if (!name.endsWith(".csv")) {
      return res
        .status(400)
        .json({ ok: false, message: "Please upload a CSV file" });
    }

    const data =
      file.data ||
      (file.tempFilePath ? fs.readFileSync(file.tempFilePath) : null);
    if (!data || !data.length) {
      return res.status(400).json({ ok: false, message: "Empty file" });
    }

    let records = [];
    try {
      records = parse(data, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (e) {
      console.error("CSV parse error:", e);
      return res.status(400).json({ ok: false, message: "Invalid CSV format" });
    }

    if (!Array.isArray(records) || !records.length) {
      return res
        .status(400)
        .json({ ok: false, message: "No rows found in CSV" });
    }

    const results = { ok: true, imported: 0, skipped: 0, errors: [] };
    const currentYear = new Date().getFullYear();

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      try {
        const studentId = (row.studentId || row.student_id || "")
          .toString()
          .trim();
        const full_name = (row.full_name || row.name || "").toString().trim();
        const email = (row.email || "").toString().trim();
        const program = (row.program || "").toString().trim();
        const classGroupRaw = (row.classGroup || row.class_group || "")
          .toString()
          .trim();
        const classGroup = db.normalizeClassGroup
          ? db.normalizeClassGroup(classGroupRaw)
          : classGroupRaw;
        const academicYearStart = Number(
          row.academicYearStart || row.academic_year_start || currentYear,
        );
        const role = (row.role || "").toString().trim() || "student";
        const password = (row.password || "").toString();

        if (!studentId || !full_name || !email || !program || !classGroup) {
          results.skipped++;
          results.errors.push({
            row: i + 1,
            error:
              "Missing required fields (studentId, full_name, email, program, classGroup)",
          });
          continue;
        }

        const byId = await db.findUserByStudentId(studentId);
        const byEmail = email ? await db.findUserByEmail(email) : null;
        if (byId || byEmail) {
          results.skipped++;
          results.errors.push({
            row: i + 1,
            studentId,
            error: "Duplicate studentId or email",
          });
          continue;
        }

        const created = await db.createUser({
          studentId,
          full_name,
          email,
          program,
          classGroup,
          password: password || uuidv4().slice(0, 10),
          role,
          institutionId: "upsa",
          academicYearStart,
        });

        if (!created) {
          results.skipped++;
          results.errors.push({
            row: i + 1,
            studentId,
            error: "Failed to insert",
          });
          continue;
        }

        results.imported++;
      } catch (e) {
        console.error("Row import error:", e);
        results.skipped++;
        results.errors.push({
          row: i + 1,
          error: e.message || "Unknown error",
        });
      }
    }

    return res.json(results);
  } catch (e) {
    console.error("Admin import error:", e);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});
// --- API: slides ---
app.get("/api/slides", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ ok: false });
  try {
    const user = req.session.user;
    const qCourseTitle =
      typeof req.query.courseTitle === "string"
        ? req.query.courseTitle.trim()
        : "";
    let rows = await db.listSlidesByClassGroupId(user.classGroupId);
    if (qCourseTitle) {
      rows = rows.filter((s) => (s.course_title || "").trim() === qCourseTitle);
    }
    const slides = rows.map((s) => ({
      id: s.id,
      classGroup: s.class_group_id,
      courseTitle: s.course_title,
      slideTitle: s.slide_title,
      filename: s.object_path,
      originalName: s.original_name,
      createdAt: s.created_at,
    }));
    return res.json({ ok: true, slides });
  } catch (e) {
    console.error("Slides list error", e);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load slides" });
  }
});

// --- API: slide download/view URL ---
app.get("/api/slides/:id/url", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ ok: false, message: "Unauthorized" });
  try {
    const slide = await db.getSlideById(req.params.id);
    if (!slide) return res.status(404).json({ ok: false, message: "Slide not found" });
    if (!slide.object_path) return res.status(404).json({ ok: false, message: "Slide file missing" });

    if (!supabase) return res.status(500).json({ ok: false, message: "Supabase not configured" });

    // Generate signed URL (valid for 2 hours)
    const { data, error } = await supabase
      .storage
      .from(SUPABASE_BUCKET)
      .createSignedUrl(slide.object_path, 60 * 60 * 2);
    if (error || !data || !data.signedUrl) {
      console.error("Supabase signed URL error", error);
      return res.status(500).json({ ok: false, message: "Failed to generate download URL" });
    }
    return res.json({ ok: true, url: data.signedUrl });
  } catch (e) {
    console.error("Slide URL error", e);
    return res.status(500).json({ ok: false, message: "Failed to generate slide URL" });
  }
});

// Middleware to allow Admins, Reps, or designated Creators to upload
const requireCreator = (req, res, next) => {
  const u = req.session.user;
  const isAllowed = u && (u.role === 'admin' || u.is_rep || u.is_leader || u.is_creator);
  
  if (isAllowed) return next();
  res.status(403).json({ ok: false, message: "Upload permissions required." });
};

// GET /api/categories - For the filter pills
app.get("/api/categories", async (req, res) => {
  try {
    const { rows } = await db.pool.query("SELECT * FROM resource_categories ORDER BY name ASC");
    res.json(rows);
  } catch (e) {
    res.status(500).json([]);
  }
});

// GET /api/resources - Only approved items for the public grid
app.get("/api/resources", async (req, res) => {
  try {
    const query = `
      SELECT r.*, c.name as category_name 
      FROM resources r
      LEFT JOIN resource_categories c ON r.category_id = c.id
      WHERE r.status = 'approved'
      ORDER BY r.created_at DESC
    `;
    const { rows } = await db.pool.query(query);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ ok: false, message: "Failed to fetch library" });
  }
});

// PATCH /api/resources/:id/view - Increments view count
app.patch("/api/resources/:id/view", async (req, res) => {
  try {
    await db.pool.query("UPDATE resources SET view_count = view_count + 1 WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

app.post("/api/resources", requireCreator, async (req, res) => {
  try {
    const { title, description, youtube_id, category_id, is_global, url } = req.body;
    const u = req.session.user;
    let finalUrl = url; // Use the text URL if provided (for links/websites)

    // 2. Handle File Upload if a file exists
    if (req.files && req.files.file) {
      const file = req.files.file;
      const fileId = uuidv4();
      const objectPath = `resources/${fileId}_${file.name}`;

      const { error: upErr } = await supabase.storage
        .from("campus-resources")
        .upload(objectPath, file.data, { contentType: file.mimetype });

      if (upErr) throw upErr;

      const { data: publicUrlData } = supabase.storage
        .from("campus-resources")
        .getPublicUrl(objectPath);
      
      finalUrl = publicUrlData.publicUrl;
    }

    // 3. Logic: Admins auto-approve, others stay pending
    const status = (u.role === 'admin') ? 'approved' : 'pending';

    const query = `
      INSERT INTO resources (
        title, description, url, youtube_id, category_id, 
        uploader_id, status, is_global
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const vals = [
      title, description, finalUrl, youtube_id || null, 
      category_id, u.id, status, is_global === "true"
    ];

    const { rows } = await db.pool.query(query, vals);
    res.json({ 
      ok: true, 
      resource: rows[0], 
      autoApproved: u.role === 'admin' 
    });
    
  } catch (e) {
    console.error("Upload error:", e);
    res.status(500).json({ ok: false, message: "Submission failed" });
  }
});

// GET /api/creator/my-resources - Allows creators to see their own upload status
app.get("/api/creator/my-resources", requireCreator, async (req, res) => {
  const { rows } = await db.pool.query(
    "SELECT * FROM resources WHERE uploader_id = $1 ORDER BY created_at DESC", 
    [req.session.user.id]
  );
  res.json(rows);
});

// GET /api/admin/resources/pending - The approval queue
app.get("/api/admin/resources/pending", requireAdmin, async (req, res) => {
  const query = `
    SELECT r.*, u.full_name as uploader_name 
    FROM resources r
    JOIN users_app u ON r.uploader_id = u.id
    WHERE r.status = 'pending'
  `;
  const { rows } = await db.pool.query(query);
  res.json(rows);
});

// PATCH /api/admin/resources/:id/status - Approve or Reject
app.patch("/api/admin/resources/:id/status", requireAdmin, async (req, res) => {
  const { status } = req.body; // Expects 'approved' or 'rejected'
  try {
    const result = await db.pool.query(
      "UPDATE resources SET status = $1 WHERE id = $2 RETURNING id",
      [status, req.params.id]
    );
    res.json({ ok: true, message: `Resource ${status}` });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

// DELETE /api/admin/resources/:id - Hard delete
app.delete("/api/admin/resources/:id", requireAdmin, async (req, res) => {
  await db.pool.query("DELETE FROM resources WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

app.post("/api/admin/resources", requireAdmin, async (req, res) => {
  try {
    const { 
      title, description, url, youtube_id, 
      category_id, program_id, is_global, status 
    } = req.body;
    
    const u = req.session.user;
    
    // Initialize finalUrl with the text input (could be a website link)
    let finalUrl = url;

    // 1. Handle File Upload (Priority)
    if (req.files && req.files.file) {
      const file = req.files.file;
      const fileId = uuidv4();
      
      // Using your specific folder structure: resources/[institution]/[filename]
      const instId = u.institutionId || 'global';
      const objectPath = `resources/${instId}/${fileId}_${file.name}`;

      const { error: upErr } = await supabase.storage
        .from("campus-resources")
        .upload(objectPath, file.data, { 
          contentType: file.mimetype,
          upsert: true // Overwrite if same ID exists
        });

      if (upErr) throw upErr;
      
      const { data: publicUrlData } = supabase.storage
        .from("campus-resources")
        .getPublicUrl(objectPath);
      
      // Override finalUrl with the fresh Supabase link
      finalUrl = publicUrlData.publicUrl;
    }

    // 2. Database Insertion
    const query = `
      INSERT INTO resources (
        title, description, url, youtube_id, category_id, 
        program_id, institution_id, is_global, uploader_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    // Ensure we handle defaults for Admin-created resources
    const vals = [
      title, 
      description, 
      finalUrl || null,      
      youtube_id || null, 
      category_id,
      program_id || u.programId || null, 
      u.institutionId || null, 
      is_global === 'true' || is_global === true, // Robust boolean check
      u.id, 
      status || 'approved'
    ];

    const { rows } = await db.pool.query(query, vals);
    res.json({ ok: true, resource: rows[0] });

  } catch (e) {
    console.error("Admin Resource Creation Error:", e);
    res.status(500).json({ ok: false, message: e.message || "Failed to create resource" });
  }
});

// Get all top-level posts and their reply counts for moderation
app.get("/api/admin/forum/summary", requireAdmin, async (req, res) => {
  try {
    const query = `
      SELECT p.*, u.full_name, 
      (SELECT COUNT(*) FROM forum_posts r WHERE r.parent_id = p.id) as reply_count
      FROM forum_posts p
      JOIN users_app u ON p.user_id = u.id
      WHERE p.parent_id IS NULL
      ORDER BY p.created_at DESC
    `;
    const { rows } = await db.pool.query(query);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

// Delete a post and all its nested replies
app.delete("/api/admin/forum/posts/:id", requireAdmin, async (req, res) => {
  try {
    const postId = req.params.id;
    // This query handles the tree deletion if you didn't set ON DELETE CASCADE
    await db.pool.query("DELETE FROM forum_posts WHERE id = $1 OR parent_id = $1", [postId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});


// --- NEW: User Permissions & Promotions (is_rep, is_leader, is_creator) ---
app.post("/api/admin/users/:studentId/permissions", requireAdmin, async (req, res) => {
  try {
    const sid = String(req.params.studentId || "").trim();
    const { bio, is_rep, is_leader, is_creator, role } = req.body;

    const query = `
      UPDATE users_app 
      SET bio = $1, is_rep = $2, is_leader = $3, is_creator = $4, role = $5
      WHERE student_id = $6
      RETURNING student_id, role, is_rep, is_leader, is_creator
    `;
    const vals = [bio, !!is_rep, !!is_leader, !!is_creator, role || "student", sid];
    
    const result = await db.pool.query(query, vals);
    if (!result.rowCount) return res.status(404).json({ ok: false, message: "User not found" });

    return res.json({ ok: true, user: result.rows[0] });
  } catch (e) {
    console.error("Permissions Update Error:", e);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

// --- NEW: Forum Moderation Tools ---
// List all posts across all threads for moderation
app.get("/api/admin/forum/posts", requireAdmin, async (req, res) => {
  try {
    const query = `
      SELECT p.*, u.full_name as user_name 
      FROM forum_posts p
      LEFT JOIN users_app u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `;
    const { rows } = await db.pool.query(query);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ ok: false, message: "Failed to fetch posts" });
  }
});

// Delete a post (Moderation action)
app.delete("/api/admin/forum/posts/:id", requireAdmin, async (req, res) => {
  try {
    const postId = req.params.id;
    // This will also delete replies if you have ON DELETE CASCADE set up in SQL
    await db.pool.query("DELETE FROM forum_posts WHERE id = $1", [postId]);
    res.json({ ok: true, message: "Post removed by moderator" });
  } catch (e) {
    res.status(500).json({ ok: false, message: "Failed to delete post" });
  }
});

// --- NEW: Announcement Management ---
// GET /api/announcements
app.get("/api/announcements", async (req, res) => {
  try {
    const u = req.session.user;

    // Fetch announcements that are EITHER global, for their institution, OR for their program
    const query = `
      SELECT a.*, u.full_name as author_name, u.role as author_role
      FROM announcements a
      LEFT JOIN users_app u ON a.author_id = u.id
      WHERE a.is_global = true 
      ${u ? 'OR a.target_institution = $1 OR a.target_program = $2' : ''}
      ORDER BY a.created_at DESC
    `;
    
    // We use the session data to filter
    const params = u ? [u.institutionId, u.programId] : [];
    const { rows } = await db.pool.query(query, params);
    res.json(rows);
  } catch (e) {
    console.error("Fetch announcements error:", e);
    res.status(500).json([]);
  }
});

// POST /api/admin/announcements
app.post("/api/admin/announcements", requireLeader, async (req, res) => {
  try {
    const { title, content, is_global, target_program } = req.body;
    const u = req.session.user;


    const finalIsGlobal = (u.role === 'admin') ? !!is_global : false;
    
    // If it's a leader, we ensure the institution_id is theirs
    // target_program remains optional (null = whole institution)
    const finalInstitutionId = u.institution_id; 

    const query = `
      INSERT INTO announcements (
        title, content, is_global, author_id, 
        target_institution, target_program
      )
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *
    `;

    const vals = [
      title, 
      content, 
      finalIsGlobal, 
      u.id, 
      finalInstitutionId, 
      target_program || null
    ];

    const { rows } = await db.pool.query(query, vals);
    res.json({ ok: true, announcement: rows[0] });
  } catch (e) {
    console.error("Post announcement error:", e);
    res.status(500).json({ ok: false, message: "Failed to broadcast announcement" });
  }
});

// --- NEW: Category Management ---
app.post("/api/admin/categories", requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    await db.pool.query("INSERT INTO categories (name) VALUES ($1)", [name]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: "Error adding category" });
  }
});

// Step 1: Send the email
app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://upsa-it09.onrender.com/reset-password.html',
    });
    
    if (error) return res.status(400).json({ ok: false, message: error.message });
    res.json({ ok: true });
});


app.post("/api/auth/reset-password", async (req, res) => {
    const { password } = req.body;
    

    const { error } = await supabase.auth.updateUser({ password });

    if (error) return res.status(400).json({ ok: false, message: error.message });
    res.json({ ok: true });
});

// GET /api/user/profile-full
app.get("/api/user/profile-full", async (req, res) => {
  try {
    const u = req.session?.user;
    if (!u) return res.status(401).json({ ok: false, message: "Unauthorized" });

    // 1. Fetch full user details from DB
    const userRes = await db.pool.query(
      "SELECT id, student_id, full_name, email, role, program, class_group, institution_id, bio, avatar_url FROM users_app WHERE id = $1",
      [u.id]
    );

    if (!userRes.rowCount) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    const userData = userRes.rows[0];

    // 2. Fetch user activity (slides/resources)
    // Adjust table names ('slides') to match your actual schema
    const resourcesRes = await db.pool.query(
      "SELECT id, slide_title as title, created_at FROM slides WHERE uploader_id = $1 ORDER BY created_at DESC",
      [u.id]
    );

    // 3. Fetch user posts (discussions)
    // Note: Ensure you have a 'posts' or 'discussions' table
    let posts = [];
    try {
      const postsRes = await db.pool.query(
        "SELECT id, title, content, created_at FROM posts WHERE author_id = $1 ORDER BY created_at DESC",
        [u.id]
      );
      posts = postsRes.rows;
    } catch (e) {
      console.warn("Posts table might not exist yet, skipping...");
    }

    return res.json({
      ok: true,
      user: userData,
      activity: {
        resources: resourcesRes.rows,
        posts: posts
      }
    });

  } catch (e) {
    console.error("Profile full fetch error:", e);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
});

// Also add the bio update route to prevent the next error!
app.post("/api/user/update-bio", async (req, res) => {
  try {
    const u = req.session?.user;
    if (!u) return res.status(401).json({ ok: false });

    const { bio } = req.body;
    await db.pool.query(
      "UPDATE users_app SET bio = $1 WHERE id = $2",
      [bio, u.id]
    );

    return res.json({ ok: true, message: "Bio updated" });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
});


// health endpoint for keepalive
app.get("/healthz", (req, res) => res.status(200).send("ok"));

(async () => {
  try {
    if (typeof db.initSchema === "function") {
      await db.initSchema();
    }
  } catch (err) {
    console.warn(
      "Continuing without confirmed schema init; errors may occur until DB is ready.",
      err,
    );
  }

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    // Self-ping keepalive (optional) using relative path to avoid localhost construction
    if (process.env.KEEPALIVE === "true") {
      const urlPath = "/healthz";
      const intervalMs = Number(process.env.KEEPALIVE_INTERVAL_MS || 60000);
      console.log(
        `[keepalive] enabled; pinging ${urlPath} every ${intervalMs}ms`,
      );
      setInterval(() => {
        // Use fetch relative to current origin (Node 18+ has global fetch)
        fetch(urlPath).catch(() => {});
      }, intervalMs);
    }
  });
})();

