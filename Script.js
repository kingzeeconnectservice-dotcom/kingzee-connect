
/* ============================================================
   KINGZEE CONNECT 🌎
   PHASE 3 — COMPLETE script.js

   Supabase project:
   https://qqvvdtrtwpmtjevcuwhk.supabase.co

   IMPORTANT:
   This frontend uses the Supabase publishable key.
   Never place a service_role key, owner PIN, or private
   server credential in this file.

   The database tables, Storage bucket, RLS policies and
   owner RPC functions must exist before all backend features
   can operate successfully.
============================================================ */

(() => {
  "use strict";

  /* ==========================================================
     1. CONFIGURATION
  ========================================================== */

  const CONFIG = Object.freeze({
    SUPABASE_URL: "https://qqvvdtrtwpmtjevcuwhk.supabase.co",

    // Public browser key supplied for this project.
    SUPABASE_PUBLISHABLE_KEY:
      "sb_publishable_Io8EpMhL6A1M8CDZHO6pJw_D6IXovRO",

    SITE_URL: "https://kingzee-connect-service.vercel.app/",
    MEDIA_BUCKET: "kingzee-media",

    FEES: {
      professional: 200,
      company: 300,
      store: 100,
      driver: 200
    },

    MAX_IMAGE_BYTES: 10 * 1024 * 1024,
    MAX_VIDEO_BYTES: 50 * 1024 * 1024,
    MAX_DOCUMENT_BYTES: 10 * 1024 * 1024,

    PAGE_SIZE: 20,

    TABLES: {
      profiles: "profiles",
      applications: "applications",
      payments: "payments",
      conversations: "conversations",
      messages: "messages",
      follows: "follows",
      statuses: "statuses",
      discover: "discover_posts",
      stores: "stores",
      trade: "trade_listings",
      drivers: "ride_drivers",
      rides: "ride_requests",
      support: "support_requests"
    }
  });

  const $ = (id) => document.getElementById(id);

  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  let supabase = null;
  let currentUser = null;
  let currentProfile = null;
  let activePage = "welcomePage";
  let activeProfile = null;
  let activeConversation = null;
  let activeApplication = null;
  let activeStatusList = [];
  let activeStatusIndex = 0;
  let currentApplicationFilter = "all";
  let currentSearchPage = 0;
  let currentSearchResults = [];
  let ownerSession = false;
  let authReady = false;
  let chatChannel = null;
  let activeRealtimeChannels = [];
  let selectedMessageFile = null;

  const previewUrls = new Set();

  const pageIds = [
    "welcomePage",
    "createAccountPage",
    "signInPage",
    "ownerLoginPage",
    "dashboardPage",
    "professionalRegistrationPage",
    "companyRegistrationPage",
    "searchPage",
    "publicProfilePage",
    "messagesPage",
    "statusPage",
    "statusViewerPage",
    "discoverPage",
    "userFollowPage",
    "myApplicationsPage",
    "applicationDetailsPage",
    "kingzeeTradePage",
    "storeRegistrationPage",
    "tradeListingFormPage",
    "kingzeeRidePage",
    "ecosystemServicePage",
    "profilePage",
    "menuPage",
    "supportPage",
    "ownerDashboardPage",
    "ownerReviewPage",
    "termsPage",
    "forgotPasswordPage"
  ];

  const pageHistory = [];

  /* ==========================================================
     2. UTILITIES
  ========================================================== */

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function formatMoney(value) {
    const amount = Number(value || 0);

    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2
    }).format(amount);
  }

  function formatDate(value) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Not available";

    return date.toLocaleString("en-GH", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function timeAgo(value) {
    const date = new Date(value);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (!Number.isFinite(seconds) || seconds < 0) return "Just now";
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;

    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function showToast(message, type = "info") {
    const toast = $("globalToast");
    if (!toast) return;

    toast.textContent = message;
    toast.className = `global-toast toast-${type}`;
    toast.hidden = false;

    window.clearTimeout(showToast.timer);

    showToast.timer = window.setTimeout(() => {
      toast.hidden = true;
    }, 4500);
  }

  function showFormMessage(id, message, type = "error") {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.className = `form-message ${type}-message`;
    element.hidden = false;
  }

  function clearFormMessage(id) {
    const element = $(id);
    if (!element) return;

    element.textContent = "";
    element.hidden = true;
  }

  function setButtonLoading(button, loading, text = "Please wait...") {
    if (!button) return;

    if (loading) {
      button.dataset.originalText = button.textContent;
      button.textContent = text;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    } else {
      button.textContent =
        button.dataset.originalText || button.textContent;
      button.disabled = false;
      button.removeAttribute("aria-busy");
      delete button.dataset.originalText;
    }
  }

  function requireSupabase() {
    if (!supabase) {
      showToast(
        "Supabase is not initialized. Check the project URL and public key.",
        "error"
      );
      return false;
    }

    return true;
  }

  function requireUser() {
    if (!currentUser) {
      showToast("Please sign in first.", "error");
      navigate("signInPage");
      return false;
    }

    return true;
  }

  function requireOwner() {
    if (!currentUser || !ownerSession) {
      showToast("Authorized owner access is required.", "error");
      navigate("ownerLoginPage");
      return false;
    }

    return true;
  }

  function normalizeName(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function getFormObject(form) {
    const result = {};

    if (!form) return result;

    new FormData(form).forEach((value, key) => {
      if (value instanceof File) return;

      if (key in result) {
        result[key] = Array.isArray(result[key])
          ? [...result[key], value]
          : [result[key], value];
      } else {
        result[key] = value;
      }
    });

    return result;
  }

  function setValue(id, value) {
    const element = $(id);
    if (element && value != null) {
      element.value = value;
    }
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = String(value ?? "");
  }

  function setVisible(id, visible) {
    const element = $(id);
    if (element) element.hidden = !visible;
  }

  function validateEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  function validatePhone(value) {
    return /^[+()\d\s.-]{7,25}$/.test(String(value || "").trim());
  }

  function isValidHttpUrl(value) {
    if (!value) return true;

    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  }

  function getFileFromForm(formId, fieldName) {
    const form = $(formId);
    const input = form?.elements.namedItem(fieldName);

    return input instanceof HTMLInputElement
      ? input.files?.[0] || null
      : null;
  }

  function getFilesFromForm(formId, fieldName) {
    const form = $(formId);
    const input = form?.elements.namedItem(fieldName);

    return input instanceof HTMLInputElement
      ? Array.from(input.files || [])
      : [];
  }

  function validateFile(file, category) {
    if (!file) return { ok: true };

    const allowedImage = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    const allowedVideo = [
      "video/mp4",
      "video/webm",
      "video/quicktime"
    ];

    const allowedDocuments = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    let allowedTypes = allowedImage;
    let maxBytes = CONFIG.MAX_IMAGE_BYTES;

    if (category === "video") {
      allowedTypes = allowedVideo;
      maxBytes = CONFIG.MAX_VIDEO_BYTES;
    } else if (category === "document") {
      allowedTypes = allowedDocuments;
      maxBytes = CONFIG.MAX_DOCUMENT_BYTES;
    }

    if (!allowedTypes.includes(file.type)) {
      return {
        ok: false,
        message: `Unsupported file type: ${file.name}`
      };
    }

    if (file.size > maxBytes) {
      return {
        ok: false,
        message: `${file.name} exceeds the permitted file size.`
      };
    }

    return { ok: true };
  }

  function validateFormFiles(formId, fields) {
    for (const field of fields) {
      const file = getFileFromForm(formId, field.name);
      if (!file) continue;

      const result = validateFile(file, field.type);

      if (!result.ok) {
        showToast(result.message, "error");
        return false;
      }
    }

    return true;
  }

  function filePreview(inputId, targetId) {
    const input = $(inputId);
    const target = $(targetId);

    if (!input || !target) return;

    input.addEventListener("change", () => {
      target.replaceChildren();

      const files = Array.from(input.files || []);

      for (const file of files) {
        const category = file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("image/")
            ? "image"
            : "document";

        const validation = validateFile(file, category);

        if (!validation.ok) {
          showToast(validation.message, "error");
          input.value = "";
          target.replaceChildren();
          return;
        }

        const wrapper = document.createElement("div");
        wrapper.className = "file-preview-item";

        if (file.type.startsWith("image/")) {
          const image = document.createElement("img");
          const url = URL.createObjectURL(file);

          previewUrls.add(url);
          image.src = url;
          image.alt = file.name;
          wrapper.append(image);
        } else if (file.type.startsWith("video/")) {
          const video = document.createElement("video");
          const url = URL.createObjectURL(file);

          previewUrls.add(url);
          video.src = url;
          video.controls = true;
          video.preload = "metadata";
          wrapper.append(video);
        }

        const caption = document.createElement("p");
        caption.textContent =
          `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;

        wrapper.append(caption);
        target.append(wrapper);
      }
    });
  }

  function setBusyForm(form, busy) {
    if (!form) return;

    form.querySelectorAll(
      'button[type="submit"], input[type="submit"]'
    ).forEach((button) => {
      button.disabled = busy;
    });
  }

  async function withFormSubmission(form, callback) {
    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!form.reportValidity()) return;

      setBusyForm(form, true);

      try {
        await callback(event);
      } catch (error) {
        console.error("Form submission failed:", error);
        showToast(error.message || "Something went wrong.", "error");
      } finally {
        setBusyForm(form, false);
      }
    });
  }

  /* ==========================================================
     3. SUPABASE INITIALIZATION
  ========================================================== */

  function initializeSupabase() {
    if (!window.supabase?.createClient) {
      console.error("Supabase browser library failed to load.");
      showToast("The connection library failed to load.", "error");
      return false;
    }

    try {
      supabase = window.supabase.createClient(
        CONFIG.SUPABASE_URL,
        CONFIG.SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      );

      return true;
    } catch (error) {
      console.error("Supabase initialization failed:", error);
      showToast("Unable to initialize Supabase.", "error");
      return false;
    }
  }

  async function dbSelect(table, queryBuilder) {
    if (!requireSupabase()) return { data: null, error: new Error("No Supabase") };

    let query = supabase.from(table).select("*");

    if (typeof queryBuilder === "function") {
      query = queryBuilder(query);
    }

    return await query;
  }

  async function dbInsert(table, payload, options = {}) {
    if (!requireSupabase()) throw new Error("Supabase is not initialized.");

    const query = supabase.from(table).insert(payload);

    if (options.returning) {
      const result = await query.select("*").single();
      if (result.error) throw result.error;
      return result.data;
    }

    const result = await query;

    if (result.error) throw result.error;

    return result.data;
  }

  async function dbUpdate(table, id, payload) {
    if (!requireSupabase()) throw new Error("Supabase is not initialized.");

    const result = await supabase
      .from(table)
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (result.error) throw result.error;

    return result.data;
  }

  async function uploadFile(file, folder = "uploads") {
    if (!file) return null;

    if (!requireSupabase()) throw new Error("Supabase is not initialized.");

    if (!currentUser) throw new Error("Sign in before uploading files.");

    const category = file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("image/")
        ? "image"
        : "document";

    const validation = validateFile(file, category);

    if (!validation.ok) throw new Error(validation.message);

    const safeName = file.name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-100);

    const path = `${currentUser.id}/${folder}/${crypto.randomUUID()}-${safeName}`;

    const result = await supabase.storage
      .from(CONFIG.MEDIA_BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type
      });

    if (result.error) throw result.error;

    // Keep the storage path, not a public URL, in database records.
    // A private bucket should be read using authenticated policies
    // or signed URLs issued only to authorized users.
    return result.data.path;
  }

  async function signedMediaUrl(path) {
    if (!path || !supabase) return null;

    const result = await supabase.storage
      .from(CONFIG.MEDIA_BUCKET)
      .createSignedUrl(path, 3600);

    if (result.error) {
      console.warn("Could not obtain media URL:", result.error.message);
      return null;
    }

    return result.data.signedUrl;
  }

  /* ==========================================================
     4. NAVIGATION
  ========================================================== */

  function navigate(pageId, options = {}) {
    const destination = $(pageId);

    if (!destination || !pageIds.includes(pageId)) {
      console.warn("Unknown page:", pageId);
      showToast("This page is not available.", "error");
      return;
    }

    const isOwnerPage = [
      "ownerDashboardPage",
      "ownerReviewPage"
    ].includes(pageId);

    const protectedPages = pageIds.filter((id) => ![
      "welcomePage",
      "createAccountPage",
      "signInPage",
      "ownerLoginPage",
      "termsPage",
      "forgotPasswordPage"
    ].includes(id));

    if (protectedPages.includes(pageId) && !currentUser) {
      showToast("Please sign in to continue.", "warning");
      pageId = "signInPage";
    }

    if (isOwnerPage && (!currentUser || !ownerSession)) {
      showToast("Owner access is required.", "warning");
      pageId = "ownerLoginPage";
    }

    if (pageId === "statusViewerPage" && !activeStatusList.length) {
      showToast("There are no status updates to display.", "info");
      return;
    }

    if (!options.replace && activePage !== pageId) {
      pageHistory.push(activePage);
    }

    for (const id of pageIds) {
      const page = $(id);
      if (!page) continue;

      page.hidden = id !== pageId;
      page.classList.toggle("active-page", id === pageId);
    }

    activePage = pageId;

    if (options.updateHash !== false) {
      try {
        history.replaceState(null, "", `#${pageId}`);
      } catch {
        // Navigation still works if browser history is unavailable.
      }
    }

    window.scrollTo({ top: 0, behavior: "instant" });

    if (pageId === "dashboardPage") loadDashboard();
    if (pageId === "profilePage") loadMyProfile();
    if (pageId === "myApplicationsPage") loadMyApplications();
    if (pageId === "searchPage") {
      if ($("searchQuery")) $("searchQuery").focus({ preventScroll: true });
    }
    if (pageId === "messagesPage") loadConversations();
    if (pageId === "statusPage") loadStatuses();
    if (pageId === "discoverPage") loadDiscoverFeed();
    if (pageId === "userFollowPage") loadFollows("following");
    if (pageId === "kingzeeTradePage") loadTradeStores();
    if (pageId === "kingzeeRidePage") loadRideData();
    if (pageId === "ownerDashboardPage") loadOwnerDashboard();

    destination.dispatchEvent(new CustomEvent("kingzee:page-opened", {
      detail: { pageId }
    }));
  }

  function goBack(defaultPage = "dashboardPage") {
    const previous = pageHistory.pop();

    if (previous && $(previous)) {
      navigate(previous, { replace: true });
    } else {
      navigate(defaultPage, { replace: true });
    }
  }

  function bindNavigation() {
    document.addEventListener("click", (event) => {
      const goButton = event.target.closest("[data-go]");

      if (goButton) {
        const page = goButton.dataset.go;

        if (goButton.dataset.service) {
          setEcosystemService(goButton.dataset.service);
        }

        if (goButton.dataset.tradeType) {
          setValue("tradeListingType", goButton.dataset.tradeType);
        }

        navigate(page);
        return;
      }

      const backButton = event.target.closest("[data-back]");

      if (backButton) {
        navigate(backButton.dataset.back);
      }
    });

    $("goCreateAccount")?.addEventListener("click", () =>
      navigate("createAccountPage")
    );

    $("goSignIn")?.addEventListener("click", () =>
      navigate("signInPage")
    );

    $("goOwnerLogin")?.addEventListener("click", () =>
      navigate("ownerLoginPage")
    );

    $("forgotPasswordBtn")?.addEventListener("click", () =>
      navigate("forgotPasswordPage")
    );

    document.addEventListener("click", (event) => {
      const termsButton = event.target.closest("[data-open-terms]");

      if (termsButton) {
        navigate("termsPage");
      }
    });

    $("chatBackBtn")?.addEventListener("click", () => {
      $("conversationList")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    document.addEventListener("click", (event) => {
      const copyButton = event.target.closest("[data-copy]");
      if (!copyButton) return;

      copyText(copyButton.dataset.copy);
    });
  }

  /* ==========================================================
     5. PASSWORD VISIBILITY AND CLIPBOARD
  ========================================================== */

  function bindPasswordVisibility() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-toggle-password]");
      if (!button) return;

      const input = $(button.dataset.togglePassword);
      if (!input) return;

      const show = input.type === "password";

      input.type = show ? "text" : "password";
      button.textContent = show ? "Hide" : "Show";
      button.setAttribute(
        "aria-label",
        `${show ? "Hide" : "Show"} password`
      );
    });
  }

  async function copyText(value) {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }

      await navigator.clipboard.writeText(value);
      showToast("Copied successfully.", "success");
    } catch {
      showToast("Copy failed. Please copy the text manually.", "error");
    }
  }

  /* ==========================================================
     6. AUTHENTICATION
  ========================================================== */

  async function fetchCurrentProfile() {
    if (!currentUser) {
      currentProfile = null;
      return null;
    }

    const result = await supabase
      .from(CONFIG.TABLES.profiles)
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (result.error) {
      console.warn("Profile lookup:", result.error.message);
      return null;
    }

    currentProfile = result.data || null;
    return currentProfile;
  }

  async function upsertOwnProfile(payload) {
    if (!currentUser) throw new Error("Please sign in first.");

    const result = await supabase
      .from(CONFIG.TABLES.profiles)
      .upsert({
        id: currentUser.id,
        ...payload,
        updated_at: new Date().toISOString()
      }, { onConflict: "id" })
      .select("*")
      .single();

    if (result.error) throw result.error;

    currentProfile = result.data;
    return result.data;
  }

  async function afterAuthentication(user) {
    currentUser = user;

    if (!currentUser) {
      currentProfile = null;
      ownerSession = false;
      return;
    }

    await fetchCurrentProfile();

    const name =
      currentProfile?.full_name ||
      currentUser.user_metadata?.full_name ||
      currentUser.email?.split("@")[0] ||
      "Member";

    setText("dashboardUserName", name);
    setText("profileDisplayName", name);
    setText("profileEmailDisplay", currentUser.email || "");
    setText("headerAvatar", name.charAt(0).toUpperCase());
    setText("profileAvatar", name.charAt(0).toUpperCase());

    if (activePage === "welcomePage" ||
        activePage === "signInPage" ||
        activePage === "createAccountPage") {
      navigate("dashboardPage", { replace: true });
    }
  }

  async function bindAuthentication() {
    if (!requireSupabase()) return;

    await withFormSubmission($("createAccountForm"), async () => {
      const fullName = normalizeName($("signupFullName")?.value);
      const email = $("signupEmail")?.value.trim();
      const phone = $("signupPhone")?.value.trim();
      const password = $("signupPassword")?.value || "";
      const confirmPassword = $("signupConfirmPassword")?.value || "";

      clearFormMessage("signupError");

      if (fullName.length < 2) {
        showFormMessage("signupError", "Enter your full name.");
        return;
      }

      if (!validateEmail(email)) {
        showFormMessage("signupError", "Enter a valid email address.");
        return;
      }

      if (!validatePhone(phone)) {
        showFormMessage("signupError", "Enter a valid phone number.");
        return;
      }

      if (password.length < 8) {
        showFormMessage("signupError", "Your password must have at least 8 characters.");
        return;
      }

      if (password !== confirmPassword) {
        showFormMessage("signupError", "The passwords do not match.");
        return;
      }

      if (!$("acceptTerms")?.checked) {
        showFormMessage("signupError", "Accept the terms before creating an account.");
        return;
      }

      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: CONFIG.SITE_URL,
          data: {
            full_name: fullName,
            phone
          }
        }
      });

      if (result.error) throw result.error;

      if (result.data.session && result.data.user) {
        currentUser = result.data.user;

        await upsertOwnProfile({
          full_name: fullName,
          phone
        });

        await afterAuthentication(result.data.user);
        showToast("Your account has been created.", "success");
      } else {
        showFormMessage(
          "signupError",
          "Account created. Check your email to confirm your account, then sign in.",
          "success"
        );

        navigate("signInPage");
      }
    });

    await withFormSubmission($("signInForm"), async () => {
      clearFormMessage("signinError");

      const email = $("loginEmail")?.value.trim();
      const password = $("loginPassword")?.value || "";

      if (!validateEmail(email) || !password) {
        showFormMessage("signinError", "Enter your email and password.");
        return;
      }

      const result = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (result.error) {
        showFormMessage("signinError", result.error.message);
        return;
      }

      currentUser = result.data.user;
      ownerSession = false;

      await afterAuthentication(result.data.user);
      showToast("Signed in successfully.", "success");
    });

    $("googleSignUp")?.addEventListener("click", signInWithGoogle);
    $("googleSignIn")?.addEventListener("click", signInWithGoogle);

    await withFormSubmission($("forgotPasswordForm"), async () => {
      const email = $("resetEmail")?.value.trim();

      if (!validateEmail(email)) {
        showFormMessage("resetPasswordMessage", "Enter a valid email.");
        return;
      }

      const result = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: CONFIG.SITE_URL
      });

      if (result.error) throw result.error;

      showFormMessage(
        "resetPasswordMessage",
        "If the address is registered, a password-reset email will be sent.",
        "success"
      );
    });

    $("dashboardSignOut")?.addEventListener("click", signOut);
    $("profileSignOutBtn")?.addEventListener("click", signOut);
    $("menuSignOutBtn")?.addEventListener("click", signOut);
    $("ownerSignOutBtn")?.addEventListener("click", signOut);

    supabase.auth.onAuthStateChange(async (event, session) => {
      currentUser = session?.user || null;

      if (!currentUser) {
        currentProfile = null;
        ownerSession = false;

        if (event === "SIGNED_OUT" && activePage !== "welcomePage") {
          navigate("welcomePage", { replace: true });
        }

        return;
      }

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        // Defer follow-up database work to avoid blocking the auth callback.
        window.setTimeout(async () => {
          if (currentUser?.id !== session?.user?.id) return;

          try {
            await fetchCurrentProfile();

            if (!authReady) {
              authReady = true;
              navigate("dashboardPage", { replace: true });
            }
          } catch (error) {
            console.warn("Session initialization:", error.message);
          }
        }, 0);
      }
    });
  }

  async function signInWithGoogle() {
    if (!requireSupabase()) return;

    const result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: CONFIG.SITE_URL
      }
    });

    if (result.error) {
      showToast(result.error.message, "error");
    }
  }

  async function signOut() {
    if (!requireSupabase()) return;

    const result = await supabase.auth.signOut();

    if (result.error) {
      showToast(result.error.message, "error");
      return;
    }

    currentUser = null;
    currentProfile = null;
    ownerSession = false;
    activeProfile = null;
    activeConversation = null;
    pageHistory.length = 0;

    removeRealtimeChannels();
    navigate("welcomePage", { replace: true });
    showToast("You have signed out.", "success");
  }

  /* ==========================================================
     7. OWNER AUTHENTICATION
  ========================================================== */

  async function bindOwnerLogin() {
    await withFormSubmission($("ownerLoginForm"), async () => {
      if (!requireSupabase()) return;

      clearFormMessage("ownerLoginError");

      const email = $("ownerEmail")?.value.trim();
      const password = $("ownerPassword")?.value || "";
      const pin = $("ownerPin")?.value.trim();

      if (!validateEmail(email) || !password || !pin) {
        showFormMessage(
          "ownerLoginError",
          "Enter your owner email, password and PIN."
        );
        return;
      }

      // First authenticate the user through Supabase Auth.
      const authResult = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authResult.error) {
        showFormMessage("ownerLoginError", "Owner authentication failed.");
        return;
      }

      // Verify owner role and PIN on the server.
      // The RPC must independently verify authorization and PIN.
      const verification = await supabase.rpc("verify_owner_access", {
        p_pin: pin
      });

      if (verification.error || verification.data !== true) {
        await supabase.auth.signOut();

        currentUser = null;
        ownerSession = false;

        showFormMessage(
          "ownerLoginError",
          "Owner access was not authorized. Verify your credentials and server configuration."
        );

        return;
      }

      currentUser = authResult.data.user;
      ownerSession = true;

      await fetchCurrentProfile();
      navigate("ownerDashboardPage", { replace: true });

      showToast("Owner access verified.", "success");
    });
  }

  /* ==========================================================
     8. DASHBOARD AND PROFILE
  ========================================================== */

  async function loadDashboard() {
    if (!currentUser) return;

    const profile = await fetchCurrentProfile();

    const name =
      profile?.full_name ||
      currentUser.user_metadata?.full_name ||
      currentUser.email?.split("@")[0] ||
      "Member";

    setText("dashboardUserName", name);
    setText("headerAvatar", name.charAt(0).toUpperCase());
  }

  async function loadMyProfile() {
    if (!currentUser) return;

    const profile = await fetchCurrentProfile();
    if (!profile) return;

    setValue("profileFullName", profile.full_name || "");
    setValue("profilePhone", profile.phone || "");
    setValue("profileLocation", profile.location || "");
    setValue("profileBio", profile.bio || "");

    setText("profileDisplayName", profile.full_name || "Your profile");
    setText("profileEmailDisplay", currentUser.email || "");
    setText("profileAvatar", (profile.full_name || "K").charAt(0).toUpperCase());
  }

  async function bindProfileForm() {
    await withFormSubmission($("profileForm"), async () => {
      if (!requireUser()) return;

      const fullName = normalizeName($("profileFullName")?.value);
      const phone = $("profilePhone")?.value.trim() || "";
      const location = $("profileLocation")?.value.trim() || "";
      const bio = $("profileBio")?.value.trim() || "";

      if (fullName.length < 2) {
        showToast("Enter a valid name.", "error");
        return;
      }

      const photo = getFileFromForm("profileForm", "photo");
      let photoPath = currentProfile?.photo_path || null;

      if (photo) {
        photoPath = await uploadFile(photo, "profile");
      }

      await upsertOwnProfile({
        full_name: fullName,
        phone,
        location,
        bio,
        photo_path: photoPath
      });

      await loadMyProfile();
      showToast("Profile updated.", "success");
    });
  }

  /* ==========================================================
     9. REGISTRATION APPLICATIONS
  ========================================================== */

  const registrationDefinitions = {
    professional: {
      formId: "professionalRegistrationForm",
      previewButton: "professionalPreviewBtn",
      previewPanel: "professionalPreviewPanel",
      previewContent: "professionalPreviewContent",
      editButton: "professionalEditBtn",
      paymentButton: "professionalContinuePaymentBtn",
      paymentPanel: "professionalPaymentPanel",
      paymentForm: "professionalPaymentForm",
      paymentAppId: "professionalPaymentApplicationId",
      applicationId: "professionalApplicationId",
      messageId: "professionalFormMessage",
      fee: CONFIG.FEES.professional,
      logoField: "logo",
      videoField: "video"
    },

    company: {
      formId: "companyRegistrationForm",
      previewButton: "companyPreviewBtn",
      previewPanel: "companyPreviewPanel",
      previewContent: "companyPreviewContent",
      editButton: "companyEditBtn",
      paymentButton: "companyContinuePaymentBtn",
      paymentPanel: "companyPaymentPanel",
      paymentForm: "companyPaymentForm",
      paymentAppId: "companyPaymentApplicationId",
      applicationId: "companyApplicationId",
      messageId: "companyFormMessage",
      fee: CONFIG.FEES.company,
      logoField: "logo",
      videoField: "video"
    },

    store: {
      formId: "storeRegistrationForm",
      previewButton: "storePreviewBtn",
      previewPanel: "storePreviewPanel",
      previewContent: "storePreviewContent",
      editButton: "storeEditBtn",
      paymentButton: "storeContinuePaymentBtn",
      paymentPanel: "storePaymentPanel",
      paymentForm: "storePaymentForm",
      paymentAppId: "storePaymentApplicationId",
      applicationId: "storeApplicationId",
      messageId: "storeFormMessage",
      fee: CONFIG.FEES.store,
      logoField: "logo"
    }
  };

  function registrationPayload(kind) {
    const def = registrationDefinitions[kind];
    const form = $(def.formId);

    if (!form) throw new Error("Registration form not found.");

    const values = getFormObject(form);

    const common = {
      professional: {
        full_name: values.fullName,
        email: values.email,
        address: values.address,
        service: values.service,
        other_service: values.otherService || null,
        location: values.location,
        whatsapp: values.whatsapp,
        call_number: values.callNumber,
        description: values.description
      },

      company: {
        company_name: values.companyName,
        contact_name: values.contactName,
        email: values.email,
        phone: values.phone,
        whatsapp: values.whatsapp,
        category: values.category,
        address: values.address,
        location: values.location,
        website: values.website || null,
        description: values.description
      },

      store: {
        store_name: values.storeName,
        owner_name: values.ownerName,
        email: values.email,
        phone: values.phone,
        whatsapp: values.whatsapp,
        category: values.category,
        location: values.location,
        address: values.address,
        description: values.description
      }
    };

    return common[kind];
  }

  function validateRegistration(kind) {
    const def = registrationDefinitions[kind];
    const form = $(def.formId);

    if (!form.reportValidity()) return false;

    const values = getFormObject(form);

    if (values.email && !validateEmail(values.email)) {
      showToast("Enter a valid email address.", "error");
      return false;
    }

    const fileFields = kind === "professional"
      ? [
          { name: "logo", type: "image" },
          { name: "video", type: "video" }
        ]
      : kind === "company"
        ? [
            { name: "logo", type: "image" },
            { name: "images", type: "image" },
            { name: "video", type: "video" }
          ]
        : [{ name: "logo", type: "image" }];

    return validateFormFiles(def.formId, fileFields);
  }

  async function makeRegistrationPreview(kind) {
    if (!requireUser()) return;
    if (!validateRegistration(kind)) return;

    const def = registrationDefinitions[kind];
    const form = $(def.formId);
    const payload = registrationPayload(kind);
    const target = $(def.previewContent);

    if (!target) return;

    target.replaceChildren();

    const heading = document.createElement("h3");
    heading.textContent =
      payload.full_name ||
      payload.company_name ||
      payload.store_name ||
      "Application preview";

    target.append(heading);

    for (const [key, value] of Object.entries(payload)) {
      if (value == null || value === "") continue;

      const row = document.createElement("p");
      const label = key.replace(/_/g, " ");

      row.textContent =
        `${label.charAt(0).toUpperCase()}${label.slice(1)}: ${value}`;

      target.append(row);
    }

    for (const fieldName of [
      "logo",
      "video",
      "images",
      "paymentProof"
    ]) {
      const input = form.elements.namedItem(fieldName);

      if (!(input instanceof HTMLInputElement) || !input.files?.length) {
        continue;
      }

      for (const file of input.files) {
        if (!file.type.startsWith("image/") &&
            !file.type.startsWith("video/")) {
          continue;
        }

        const url = URL.createObjectURL(file);
        previewUrls.add(url);

        const media = file.type.startsWith("video/")
          ? document.createElement("video")
          : document.createElement("img");

        media.src = url;
        media.controls = media.tagName === "VIDEO";
        media.alt = file.name;

        target.append(media);
      }
    }

    setVisible(def.previewPanel, true);
    setVisible(def.paymentPanel, false);

    $(def.previewPanel)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  async function saveRegistrationDraft(kind) {
    if (!requireUser()) return;
    if (!validateRegistration(kind)) return;

    const def = registrationDefinitions[kind];
    const existingId = $(def.applicationId)?.value || null;

    const payload = registrationPayload(kind);

    let logoPath = null;
    let videoPath = null;

    const logo = getFileFromForm(def.formId, def.logoField);
    const video = def.videoField
      ? getFileFromForm(def.formId, def.videoField)
      : null;

    if (logo) logoPath = await uploadFile(logo, `${kind}/logos`);
    if (video) videoPath = await uploadFile(video, `${kind}/videos`);

    const images = kind === "company"
      ? getFilesFromForm(def.formId, "images")
      : [];

    const imagePaths = [];

    for (const imageFile of images) {
      imagePaths.push(await uploadFile(imageFile, `${kind}/images`));
    }

    const record = {
      user_id: currentUser.id,
      type: kind,
      status: "draft",
      payment_status: "unpaid",
      fee_amount: def.fee,
      data: payload,
      logo_path: logoPath,
      video_path: videoPath,
      image_paths: imagePaths,
      updated_at: new Date().toISOString()
    };

    let saved;

    if (existingId) {
      saved = await dbUpdate(
        CONFIG.TABLES.applications,
        existingId,
        record
      );
    } else {
      saved = await dbInsert(
        CONFIG.TABLES.applications,
        {
          ...record,
          created_at: new Date().toISOString()
        },
        { returning: true }
      );
    }

    setValue(def.applicationId, saved.id);
    showFormMessage(
      def.messageId,
      "Draft saved. You can return to it before submitting payment.",
      "success"
    );

    showToast("Draft saved successfully.", "success");
  }

  async function continueRegistrationPayment(kind) {
    if (!requireUser()) return;

    const def = registrationDefinitions[kind];
    const existingId = $(def.applicationId)?.value;

    if (!existingId) {
      showToast("Preview and save your application first.", "warning");
      return;
    }

    setValue(def.paymentAppId, existingId);
    setVisible(def.paymentPanel, true);

    $(def.paymentPanel)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  async function submitRegistrationPayment(kind) {
    if (!requireUser()) return;

    const def = registrationDefinitions[kind];
    const form = $(def.paymentForm);

    if (!form?.reportValidity()) return;

    const applicationId =
      $(def.paymentAppId)?.value ||
      $(def.applicationId)?.value;

    if (!applicationId) {
      showToast("Application ID is missing. Save the application first.", "error");
      return;
    }

    const method = form.elements.namedItem("paymentMethod")?.value;
    const reference = form.elements.namedItem("reference")?.value?.trim() || "";
    const proof = getFileFromForm(def.paymentForm, "paymentProof");

    if (!proof) {
      showToast("Upload your payment proof.", "error");
      return;
    }

    const validation = validateFile(proof, "document");

    if (!validation.ok) {
      showToast(validation.message, "error");
      return;
    }

    const proofPath = await uploadFile(proof, `${kind}/payment-proofs`);

    // This is a payment-verification request, not a verified payment.
    const payment = await dbInsert(
      CONFIG.TABLES.payments,
      {
        user_id: currentUser.id,
        application_id: applicationId,
        method,
        reference: reference || null,
        proof_path: proofPath,
        amount: def.fee,
        currency: "GHS",
        status: "pending",
        created_at: new Date().toISOString()
      },
      { returning: true }
    );

    await dbUpdate(CONFIG.TABLES.applications, applicationId, {
      status: "pending",
      payment_status: "pending",
      payment_id: payment.id,
      submitted_at: new Date().toISOString()
    });

    showFormMessage(
      def.messageId,
      "Your application and payment proof were submitted for owner review.",
      "success"
    );

    showToast("Submitted for review.", "success");
    navigate("myApplicationsPage");
  }

  function bindRegistrationForms() {
    for (const kind of Object.keys(registrationDefinitions)) {
      const def = registrationDefinitions[kind];

      $(def.previewButton)?.addEventListener("click", () =>
        makeRegistrationPreview(kind).catch(handleError)
      );

      $(def.editButton)?.addEventListener("click", () => {
        setVisible(def.previewPanel, false);

        $(def.formId)?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });

      $(def.paymentButton)?.addEventListener("click", () =>
        continueRegistrationPayment(kind).catch(handleError)
      );

      const draftButtonId = {
        professional: "professionalSaveDraftBtn",
        company: "companySaveDraftBtn",
        store: "storeSaveDraftBtn"
      }[kind];

      $(draftButtonId)?.addEventListener("click", () =>
        saveRegistrationDraft(kind).catch(handleError)
      );

      withFormSubmission($(def.paymentForm), async () => {
        await submitRegistrationPayment(kind);
      }).catch(handleError);
    }
  }

  /* ==========================================================
     10. MY APPLICATIONS
  ========================================================== */

  async function loadMyApplications() {
    if (!currentUser) return;

    const target = $("myApplicationsList");
    if (!target) return;

    target.replaceChildren();

    const result = await supabase
      .from(CONFIG.TABLES.applications)
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (result.error) {
      target.textContent = "Unable to load applications. Check database setup.";
      console.error(result.error);
      return;
    }

    let records = result.data || [];

    if (currentApplicationFilter !== "all") {
      records = records.filter((record) =>
        String(record.status).toLowerCase() === currentApplicationFilter
      );
    }

    if (!records.length) {
      target.innerHTML = `
        <div class="empty-state">
          <span>📋</span>
          <p>No applications found for this filter.</p>
        </div>`;
      return;
    }

    for (const record of records) {
      target.append(createApplicationCard(record));
    }
  }

  function createApplicationCard(record) {
    const card = document.createElement("article");
    card.className = "application-card";

    const data = record.data || {};
    const title =
      data.full_name ||
      data.company_name ||
      data.store_name ||
      data.title ||
      `${record.type || "Application"} application`;

    const status = record.status || "pending";

    card.innerHTML = `
      <div class="application-card-header">
        <div>
          <h3>${escapeHTML(title)}</h3>
          <p>${escapeHTML(record.type || "Application")}</p>
        </div>
        <span class="status-badge status-${escapeHTML(status)}">
          ${escapeHTML(status)}
        </span>
      </div>
      <p>Fee: ${formatMoney(record.fee_amount || 0)}</p>
      <p>Submitted: ${escapeHTML(formatDate(record.submitted_at || record.created_at))}</p>
      <p>Payment: ${escapeHTML(record.payment_status || "unpaid")}</p>
      <div class="application-card-actions">
        <button type="button" class="btn btn-secondary" data-view-application="${escapeHTML(record.id)}">
          View details
        </button>
        ${status === "approved" ? `
          <button type="button" class="btn btn-primary" data-edit-application="${escapeHTML(record.id)}">
            Edit profile
          </button>` : ""}
      </div>
    `;

    return card;
  }

  async function openApplicationDetails(id) {
    if (!requireUser()) return;

    const result = await supabase
      .from(CONFIG.TABLES.applications)
      .select("*")
      .eq("id", id)
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (result.error || !result.data) {
      showToast("Application not found or access denied.", "error");
      return;
    }

    activeApplication = result.data;

    const target = $("applicationDetailsContent");
    if (!target) return;

    const record = result.data;
    const data = record.data || {};

    target.replaceChildren();

    const title = document.createElement("h2");
    title.textContent =
      data.full_name ||
      data.company_name ||
      data.store_name ||
      "Application details";

    target.append(title);

    for (const [key, value] of Object.entries(data)) {
      if (value == null || value === "") continue;

      const row = document.createElement("p");
      row.textContent = `${key.replace(/_/g, " ")}: ${value}`;
      target.append(row);
    }

    const status = document.createElement("p");
    status.textContent = `Status: ${record.status}`;
    target.append(status);

    const approved = record.status === "approved";

    setVisible("editApprovedApplicationBtn", approved);
    setVisible("resubmitApplicationBtn", record.status === "changes_requested");

    navigate("applicationDetailsPage");
  }

  async function editApprovedApplication() {
    if (!activeApplication || activeApplication.status !== "approved") {
      showToast("Only approved applications can be edited.", "warning");
      return;
    }

    const kind = activeApplication.type;
    const def = registrationDefinitions[kind];

    if (!def) {
      showToast("This application type cannot be edited here yet.", "warning");
      return;
    }

    const payload = activeApplication.data || {};

    const mapping = {
      professional: {
        professionalFullName: "full_name",
        professionalEmail: "email",
        professionalAddress: "address",
        professionalService: "service",
        professionalOtherService: "other_service",
        professionalLocation: "location",
        professionalWhatsApp: "whatsapp",
        professionalCallNumber: "call_number",
        professionalDescription: "description"
      },
      company: {
        companyName: "company_name",
        companyContactName: "contact_name",
        companyEmail: "email",
        companyPhone: "phone",
        companyWhatsApp: "whatsapp",
        companyCategory: "category",
        companyAddress: "address",
        companyLocation: "location",
        companyWebsite: "website",
        companyDescription: "description"
      },
      store: {
        storeName: "store_name",
        storeOwnerName: "owner_name",
        storeEmail: "email",
        storePhone: "phone",
        storeWhatsApp: "whatsapp",
        storeCategoryRegistration: "category",
        storeLocation: "location",
        storeAddress: "address",
        storeDescription: "description"
      }
    };

    for (const [elementId, key] of Object.entries(mapping[kind] || {})) {
      setValue(elementId, payload[key] || "");
    }

    setValue(def.applicationId, activeApplication.id);
    navigate(kind === "professional"
      ? "professionalRegistrationPage"
      : kind === "company"
        ? "companyRegistrationPage"
        : "storeRegistrationPage"
    );
  }

  function bindApplicationList() {
    document.addEventListener("click", async (event) => {
      const view = event.target.closest("[data-view-application]");
      if (view) {
        await openApplicationDetails(view.dataset.viewApplication);
        return;
      }

      const edit = event.target.closest("[data-edit-application]");
      if (edit) {
        const result = await supabase
          .from(CONFIG.TABLES.applications)
          .select("*")
          .eq("id", edit.dataset.editApplication)
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (result.error || !result.data) {
          showToast("Unable to load the approved profile.", "error");
          return;
        }

        activeApplication = result.data;
        await editApprovedApplication();
      }
    });

    $$("[data-application-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        currentApplicationFilter = button.dataset.applicationFilter;

        $$("[data-application-filter]").forEach((item) =>
          item.classList.toggle("active-filter", item === button)
        );

        loadMyApplications();
      });
    });

    $("refreshApplicationsBtn")?.addEventListener("click", loadMyApplications);

    $("editApprovedApplicationBtn")?.addEventListener(
      "click",
      editApprovedApplication
    );
  }

  /* ==========================================================
     11. SEARCH APPROVED PROFILES
  ========================================================== */

  async function searchProfiles() {
    if (!requireUser()) return;

    const query = $("searchQuery")?.value.trim() || "";
    const location = $("searchLocation")?.value.trim() || "";
    const type = $("searchType")?.value || "all";

    const target = $("searchResults");
    if (!target) return;

    target.replaceChildren();

    let request = supabase
      .from(CONFIG.TABLES.applications)
      .select("*", { count: "exact" })
      .eq("status", "approved")
      .in("type", type === "all"
        ? ["professional", "company", "store"]
        : [type]
      );

    if (query) {
      // Filter JSON data in the client after retrieving the approved
      // result set to avoid relying on a database-specific JSON query.
    }

    const from = currentSearchPage * CONFIG.PAGE_SIZE;
    const to = from + CONFIG.PAGE_SIZE - 1;

    request = request
      .order("created_at", { ascending: false })
      .range(from, to);

    const result = await request;

    if (result.error) {
      console.error("Search error:", result.error);
      target.innerHTML = `
        <div class="empty-state">
          <span>⚠️</span>
          <p>Search is unavailable. Confirm the applications table and its public approved-profile policy.</p>
        </div>`;
      return;
    }

    currentSearchResults = (result.data || []).filter((record) => {
      const data = record.data || {};

      const searchable = [
        data.full_name,
        data.company_name,
        data.store_name,
        data.service,
        data.other_service,
        data.category,
        data.description,
        data.location
      ].filter(Boolean).join(" ").toLowerCase();

      const matchesQuery = !query || searchable.includes(query.toLowerCase());
      const matchesLocation =
        !location ||
        String(data.location || "").toLowerCase().includes(location.toLowerCase());

      return matchesQuery && matchesLocation;
    });

    setText(
      "searchResultsCount",
      `${result.count ?? currentSearchResults.length} results`
    );

    if (!currentSearchResults.length) {
      target.innerHTML = `
        <div class="empty-state">
          <span>🔍</span>
          <h3>No matching profiles</h3>
          <p>Try another search term or location.</p>
        </div>`;
      return;
    }

    for (const record of currentSearchResults) {
      target.append(await createPublicProfileCard(record));
    }

    renderPagination(result.count || currentSearchResults.length);
  }

  async function createPublicProfileCard(record) {
    const data = record.data || {};
    const card = document.createElement("article");

    card.className = "profile-card";

    const title =
      data.full_name ||
      data.company_name ||
      data.store_name ||
      "KINGZEE CONNECT profile";

    const media = document.createElement("div");
    media.className = "profile-card-media";

    if (record.logo_path) {
      const url = await signedMediaUrl(record.logo_path);

      if (url) {
        const image = document.createElement("img");
        image.src = url;
        image.alt = `${title} profile image`;
        image.loading = "lazy";
        media.append(image);
      }
    }

    if (!media.childElementCount) {
      const placeholder = document.createElement("span");
      placeholder.className = "tile-icon";
      placeholder.textContent = record.type === "company"
        ? "🏢"
        : record.type === "store"
          ? "🏪"
          : "🛠️";
      media.append(placeholder);
    }

    const body = document.createElement("div");
    body.className = "profile-card-body";

    const heading = document.createElement("h3");
    heading.textContent = title;

    const type = document.createElement("p");
    type.textContent = `${record.type || "Professional"} · Approved`;

    const description = document.createElement("p");
    description.textContent = (
      data.description ||
      data.service ||
      data.category ||
      "Connect to learn more about this profile."
    ).slice(0, 220);

    const location = document.createElement("p");
    location.textContent = data.location || "Location not provided";

    body.append(heading, type, description, location);

    const actions = document.createElement("div");
    actions.className = "profile-actions";

    const viewButton = document.createElement("button");
    viewButton.className = "btn btn-secondary";
    viewButton.textContent = "View";
    viewButton.dataset.publicProfile = record.id;

    const followButton = document.createElement("button");
    followButton.className = "btn btn-outline";
    followButton.textContent = "Follow";
    followButton.dataset.followUser = record.user_id;

    actions.append(viewButton, followButton);

    card.append(media, body, actions);

    return card;
  }

  function renderPagination(total) {
    const target = $("searchPagination");
    if (!target) return;

    target.replaceChildren();

    const pages = Math.ceil(total / CONFIG.PAGE_SIZE);

    if (pages <= 1) return;

    const previous = document.createElement("button");
    previous.type = "button";
    previous.textContent = "←";
    previous.disabled = currentSearchPage === 0;

    previous.addEventListener("click", () => {
      currentSearchPage--;
      searchProfiles();
    });

    target.append(previous);

    const label = document.createElement("span");
    label.textContent = `Page ${currentSearchPage + 1} of ${pages}`;
    target.append(label);

    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "→";
    next.disabled = currentSearchPage >= pages - 1;

    next.addEventListener("click", () => {
      currentSearchPage++;
      searchProfiles();
    });

    target.append(next);
  }

  async function openPublicProfile(id) {
    if (!requireUser()) return;

    const result = await supabase
      .from(CONFIG.TABLES.applications)
      .select("*")
      .eq("id", id)
      .eq("status", "approved")
      .maybeSingle();

    if (result.error || !result.data) {
      showToast("Profile not found or not publicly approved.", "error");
      return;
    }

    activeProfile = result.data;

    const target = $("publicProfileContent");
    if (!target) return;

    target.replaceChildren();

    const data = activeProfile.data || {};
    const title =
      data.full_name ||
      data.company_name ||
      data.store_name ||
      "Profile";

    const heading = document.createElement("h2");
    heading.textContent = title;
    target.append(heading);

    if (activeProfile.logo_path) {
      const url = await signedMediaUrl(activeProfile.logo_path);

      if (url) {
        const image = document.createElement("img");
        image.src = url;
        image.alt = `${title} logo`;
        target.append(image);
      }
    }

    for (const [key, value] of Object.entries(data)) {
      if (!value) continue;

      const row = document.createElement("p");
      row.textContent = `${key.replace(/_/g, " ")}: ${value}`;
      target.append(row);
    }

    const follow = $("publicProfileFollowBtn");
    const message = $("publicProfileMessageBtn");
    const book = $("publicProfileBookBtn");

    if (follow) follow.dataset.followUser = activeProfile.user_id;
    if (message) message.dataset.messageUser = activeProfile.user_id;
    if (book) book.dataset.bookUser = activeProfile.user_id;

    navigate("publicProfilePage");
  }

  function bindSearch() {
    $("searchForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      currentSearchPage = 0;
      await searchProfiles();
    });

    document.addEventListener("click", async (event) => {
      const profileButton = event.target.closest("[data-public-profile]");
      if (profileButton) {
        await openPublicProfile(profileButton.dataset.publicProfile);
        return;
      }

      const followButton = event.target.closest("[data-follow-user]");
      if (followButton) {
        await followUser(followButton.dataset.followUser);
        return;
      }

      const messageButton = event.target.closest("[data-message-user]");
      if (messageButton) {
        await openConversation(messageButton.dataset.messageUser);
        return;
      }

      const bookButton = event.target.closest("[data-book-user]");
      if (bookButton) {
        const partnerId = bookButton.dataset.bookUser;

        if (!partnerId || partnerId === currentUser?.id) {
          showToast("Choose a valid service provider.", "error");
          return;
        }

        setValue("rideDestination", "");
        await openConversation(partnerId);

        showToast(
          "Discuss the booking details with the provider in messages.",
          "info"
        );
      }
    });
  }

  /* ==========================================================
     12. MESSAGING
  ========================================================== */

  async function loadConversations() {
    if (!currentUser) return;

    const target = $("conversationList");
    if (!target) return;

    target.replaceChildren();

    const result = await supabase
      .from(CONFIG.TABLES.conversations)
      .select("*")
      .contains("participant_ids", [currentUser.id])
      .order("updated_at", { ascending: false });

    if (result.error) {
      console.error("Conversation loading:", result.error);
      target.textContent = "Unable to load conversations.";
      return;
    }

    const conversations = result.data || [];

    if (!conversations.length) {
      target.innerHTML = `
        <div class="empty-state">
          <span>💬</span>
          <p>Your conversations will appear here.</p>
        </div>`;
      return;
    }

    for (const conversation of conversations) {
      const participants = conversation.participant_ids || [];
      const partnerId = participants.find((id) => id !== currentUser.id);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "conversation-item";

      const avatar = document.createElement("span");
      avatar.className = "avatar-placeholder";
      avatar.textContent = "K";

      const body = document.createElement("span");
      body.className = "conversation-item-body";

      const name = document.createElement("strong");
      name.textContent = conversation.title || "KINGZEE CONNECT member";

      const preview = document.createElement("small");
      preview.textContent = conversation.last_message || "Open conversation";

      body.append(name, preview);
      button.append(avatar, body);

      button.addEventListener("click", () =>
        openConversation(partnerId, conversation.id)
      );

      target.append(button);
    }
  }

  async function openConversation(partnerId, conversationId = null) {
    if (!requireUser()) return;

    if (!partnerId || partnerId === currentUser.id) {
      showToast("Choose another user to start a conversation.", "warning");
      return;
    }

    let conversation = null;

    if (conversationId) {
      const result = await supabase
        .from(CONFIG.TABLES.conversations)
        .select("*")
        .eq("id", conversationId)
        .maybeSingle();

      if (result.error) throw result.error;
      conversation = result.data;
    } else {
      const existing = await supabase
        .from(CONFIG.TABLES.conversations)
        .select("*")
        .contains("participant_ids", [currentUser.id])
        .contains("participant_ids", [partnerId])
        .limit(1);

      if (existing.error) throw existing.error;

      conversation = existing.data?.[0] || null;
    }

    if (!conversation) {
      conversation = await dbInsert(
        CONFIG.TABLES.conversations,
        {
          participant_ids: [currentUser.id, partnerId],
          created_by: currentUser.id,
          updated_at: new Date().toISOString()
        },
        { returning: true }
      );
    }

    activeConversation = conversation.id;

    setValue("activeConversationId", activeConversation);

    setText("chatPartnerName", "KINGZEE CONNECT member");
    setText("chatPartnerStatus", "Conversation");
    setText("chatPartnerAvatar", "K");

    navigate("messagesPage");
    await loadMessages();

    subscribeToMessages();
  }

  async function loadMessages() {
    if (!activeConversation || !currentUser) return;

    const target = $("chatMessages");
    if (!target) return;

    target.replaceChildren();

    const result = await supabase
      .from(CONFIG.TABLES.messages)
      .select("*")
      .eq("conversation_id", activeConversation)
      .order("created_at", { ascending: true })
      .limit(200);

    if (result.error) {
      console.error("Message loading:", result.error);
      target.textContent = "Unable to load messages.";
      return;
    }

    for (const message of result.data || []) {
      target.append(await createMessageBubble(message));
    }

    target.scrollTop = target.scrollHeight;
  }

  async function createMessageBubble(message) {
    const bubble = document.createElement("article");

    bubble.className = "message-bubble";
    if (message.sender_id === currentUser?.id) {
      bubble.classList.add("own-message");
    }

    if (message.media_path) {
      const url = await signedMediaUrl(message.media_path);

      if (url) {
        const media = message.media_type?.startsWith("video/")
          ? document.createElement("video")
          : document.createElement("img");

        media.src = url;
        media.controls = media.tagName === "VIDEO";
        media.alt = "Message attachment";
        bubble.append(media);
      }
    }

    if (message.content) {
      const text = document.createElement("p");
      text.textContent = message.content;
      bubble.append(text);
    }

    const time = document.createElement("time");
    time.textContent = formatDate(message.created_at);

    bubble.append(time);

    return bubble;
  }

  function subscribeToMessages() {
    if (!supabase || !activeConversation) return;

    if (chatChannel) {
      supabase.removeChannel(chatChannel);
      chatChannel = null;
    }

    chatChannel = supabase
      .channel(`messages:${activeConversation}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: CONFIG.TABLES.messages,
          filter: `conversation_id=eq.${activeConversation}`
        },
        async (payload) => {
          const target = $("chatMessages");
          if (!target) return;

          target.append(await createMessageBubble(payload.new));
          target.scrollTop = target.scrollHeight;
        }
      )
      .subscribe();
  }

  async function sendMessage(event) {
    event.preventDefault();

    if (!requireUser()) return;

    if (!activeConversation) {
      showToast("Open a conversation first.", "warning");
      return;
    }

    const content = $("messageText")?.value.trim() || "";
    const file = selectedMessageFile;

    if (!content && !file) {
      showToast("Write a message or attach a file.", "warning");
      return;
    }

    let mediaPath = null;

    if (file) {
      const category = file.type.startsWith("video/")
        ? "video"
        : "image";

      const validation = validateFile(file, category);

      if (!validation.ok) {
        showToast(validation.message, "error");
        return;
      }

      mediaPath = await uploadFile(file, "messages");
    }

    await dbInsert(CONFIG.TABLES.messages, {
      conversation_id: activeConversation,
      sender_id: currentUser.id,
      content: content || null,
      media_path: mediaPath,
      media_type: file?.type || null,
      created_at: new Date().toISOString()
    });

    await supabase
      .from(CONFIG.TABLES.conversations)
      .update({
        last_message: content || "Media attachment",
        updated_at: new Date().toISOString()
      })
      .eq("id", activeConversation);

    $("messageText").value = "";
    $("messageAttachment").value = "";
    $("chatAttachmentPreview")?.replaceChildren();

    selectedMessageFile = null;

    await loadMessages();
  }

  function bindMessages() {
    $("messageForm")?.addEventListener("submit", (event) =>
      sendMessage(event).catch(handleError)
    );

    $("messageAttachment")?.addEventListener("change", () => {
      const input = $("messageAttachment");
      const file = input?.files?.[0];

      selectedMessageFile = file || null;

      const target = $("chatAttachmentPreview");
      if (!target) return;

      target.replaceChildren();

      if (!file) {
        target.hidden = true;
        return;
      }

      const validation = validateFile(
        file,
        file.type.startsWith("video/") ? "video" : "image"
      );

      if (!validation.ok) {
        showToast(validation.message, "error");
        input.value = "";
        selectedMessageFile = null;
        target.hidden = true;
        return;
      }

      const label = document.createElement("span");
      label.textContent = file.name;

      target.append(label);
      target.hidden = false;
    });

    $("refreshConversationsBtn")?.addEventListener("click", () =>
      loadConversations().catch(handleError)
    );
  }

  /* ==========================================================
     13. STATUS
  ========================================================== */

  async function publishStatus(event) {
    event.preventDefault();

    if (!requireUser()) return;

    const caption = $("statusCaption")?.value.trim() || "";
    const file = getFileFromForm("statusForm", "media");
    const audience = $("statusAudience")?.value || "everyone";

    if (!caption && !file) {
      showToast("Add a caption or media.", "warning");
      return;
    }

    if (file) {
      const category = file.type.startsWith("video/")
        ? "video"
        : "image";

      const validation = validateFile(file, category);

      if (!validation.ok) {
        showToast(validation.message, "error");
        return;
      }
    }

    const mediaPath = file
      ? await uploadFile(file, "status")
      : null;

    await dbInsert(CONFIG.TABLES.statuses, {
      user_id: currentUser.id,
      caption: caption || null,
      media_path: mediaPath,
      media_type: file?.type || null,
      audience,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    $("statusForm").reset();
    $("statusMediaPreview")?.replaceChildren();

    showToast("Status published.", "success");
    await loadStatuses();
  }

  async function loadStatuses() {
    if (!currentUser) return;

    const target = $("statusStories");
    if (!target) return;

    target.replaceChildren();

    const result = await supabase
      .from(CONFIG.TABLES.statuses)
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(100);

    if (result.error) {
      console.error("Status loading:", result.error);
      target.textContent = "Unable to load status updates.";
      return;
    }

    const records = result.data || [];
    activeStatusList = records;

    if (!records.length) {
      target.innerHTML = `
        <div class="empty-state">
          <span>◉</span>
          <p>No recent status updates.</p>
        </div>`;
      return;
    }

    for (const record of records) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "status-story";

      const ring = document.createElement("span");
      ring.className = "status-story-ring";

      const avatar = document.createElement("span");
      avatar.className = "avatar-placeholder";
      avatar.textContent = "K";

      ring.append(avatar);

      const name = document.createElement("span");
      name.className = "status-story-name";
      name.textContent = record.caption?.slice(0, 25) || "Status";

      button.append(ring, name);

      button.addEventListener("click", () => {
        activeStatusIndex = records.indexOf(record);
        openStatusViewer();
      });

      target.append(button);
    }
  }

  async function openStatusViewer() {
    const record = activeStatusList[activeStatusIndex];
    if (!record) return;

    setText("statusViewerCaption", record.caption || "");

    const mediaTarget = $("statusViewerMedia");
    mediaTarget?.replaceChildren();

    if (record.media_path) {
      const url = await signedMediaUrl(record.media_path);

      if (url && mediaTarget) {
        const media = record.media_type?.startsWith("video/")
          ? document.createElement("video")
          : document.createElement("img");

        media.src = url;
        media.controls = media.tagName === "VIDEO";
        media.alt = "Status media";

        mediaTarget.append(media);
      }
    }

    setText("statusViewerAuthor", "KINGZEE CONNECT member");
    navigate("statusViewerPage");
  }

  function bindStatus() {
    $("statusForm")?.addEventListener("submit", (event) =>
      publishStatus(event).catch(handleError)
    );

    $("closeStatusViewer")?.addEventListener("click", () =>
      navigate("statusPage")
    );

    $("statusNextBtn")?.addEventListener("click", async () => {
      if (!activeStatusList.length) return;

      activeStatusIndex =
        (activeStatusIndex + 1) % activeStatusList.length;

      await openStatusViewer();
    });

    $("statusPreviousBtn")?.addEventListener("click", async () => {
      if (!activeStatusList.length) return;

      activeStatusIndex =
        (activeStatusIndex - 1 + activeStatusList.length) %
        activeStatusList.length;

      await openStatusViewer();
    });

    $("statusReplyBtn")?.addEventListener("click", async () => {
      const record = activeStatusList[activeStatusIndex];

      if (!record || record.user_id === currentUser?.id) {
        showToast("You cannot reply to your own status.", "warning");
        return;
      }

      await openConversation(record.user_id);
    });

    $("refreshStatusBtn")?.addEventListener("click", () =>
      loadStatuses().catch(handleError)
    );
  }

  /* ==========================================================
     14. DISCOVER POSTS
  ========================================================== */

  async function publishDiscoverPost(event) {
    event.preventDefault();

    if (!requireUser()) return;

    const caption = $("discoverCaption")?.value.trim() || "";
    const file = getFileFromForm("discoverForm", "media");

    if (!caption && !file) {
      showToast("Add a caption or media before publishing.", "warning");
      return;
    }

    if (file) {
      const category = file.type.startsWith("video/")
        ? "video"
        : "image";

      const validation = validateFile(file, category);

      if (!validation.ok) {
        showToast(validation.message, "error");
        return;
      }
    }

    const mediaPath = file
      ? await uploadFile(file, "discover")
      : null;

    await dbInsert(CONFIG.TABLES.discover, {
      user_id: currentUser.id,
      caption: caption || null,
      media_path: mediaPath,
      media_type: file?.type || null,
      created_at: new Date().toISOString()
    });

    $("discoverForm").reset();
    $("discoverMediaPreview")?.replaceChildren();

    showToast("Discover post published.", "success");
    await loadDiscoverFeed();
  }

  async function loadDiscoverFeed() {
    if (!currentUser) return;

    const target = $("discoverFeed");
    if (!target) return;

    target.replaceChildren();

    const followsResult = await supabase
      .from(CONFIG.TABLES.follows)
      .select("following_id")
      .eq("follower_id", currentUser.id);

    if (followsResult.error) {
      console.error(followsResult.error);
      target.textContent = "Unable to load followed accounts.";
      return;
    }

    const followedIds = (followsResult.data || []).map(
      (item) => item.following_id
    );

    followedIds.push(currentUser.id);

    const result = await supabase
      .from(CONFIG.TABLES.discover)
      .select("*")
      .in("user_id", followedIds)
      .order("created_at", { ascending: false })
      .limit(100);

    if (result.error) {
      console.error("Discover loading:", result.error);
      target.textContent = "Unable to load discover posts.";
      return;
    }

    if (!result.data?.length) {
      target.innerHTML = `
        <div class="empty-state">
          <span>△</span>
          <p>Follow people to see their discover posts here.</p>
        </div>`;
      return;
    }

    for (const post of result.data) {
      const card = document.createElement("article");
      card.className = "discover-card";

      const header = document.createElement("div");
      header.className = "discover-card-header";

      const avatar = document.createElement("span");
      avatar.className = "discover-avatar";
      avatar.textContent = "K";

      const author = document.createElement("div");
      author.className = "discover-author";

      const name = document.createElement("strong");
      name.textContent = "KINGZEE CONNECT member";

      const time = document.createElement("small");
      time.textContent = timeAgo(post.created_at);

      author.append(name, time);
      header.append(avatar, author);

      const content = document.createElement("div");
      content.className = "discover-post-content";

      const caption = document.createElement("p");
      caption.textContent = post.caption || "";

      content.append(caption);

      if (post.media_path) {
        const url = await signedMediaUrl(post.media_path);

        if (url) {
          const mediaWrap = document.createElement("div");
          mediaWrap.className = "discover-post-media";

          const media = post.media_type?.startsWith("video/")
            ? document.createElement("video")
            : document.createElement("img");

          media.src = url;
          media.controls = media.tagName === "VIDEO";
          media.alt = "Discover post media";

          mediaWrap.append(media);
          card.append(header, mediaWrap, content);
        } else {
          card.append(header, content);
        }
      } else {
        card.append(header, content);
      }

      const actions = document.createElement("div");
      actions.className = "discover-post-actions";

      const message = document.createElement("button");
      message.type = "button";
      message.className = "btn btn-secondary";
      message.textContent = "Message";
      message.addEventListener("click", () =>
        openConversation(post.user_id)
      );

      actions.append(message);
      content.append(actions);
      target.append(card);
    }
  }

  function bindDiscover() {
    $("discoverForm")?.addEventListener("submit", (event) =>
      publishDiscoverPost(event).catch(handleError)
    );
  }

  /* ==========================================================
     15. FOLLOWS
  ========================================================== */

  async function followUser(userId) {
    if (!requireUser()) return;

    if (!userId || userId === currentUser.id) {
      showToast("You cannot follow yourself.", "warning");
      return;
    }

    const existing = await supabase
      .from(CONFIG.TABLES.follows)
      .select("id")
      .eq("follower_id", currentUser.id)
      .eq("following_id", userId)
      .maybeSingle();

    if (existing.error) throw existing.error;

    if (existing.data) {
      showToast("You already follow this user.", "info");
      return;
    }

    const result = await supabase
      .from(CONFIG.TABLES.follows)
      .insert({
        follower_id: currentUser.id,
        following_id: userId,
        created_at: new Date().toISOString()
      });

    if (result.error) throw result.error;

    showToast("You are now following this user.", "success");
    await loadFollows("following");
  }

  async function loadFollows(mode = "following") {
    if (!currentUser) return;

    const target = $("followPeopleList");
    if (!target) return;

    target.replaceChildren();

    let result;

    if (mode === "followers") {
      result = await supabase
        .from(CONFIG.TABLES.follows)
        .select("*")
        .eq("following_id", currentUser.id);
    } else if (mode === "suggested") {
      result = await supabase
        .from(CONFIG.TABLES.applications)
        .select("*")
        .eq("status", "approved")
        .neq("user_id", currentUser.id)
        .limit(50);
    } else {
      result = await supabase
        .from(CONFIG.TABLES.follows)
        .select("*")
        .eq("follower_id", currentUser.id);
    }

    if (result.error) {
      console.error("Follow list:", result.error);
      target.textContent = "Unable to load connections.";
      return;
    }

    const records = result.data || [];

    if (!records.length) {
      target.innerHTML = `
        <div class="empty-state">
          <span>👥</span>
          <p>No connections to display yet.</p>
        </div>`;
      return;
    }

    for (const record of records) {
      const userId = mode === "followers"
        ? record.follower_id
        : mode === "suggested"
          ? record.user_id
          : record.following_id;

      const card = document.createElement("article");
      card.className = "profile-card";

      const body = document.createElement("div");
      body.className = "profile-card-body";

      const heading = document.createElement("h3");
      heading.textContent = mode === "suggested"
        ? (
            record.data?.full_name ||
            record.data?.company_name ||
            record.data?.store_name ||
            "KINGZEE CONNECT profile"
          )
        : "KINGZEE CONNECT member";

      const description = document.createElement("p");
      description.textContent = mode === "suggested"
        ? record.data?.description || record.type || "Approved profile"
        : "Community connection";

      body.append(heading, description);

      const actions = document.createElement("div");
      actions.className = "profile-actions";

      const message = document.createElement("button");
      message.className = "btn btn-secondary";
      message.textContent = "Message";
      message.addEventListener("click", () => openConversation(userId));

      actions.append(message);

      if (mode !== "following") {
        const follow = document.createElement("button");
        follow.className = "btn btn-outline";
        follow.textContent = "Follow";
        follow.addEventListener("click", () => followUser(userId));
        actions.append(follow);
      }

      card.append(body, actions);
      target.append(card);
    }

    if (mode === "following") {
      setText("followingCount", records.length);
    } else if (mode === "followers") {
      setText("followersCount", records.length);
    }
  }

  function bindFollows() {
    $$("[data-follow-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        $$("[data-follow-tab]").forEach((item) => {
          item.classList.toggle("active-tab", item === button);
          item.setAttribute(
            "aria-selected",
            String(item === button)
          );
        });

        loadFollows(button.dataset.followTab).catch(handleError);
      });
    });
  }

  /* ==========================================================
     16. KINGZEE TRADE
  ========================================================== */

  async function loadTradeStores() {
    if (!currentUser) return;

    const target = $("tradeStoreResults");
    if (!target) return;

    target.replaceChildren();

    const result = await supabase
      .from(CONFIG.TABLES.applications)
      .select("*")
      .eq("type", "store")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(100);

    if (result.error) {
      console.error("Store loading:", result.error);
      target.textContent = "Unable to load stores.";
      return;
    }

    if (!result.data?.length) {
      target.innerHTML = `
        <div class="empty-state">
          <span>🏪</span>
          <p>Approved stores will appear here.</p>
        </div>`;
      return;
    }

    for (const record of result.data) {
      target.append(await createPublicProfileCard(record));
    }
  }

  function bindTrade() {
    $$("[data-trade-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const selected = button.dataset.tradeTab;

        $$("[data-trade-tab]").forEach((item) => {
          item.classList.toggle("active-tab", item === button);
          item.setAttribute("aria-selected", String(item === button));
        });

        setVisible("tradeStoresPanel", selected === "stores");
        setVisible("tradeImportExportPanel", selected === "import-export");
        setVisible("tradeMyStorePanel", selected === "my-store");

        if (selected === "stores") loadTradeStores().catch(handleError);
        if (selected === "import-export") loadTradeListings().catch(handleError);
        if (selected === "my-store") loadMyStore().catch(handleError);
      });
    });

    $("storeSearchForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      await loadTradeStores();
    });

    $("tradeListingForm")?.addEventListener("submit", (event) =>
      submitTradeListing(event).catch(handleError)
    );
  }

  async function loadTradeListings() {
    const target = $("tradeImportExportListings");
    if (!target || !currentUser) return;

    target.replaceChildren();

    const result = await supabase
      .from(CONFIG.TABLES.trade)
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(100);

    if (result.error) {
      console.error(result.error);
      target.textContent = "Unable to load trade listings.";
      return;
    }

    for (const listing of result.data || []) {
      const card = document.createElement("article");
      card.className = "application-card";

      const title = document.createElement("h3");
      title.textContent = listing.title || "Trade listing";

      const description = document.createElement("p");
      description.textContent = listing.description || "";

      const price = document.createElement("p");
      price.textContent = listing.price == null
        ? "Price on request"
        : formatMoney(listing.price);

      const message = document.createElement("button");
      message.type = "button";
      message.className = "btn btn-primary";
      message.textContent = "Contact seller";
      message.addEventListener("click", () =>
        openConversation(listing.user_id)
      );

      card.append(title, description, price, message);
      target.append(card);
    }
  }

  async function submitTradeListing(event) {
    event.preventDefault();

    if (!requireUser()) return;

    const form = $("tradeListingForm");
    if (!form.reportValidity()) return;

    const values = getFormObject(form);
    const files = getFilesFromForm("tradeListingForm", "images");
    const imagePaths = [];

    for (const file of files) {
      const validation = validateFile(file, "image");

      if (!validation.ok) {
        showToast(validation.message, "error");
        return;
      }

      imagePaths.push(await uploadFile(file, "trade"));
    }

    await dbInsert(CONFIG.TABLES.trade, {
      user_id: currentUser.id,
      listing_type: values.listingType,
      title: values.title,
      category: values.category,
      description: values.description,
      quantity: values.quantity || null,
      price: values.price ? Number(values.price) : null,
      origin: values.origin,
      destination: values.destination || null,
      contact: values.contact,
      image_paths: imagePaths,
      status: "pending",
      created_at: new Date().toISOString()
    });

    form.reset();
    $("tradeListingImagesPreview")?.replaceChildren();

    showToast("Trade listing submitted for review.", "success");
    navigate("kingzeeTradePage");
  }

  async function loadMyStore() {
    const target = $("myStoreSummary");
    if (!target || !currentUser) return;

    const result = await supabase
      .from(CONFIG.TABLES.applications)
      .select("*")
      .eq("user_id", currentUser.id)
      .eq("type", "store")
      .order("created_at", { ascending: false });

    if (result.error) throw result.error;

    target.replaceChildren();

    if (!result.data?.length) {
      target.textContent = "You have not registered a store yet.";
      return;
    }

    for (const record of result.data) {
      target.append(createApplicationCard(record));
    }
  }

  /* ==========================================================
     17. KINGZEE RIDE
  ========================================================== */

  async function bindRideForms() {
    await withFormSubmission($("rideDriverRegistrationForm"), async () => {
      if (!requireUser()) return;

      const form = $("rideDriverRegistrationForm");
      const values = getFormObject(form);

      const license = getFileFromForm("rideDriverRegistrationForm", "license");
      const vehiclePhoto = getFileFromForm("rideDriverRegistrationForm", "vehiclePhoto");
      const identity = getFileFromForm("rideDriverRegistrationForm", "identityProof");

      if (!license || !vehiclePhoto || !identity) {
        showToast("Upload all required driver documents.", "error");
        return;
      }

      const licenseValidation = validateFile(license, "document");
      const vehicleValidation = validateFile(vehiclePhoto, "image");
      const identityValidation = validateFile(identity, "document");

      if (!licenseValidation.ok ||
          !vehicleValidation.ok ||
          !identityValidation.ok) {
        showToast(
          licenseValidation.message ||
          vehicleValidation.message ||
          identityValidation.message,
          "error"
        );
        return;
      }

      const licensePath = await uploadFile(license, "ride/driver-documents");
      const vehiclePath = await uploadFile(vehiclePhoto, "ride/vehicles");
      const identityPath = await uploadFile(identity, "ride/identity");

      await dbInsert(CONFIG.TABLES.drivers, {
        user_id: currentUser.id,
        full_name: values.fullName,
        email: values.email,
        phone: values.phone,
        location: values.location,
        vehicle_type: values.vehicleType,
        vehicle_make: values.vehicleMake,
        plate_number: values.plate,
        license_path: licensePath,
        vehicle_photo_path: vehiclePath,
        identity_path: identityPath,
        status: "pending",
        created_at: new Date().toISOString()
      });

      showToast("Driver registration submitted for review.", "success");
      await loadRideData();
    });

    await withFormSubmission($("rideRequestForm"), async () => {
      if (!requireUser()) return;

      const values = getFormObject($("rideRequestForm"));

      await dbInsert(CONFIG.TABLES.rides, {
        passenger_id: currentUser.id,
        pickup: values.pickup,
        destination: values.destination,
        passengers: Number(values.passengers || 1),
        notes: values.notes || null,
        status: "requested",
        created_at: new Date().toISOString()
      });

      showFormMessage(
        "rideRequestStatus",
        "Ride request submitted. Driver matching must be available in the backend.",
        "success"
      );

      showToast("Ride request submitted.", "success");
    });

    await withFormSubmission($("driverPaymentForm"), async () => {
      if (!requireUser()) return;

      const method = $("driverPaymentMethod")?.value;
      const reference = $("driverPaymentReference")?.value.trim() || "";
      const proof = getFileFromForm("driverPaymentForm", "proof");

      if (!proof) {
        showToast("Upload your payment proof.", "error");
        return;
      }

      const validation = validateFile(proof, "document");
      if (!validation.ok) throw new Error(validation.message);

      const proofPath = await uploadFile(proof, "ride/payment-proofs");

      await dbInsert(CONFIG.TABLES.payments, {
        user_id: currentUser.id,
        method,
        reference: reference || null,
        proof_path: proofPath,
        amount: CONFIG.FEES.driver,
        currency: "GHS",
        purpose: "driver_initial_payment",
        status: "pending",
        created_at: new Date().toISOString()
      });

      showToast("Driver payment proof submitted for review.", "success");
    });

    $("driverGoOnlineBtn")?.addEventListener("click", () => {
      showToast(
        "Online activation requires a server-verified driver account and payment status.",
        "warning"
      );
    });

    $("driverGoOfflineBtn")?.addEventListener("click", () => {
      showToast("Driver availability updates require the ride backend.", "warning");
    });
  }

  async function loadRideData() {
    if (!currentUser) return;

    const result = await supabase
      .from(CONFIG.TABLES.drivers)
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (result.error) {
      console.warn("Driver status lookup:", result.error.message);
      return;
    }

    if (!result.data) {
      setVisible("driverActivationPanel", false);
      return;
    }

    const driver = result.data;

    setVisible("driverActivationPanel", true);
    setText("driverAccountStatus", `Driver status: ${driver.status}`);
    setText("driverOnlineStatus", driver.is_online ? "You are online." : "You are offline.");
    setVisible("driverGoOfflineBtn", !!driver.is_online);

    const approved = driver.status === "approved";
    const onlineButton = $("driverGoOnlineBtn");

    if (onlineButton) {
      onlineButton.disabled = !approved || !driver.payment_verified;
    }

    setVisible("driverPaymentPanel", approved && !driver.payment_verified);
  }

  function bindRideTabs() {
    $$("[data-ride-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const selected = button.dataset.rideTab;

        $$("[data-ride-tab]").forEach((item) => {
          item.classList.toggle("active-tab", item === button);
          item.setAttribute("aria-selected", String(item === button));
        });

        setVisible("ridePassengerPanel", selected === "passenger");
        setVisible("rideDriverPanel", selected === "driver");
        setVisible("rideHistoryPanel", selected === "history");

        if (selected === "history") loadRideHistory().catch(handleError);
      });
    });
  }

  async function loadRideHistory() {
    if (!currentUser) return;

    const target = $("rideTripHistory");
    if (!target) return;

    const result = await supabase
      .from(CONFIG.TABLES.rides)
      .select("*")
      .eq("passenger_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (result.error) throw result.error;

    target.replaceChildren();

    if (!result.data?.length) {
      target.textContent = "No trips recorded yet.";
      return;
    }

    for (const ride of result.data) {
      const card = document.createElement("article");
      card.className = "application-card";

      const title = document.createElement("h3");
      title.textContent = `${ride.pickup} → ${ride.destination}`;

      const status = document.createElement("p");
      status.textContent = `Status: ${ride.status}`;

      const date = document.createElement("p");
      date.textContent = formatDate(ride.created_at);

      card.append(title, status, date);
      target.append(card);
    }
  }

  /* ==========================================================
     18. ECOSYSTEM SERVICES
  ========================================================== */

  const ecosystemServices = {
    esim: {
      title: "eSIM",
      heading: "KINGZEE eSIM",
      description: "Digital SIM services and connectivity options."
    },
    international: {
      title: "International Service",
      heading: "International connections",
      description: "Cross-border service discovery and international business support."
    },
    game: {
      title: "KINGZEE GAME",
      heading: "KINGZEE GAME",
      description: "Gaming services and community features."
    },
    loan: {
      title: "KINGZEE LOAN",
      heading: "KINGZEE LOAN",
      description: "Financial services, subject to eligibility, compliance and partner integration."
    },
    "service-pay": {
      title: "SERVICE PAY",
      heading: "SERVICE PAY",
      description: "Payment and service settlement features."
    },
    data: {
      title: "BUY DATA",
      heading: "Buy mobile data",
      description: "Mobile data bundles and network services."
    }
  };

  function setEcosystemService(key) {
    const service = ecosystemServices[key];

    if (!service) {
      setText("ecosystemServiceTitle", "KINGZEE ECOSYSTEM");
      setText("ecosystemServiceHeading", "Coming soon");
      setText(
        "ecosystemServiceDescription",
        "This service will be connected when its backend integration is available."
      );
      return;
    }

    setText("ecosystemServiceTitle", service.title);
    setText("ecosystemServiceHeading", service.heading);
    setText("ecosystemServiceDescription", service.description);
  }

  /* ==========================================================
     19. SUPPORT
  ========================================================== */

  async function bindSupport() {
    await withFormSubmission($("supportForm"), async () => {
      if (!requireUser()) return;

      const values = getFormObject($("supportForm"));

      await dbInsert(CONFIG.TABLES.support, {
        user_id: currentUser.id,
        subject: values.subject,
        category: values.category,
        message: values.message,
        status: "open",
        created_at: new Date().toISOString()
      });

      $("supportForm").reset();

      showFormMessage(
        "supportFormMessage",
        "Your support request has been submitted.",
        "success"
      );
    });
  }

  /* ==========================================================
     20. OWNER DASHBOARD AND APPLICATION REVIEW
  ========================================================== */

  async function loadOwnerDashboard() {
    if (!requireOwner()) return;

    const result = await supabase
      .from(CONFIG.TABLES.applications)
      .select("id,status,payment_status");

    if (result.error) {
      console.error("Owner dashboard:", result.error);
      showToast("Unable to load owner records.", "error");
      return;
    }

    const records = result.data || [];

    setText("ownerTotalApplications", records.length);
    setText(
      "ownerPendingApplications",
      records.filter((item) => item.status === "pending").length
    );
    setText(
      "ownerPendingPayments",
      records.filter((item) => item.payment_status === "pending").length
    );
    setText(
      "ownerApprovedProfiles",
      records.filter((item) => item.status === "approved").length
    );

    await loadOwnerPending();
  }

  async function loadOwnerPending() {
    if (!requireOwner()) return;

    const target = $("ownerPendingList");
    if (!target) return;

    target.replaceChildren();

    const type = $("ownerApplicationType")?.value || "all";
    const query = $("ownerApplicationSearch")?.value.trim().toLowerCase() || "";

    let request = supabase
      .from(CONFIG.TABLES.applications)
      .select("*")
      .in("status", ["pending", "changes_requested", "draft"])
      .order("created_at", { ascending: false })
      .limit(200);

    if (type !== "all") request = request.eq("type", type);

    const result = await request;

    if (result.error) {
      console.error("Owner pending list:", result.error);
      target.textContent = "Unable to load the pending queue.";
      return;
    }

    let records = result.data || [];

    if (query) {
      records = records.filter((record) =>
        JSON.stringify(record.data || {}).toLowerCase().includes(query) ||
        String(record.id).toLowerCase().includes(query)
      );
    }

    if (!records.length) {
      target.innerHTML = `
        <div class="empty-state">
          <span>✓</span>
          <p>No matching pending applications.</p>
        </div>`;
      return;
    }

    for (const record of records) {
      const card = createApplicationCard(record);

      card.classList.add("owner-application-card");

      const reviewButton = document.createElement("button");
      reviewButton.type = "button";
      reviewButton.className = "btn btn-primary";
      reviewButton.textContent = "Review";
      reviewButton.dataset.ownerReview = record.id;

      const actions = card.querySelector(".application-card-actions");

      if (actions) actions.replaceChildren(reviewButton);

      target.append(card);
    }
  }

  async function loadOwnerPayments() {
    if (!requireOwner()) return;

    const target = $("ownerPaymentsList");
    if (!target) return;

    target.replaceChildren();

    const result = await supabase
      .from(CONFIG.TABLES.payments)
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (result.error) {
      console.error("Owner payments:", result.error);
      target.textContent = "Unable to load payments.";
      return;
    }

    for (const payment of result.data || []) {
      const card = document.createElement("article");
      card.className = "owner-application-card";

      const heading = document.createElement("h3");
      heading.textContent = `Payment ${payment.id}`;

      const amount = document.createElement("p");
      amount.textContent = `Amount: ${formatMoney(payment.amount)}`;

      const method = document.createElement("p");
      method.textContent = `Method: ${payment.method}`;

      const reference = document.createElement("p");
      reference.textContent = `Reference: ${payment.reference || "Not supplied"}`;

      const verify = document.createElement("button");
      verify.type = "button";
      verify.className = "btn btn-primary";
      verify.textContent = "Verify payment";
      verify.dataset.verifyPayment = payment.id;

      card.append(heading, amount, method, reference, verify);
      target.append(card);
    }
  }

  async function loadOwnerApproved() {
    if (!requireOwner()) return;

    const target = $("ownerApprovedList");
    if (!target) return;

    target.replaceChildren();

    const result = await supabase
      .from(CONFIG.TABLES.applications)
      .select("*")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(200);

    if (result.error) throw result.error;

    for (const record of result.data || []) {
      const card = createApplicationCard(record);

      const actions = card.querySelector(".application-card-actions");

      if (actions) {
        const review = document.createElement("button");
        review.type = "button";
        review.className = "btn btn-secondary";
        review.textContent = "View";
        review.dataset.ownerReview = record.id;
        actions.replaceChildren(review);
      }

      target.append(card);
    }
  }

  async function openOwnerReview(id) {
    if (!requireOwner()) return;

    const result = await supabase
      .from(CONFIG.TABLES.applications)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (result.error || !result.data) {
      showToast("Application could not be found.", "error");
      return;
    }

    activeApplication = result.data;

    const target = $("ownerReviewContent");
    target.replaceChildren();

    const record = result.data;
    const data = record.data || {};

    const heading = document.createElement("h2");
    heading.textContent =
      data.full_name ||
      data.company_name ||
      data.store_name ||
      "Application review";

    target.append(heading);

    for (const [key, value] of Object.entries(data)) {
      if (!value) continue;

      const row = document.createElement("p");
      row.textContent = `${key.replace(/_/g, " ")}: ${value}`;
      target.append(row);
    }

    if (record.logo_path) {
      const url = await signedMediaUrl(record.logo_path);

      if (url) {
        const image = document.createElement("img");
        image.src = url;
        image.alt = "Submitted logo";
        target.append(image);
      }
    }

    if (record.video_path) {
      const url = await signedMediaUrl(record.video_path);

      if (url) {
        const video = document.createElement("video");
        video.src = url;
        video.controls = true;
        video.preload = "metadata";
        target.append(video);
      }
    }

    for (const path of record.image_paths || []) {
      const url = await signedMediaUrl(path);
      if (!url) continue;

      const image = document.createElement("img");
      image.src = url;
      image.alt = "Submitted application image";
      target.append(image);
    }

    setText("ownerDecisionNote", "");
    setVisible("ownerReviewActions", true);

    navigate("ownerReviewPage");
  }

  async function reviewApplication(decision) {
    if (!requireOwner() || !activeApplication) return;

    const note = $("ownerDecisionNote")?.value.trim() || "";

    const validDecisions = ["approved", "rejected", "changes_requested"];

    if (!validDecisions.includes(decision)) {
      showToast("Invalid review decision.", "error");
      return;
    }

    // All privileged decisions must be enforced server-side.
    // Do not replace this with a direct browser-side status update.
    const result = await supabase.rpc("owner_review_application", {
      p_application_id: activeApplication.id,
      p_decision: decision,
      p_note: note
    });

    if (result.error) {
      console.error("Owner review RPC:", result.error);

      showToast(
        "Owner review could not be completed. Check the secure database function and permissions.",
        "error"
      );

      return;
    }

    showToast(`Application ${decision.replace(/_/g, " ")}.`, "success");
    navigate("ownerDashboardPage");
    await loadOwnerDashboard();
  }

  async function verifyPayment(paymentId) {
    if (!requireOwner()) return;

    const result = await supabase.rpc("owner_verify_payment", {
      p_payment_id: paymentId
    });

    if (result.error) {
      console.error("Payment verification:", result.error);
      showToast(
        "Payment verification failed. Check the secure backend function.",
        "error"
      );
      return;
    }

    showToast("Payment verification processed.", "success");
    await loadOwnerPayments();
    await loadOwnerDashboard();
  }

  function bindOwnerDashboard() {
    $("ownerLoginForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
    });

    $("ownerApplicationFilters")?.addEventListener("submit", (event) => {
      event.preventDefault();
      loadOwnerPending().catch(handleError);
    });

    $("ownerUsersSearchForm")?.addEventListener("submit", (event) => {
      event.preventDefault();

      showToast(
        "User search requires a server-authorized user-management function.",
        "warning"
      );
    });

    $$("[data-owner-tab]").forEach((button) => {
      button.addEventListener("click", async () => {
        const selected = button.dataset.ownerTab;

        $$("[data-owner-tab]").forEach((item) => {
          item.classList.toggle("active-tab", item === button);
          item.setAttribute("aria-selected", String(item === button));
        });

        setVisible("ownerPendingPanel", selected === "pending");
        setVisible("ownerPaymentsPanel", selected === "payments");
        setVisible("ownerApprovedPanel", selected === "approved");
        setVisible("ownerUsersPanel", selected === "users");
        setVisible("ownerContentPanel", selected === "content");
        setVisible("ownerSupportPanel", selected === "support");

        if (selected === "pending") await loadOwnerPending();
        if (selected === "payments") await loadOwnerPayments();
        if (selected === "approved") await loadOwnerApproved();
        if (selected === "support") await loadOwnerSupport();
      });
    });

    document.addEventListener("click", async (event) => {
      const reviewButton = event.target.closest("[data-owner-review]");

      if (reviewButton) {
        await openOwnerReview(reviewButton.dataset.ownerReview);
        return;
      }

      const verifyButton = event.target.closest("[data-verify-payment]");

      if (verifyButton) {
        await verifyPayment(verifyButton.dataset.verifyPayment);
      }
    });

    $("ownerApproveBtn")?.addEventListener("click", () =>
      reviewApplication("approved").catch(handleError)
    );

    $("ownerRejectBtn")?.addEventListener("click", () =>
      reviewApplication("rejected").catch(handleError)
    );

    $("ownerRequestChangesBtn")?.addEventListener("click", () =>
      reviewApplication("changes_requested").catch(handleError)
    );
  }

  async function loadOwnerSupport() {
    if (!requireOwner()) return;

    const target = $("ownerSupportList");
    if (!target) return;

    target.replaceChildren();

    const result = await supabase
      .from(CONFIG.TABLES.support)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (result.error) {
      target.textContent = "Unable to load support requests.";
      return;
    }

    for (const record of result.data || []) {
      const card = document.createElement("article");
      card.className = "owner-application-card";

      const title = document.createElement("h3");
      title.textContent = record.subject || "Support request";

      const category = document.createElement("p");
      category.textContent = record.category || "General";

      const message = document.createElement("p");
      message.textContent = record.message || "";

      const status = document.createElement("p");
      status.textContent = `Status: ${record.status || "open"}`;

      card.append(title, category, message, status);
      target.append(card);
    }
  }

  /* ==========================================================
     21. MODALS AND GLOBAL EVENTS
  ========================================================== */

  function bindDialogs() {
    $("confirmDialogCancel")?.addEventListener("click", () => {
      $("confirmDialog")?.close();
    });

    $("confirmDialogAccept")?.addEventListener("click", () => {
      $("confirmDialog")?.close();
    });

    $("closeMediaDialog")?.addEventListener("click", () => {
      $("mediaDialog")?.close();
    });

    $("confirmDialog")?.addEventListener("click", (event) => {
      if (event.target === $("confirmDialog")) {
        $("confirmDialog").close();
      }
    });
  }

  function bindCurrentYear() {
    $$("[data-current-year]").forEach((element) => {
      element.textContent = String(new Date().getFullYear());
    });
  }

  function bindFilePreviews() {
    [
      ["professionalLogo", "professionalLogoPreview"],
      ["professionalVideo", "professionalVideoPreview"],
      ["professionalPaymentProof", "professionalPaymentProofPreview"],
      ["companyLogo", "companyLogoPreview"],
      ["companyImages", "companyImagesPreview"],
      ["companyVideo", "companyVideoPreview"],
      ["companyPaymentProof", "companyPaymentProofPreview"],
      ["storeLogo", "storeLogoPreview"],
      ["storePaymentProof", "storePaymentProofPreview"],
      ["tradeListingImages", "tradeListingImagesPreview"],
      ["statusMedia", "statusMediaPreview"],
      ["discoverMedia", "discoverMediaPreview"],
      ["driverVehiclePhoto", "driverVehiclePhotoPreview"],
      ["profilePhoto", "profilePhotoPreview"]
    ].forEach(([inputId, previewId]) => {
      filePreview(inputId, previewId);
    });
  }

  function removeRealtimeChannels() {
    if (!supabase) return;

    if (chatChannel) {
      supabase.removeChannel(chatChannel);
      chatChannel = null;
    }

    for (const channel of activeRealtimeChannels) {
      supabase.removeChannel(channel);
    }

    activeRealtimeChannels = [];
  }

  function handleError(error) {
    console.error("KINGZEE CONNECT:", error);

    const message = error?.message || "An unexpected error occurred.";

    if (/relation .* does not exist|schema cache/i.test(message)) {
      showToast(
        "The required Supabase database table is not configured yet.",
        "error"
      );
      return;
    }

    if (/row-level security|permission denied|not authorized/i.test(message)) {
      showToast(
        "The backend denied this action. Check the account permissions and security policies.",
        "error"
      );
      return;
    }

    showToast(message, "error");
  }

  /* ==========================================================
     22. STARTUP
  ========================================================== */

  async function initializeApp() {
    bindNavigation();
    bindPasswordVisibility();
    bindDialogs();
    bindCurrentYear();
    bindFilePreviews();

    bindApplicationList();
    bindSearch();
    bindMessages();
    bindStatus();
    bindDiscover();
    bindFollows();
    bindTrade();
    bindRideTabs();
    bindOwnerDashboard();

    $("professionalPreviewBtn")?.addEventListener("click", () => {});
    $("companyPreviewBtn")?.addEventListener("click", () => {});
    $("storePreviewBtn")?.addEventListener("click", () => {});

    if (!initializeSupabase()) {
      navigate("welcomePage", { replace: true });
      return;
    }

    try {
      const sessionResult = await supabase.auth.getSession();

      if (sessionResult.error) throw sessionResult.error;

      if (sessionResult.data.session?.user) {
        currentUser = sessionResult.data.session.user;
        await fetchCurrentProfile();
      }

      await bindAuthentication();
      await bindOwnerLogin();
      await bindRegistrationForms();
      await bindProfileForm();
      await bindRideForms();
      await bindSupport();

      if (currentUser) {
        authReady = true;
        navigate("dashboardPage", { replace: true });
      } else {
        navigate("welcomePage", { replace: true });
      }

      console.info("KINGZEE CONNECT frontend initialized.");
    } catch (error) {
      console.error("Startup error:", error);
      navigate("welcomePage", { replace: true });
      showToast(
        "The website opened, but the backend session could not be initialized.",
        "error"
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initializeApp().catch(handleError);
    }, { once: true });
  } else {
    initializeApp().catch(handleError);
  }

})();
