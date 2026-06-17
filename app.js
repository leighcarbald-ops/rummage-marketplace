const config = window.RUMMAGE_SUPABASE || {};
const AGREEMENT_KEY = "rummage-marketplace-agreement-v1";
const SELLER_RULES_KEY = "rummage-marketplace-seller-rules-v1";
const authRedirectParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const authRedirectMessage = authRedirectParams
  .get("error_description")
  ?.replace(/\+/g, " ");

if (
  window.location.hash &&
  (authRedirectParams.has("error") ||
    authRedirectParams.has("access_token") ||
    authRedirectParams.has("refresh_token"))
) {
  window.history.replaceState(
    null,
    document.title,
    `${window.location.pathname}${window.location.search}`
  );
}

const isConfigured =
  config.url &&
  config.anonKey &&
  !config.url.includes("YOUR_PROJECT_URL") &&
  !config.anonKey.includes("YOUR_PUBLIC_ANON_KEY");

const supabaseClient = isConfigured
  ? window.supabase.createClient(config.url, config.anonKey)
  : null;

const state = {
  items: [],
  profiles: [],
  session: null,
  profile: null,
  imageFiles: [],
  existingImageUrls: [],
  detailItem: null,
  detailImageIndex: 0,
  authBusy: false,
  loadingItems: false,
};

const elements = {
  tabs: document.querySelectorAll(".tab-button"),
  views: document.querySelectorAll(".view"),
  adminTabButton: document.querySelector("#adminTabButton"),
  setupNotice: document.querySelector("#setupNotice"),
  searchInput: document.querySelector("#searchInput"),
  sortSelect: document.querySelector("#sortSelect"),
  marketGrid: document.querySelector("#marketGrid"),
  marketSummary: document.querySelector("#marketSummary"),
  refreshButton: document.querySelector("#refreshButton"),
  adminRefreshButton: document.querySelector("#adminRefreshButton"),
  adminSummary: document.querySelector("#adminSummary"),
  adminItems: document.querySelector("#adminItems"),
  adminSellers: document.querySelector("#adminSellers"),
  agreementModal: document.querySelector("#agreementModal"),
  siteAgreementCheck: document.querySelector("#siteAgreementCheck"),
  acceptAgreementButton: document.querySelector("#acceptAgreementButton"),
  acceptAndSellerButton: document.querySelector("#acceptAndSellerButton"),
  sellerRulesModal: document.querySelector("#sellerRulesModal"),
  sellerRulesCheck: document.querySelector("#sellerRulesCheck"),
  acceptSellerRulesButton: document.querySelector("#acceptSellerRulesButton"),
  closeSellerRulesButton: document.querySelector("#closeSellerRulesButton"),
  authModal: document.querySelector("#authModal"),
  openAuthButton: document.querySelector("#openAuthButton"),
  closeAuthButton: document.querySelector("#closeAuthButton"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  authStatus: document.querySelector("#authStatus"),
  signInButton: document.querySelector("#signInButton"),
  signUpButton: document.querySelector("#signUpButton"),
  signOutButton: document.querySelector("#signOutButton"),
  form: document.querySelector("#itemForm"),
  sellerName: document.querySelector("#sellerName"),
  cashappUrl: document.querySelector("#cashappUrl"),
  venmoUrl: document.querySelector("#venmoUrl"),
  paypalUrl: document.querySelector("#paypalUrl"),
  itemTitle: document.querySelector("#itemTitle"),
  itemDescription: document.querySelector("#itemDescription"),
  itemPrice: document.querySelector("#itemPrice"),
  shippingCost: document.querySelector("#shippingCost"),
  itemCategory: document.querySelector("#itemCategory"),
  itemImage: document.querySelector("#itemImage"),
  imagePreview: document.querySelector("#imagePreview"),
  editingId: document.querySelector("#editingId"),
  saveButton: document.querySelector("#saveButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  sellerItems: document.querySelector("#sellerItems"),
  sellerSummary: document.querySelector("#sellerSummary"),
  itemTemplate: document.querySelector("#itemCardTemplate"),
  itemModal: document.querySelector("#itemModal"),
  closeItemButton: document.querySelector("#closeItemButton"),
  detailCategory: document.querySelector("#detailCategory"),
  detailTitle: document.querySelector("#detailTitle"),
  detailImage: document.querySelector("#detailImage"),
  prevImageButton: document.querySelector("#prevImageButton"),
  nextImageButton: document.querySelector("#nextImageButton"),
  imageCount: document.querySelector("#imageCount"),
  thumbnailStrip: document.querySelector("#thumbnailStrip"),
  detailPrice: document.querySelector("#detailPrice"),
  detailItemPrice: document.querySelector("#detailItemPrice"),
  detailShipping: document.querySelector("#detailShipping"),
  detailTotal: document.querySelector("#detailTotal"),
  detailDescription: document.querySelector("#detailDescription"),
  detailSeller: document.querySelector("#detailSeller"),
  paymentOptions: document.querySelector("#paymentOptions"),
};

function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0);
}

function numberValue(value) {
  return Number(value) || 0;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function currentUserId() {
  return state.session?.user?.id || "";
}

function isAdmin() {
  return Boolean(state.profile?.is_admin);
}

function isApprovedSeller() {
  return Boolean(state.profile?.seller_approved || state.profile?.is_admin);
}

function createPlaceholder(title) {
  return (
    String(title || "RM")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("") || "RM"
  );
}

function getItemImages(item) {
  if (Array.isArray(item.image_urls) && item.image_urls.length) {
    return item.image_urls.filter(Boolean);
  }
  return item.image_url ? [item.image_url] : [];
}

const paymentMethods = [
  {
    key: "cashapp_url",
    label: "Cash App",
    initials: "CA",
    logo: "assets/cashapp.jpg",
    hosts: ["cash.app"],
    buildUrl: (handle) => `https://cash.app/$${handle.replace(/^\$/, "")}`,
  },
  {
    key: "venmo_url",
    label: "Venmo",
    initials: "V",
    logo: "assets/venmo.png",
    hosts: ["venmo.com"],
    buildUrl: (handle) => `https://venmo.com/${handle.replace(/^@/, "")}`,
  },
  {
    key: "paypal_url",
    label: "PayPal",
    initials: "PP",
    logo: "assets/paypal.png",
    hosts: ["paypal.me", "paypal.com"],
    buildUrl: (handle) => `https://paypal.me/${handle.replace(/^@/, "")}`,
  },
];

function hostMatches(host, allowedHosts) {
  return allowedHosts.some((allowedHost) => (
    host === allowedHost || host.endsWith(`.${allowedHost}`)
  ));
}

function isAllowedPaymentUrl(value, allowedHosts) {
  if (!value) return true;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return url.protocol === "https:" && hostMatches(host, allowedHosts);
  } catch {
    return false;
  }
}

function cleanPaymentHandle(value) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/^cash\.app\//i, "")
    .replace(/^venmo\.com\//i, "")
    .replace(/^paypal\.me\//i, "")
    .replace(/^paypal\.com\/paypalme\//i, "")
    .replace(/^u\//i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/$/, "");
}

function buildPaymentUrl(value, method) {
  const rawValue = value.trim();
  if (!rawValue) return "";

  if (/^https:\/\//i.test(rawValue)) {
    return rawValue;
  }

  const handle = cleanPaymentHandle(rawValue);
  if (!handle) return "";
  return method.buildUrl(handle);
}

function getPaymentHandle(value) {
  if (!value) return "";
  return cleanPaymentHandle(value);
}

function getPaymentValues() {
  return {
    cashapp_url: buildPaymentUrl(elements.cashappUrl.value, paymentMethods[0]),
    venmo_url: buildPaymentUrl(elements.venmoUrl.value, paymentMethods[1]),
    paypal_url: buildPaymentUrl(elements.paypalUrl.value, paymentMethods[2]),
  };
}

function getItemPaymentOptions(item) {
  return paymentMethods
    .map((method) => ({
      ...method,
      url: item[method.key] || "",
    }))
    .filter((method) => method.url);
}

function applyLogoFallback(image, label) {
  const fallbackText = String(label || "Pay").slice(0, 3);
  const replaceLogo = () => {
    const fallback = document.createElement("span");
    fallback.className = "payment-logo-fallback";
    fallback.textContent = fallbackText;
    image.replaceWith(fallback);
  };

  image.addEventListener("error", replaceLogo, { once: true });

  if (image.complete && image.naturalWidth === 0) {
    replaceLogo();
  }
}

function setupPaymentLogoFallbacks() {
  document.querySelectorAll(".payment-field img").forEach((image) => {
    const label = image.closest(".payment-field")?.querySelector("span")?.textContent;
    applyLogoFallback(image, label);
  });
}

function setBusy(isBusy) {
  [
    elements.signOutButton,
    elements.saveButton,
    elements.refreshButton,
    elements.adminRefreshButton,
  ].forEach((button) => {
    button.disabled = isBusy;
  });
}

function showMessage(message, isError = false) {
  elements.authStatus.textContent = message;
  elements.authStatus.classList.toggle("is-error", isError);
}

function openAuthModal() {
  if (!state.session) {
    showMessage("Sign in or create a seller account to manage your own listings.");
  }
  elements.authModal.hidden = false;
  elements.authEmail.focus();
}

function hasAcceptedSellerRules() {
  return localStorage.getItem(SELLER_RULES_KEY) === "accepted";
}

function openSellerEntry() {
  if (hasAcceptedSellerRules()) {
    openAuthModal();
    return;
  }
  elements.sellerRulesModal.hidden = false;
}

function closeSellerRulesModal() {
  elements.sellerRulesModal.hidden = true;
}

function acceptSellerRules() {
  if (!elements.sellerRulesCheck.checked) return;
  localStorage.setItem(SELLER_RULES_KEY, "accepted");
  closeSellerRulesModal();
  openAuthModal();
}

async function markSellerRulesAccepted() {
  if (!state.session) return;
  await supabaseClient.from("profiles").upsert({
    id: currentUserId(),
    seller_rules_accepted: true,
    updated_at: new Date().toISOString(),
  });
}

function closeAuthModal() {
  elements.authModal.hidden = true;
}

function withTimeout(promise, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), 15000);
    }),
  ]);
}

async function supabaseFetch(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 12000);
  const headers = {
    apikey: config.anonKey,
    Authorization: `Bearer ${state.session?.access_token || config.anonKey}`,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(`${config.url}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      throw new Error(
        data?.error_description ||
        data?.msg ||
        data?.message ||
        data?.error ||
        `Request failed with status ${response.status}.`
      );
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Supabase did not respond. Check your connection and try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function directPasswordSignIn(email, password) {
  const data = await supabaseFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  await supabaseClient.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });

  const { data: sessionData } = await supabaseClient.auth.getSession();
  return sessionData.session;
}

async function directSignUp(email, password) {
  const data = await supabaseFetch("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (data.access_token && data.refresh_token) {
    await supabaseClient.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    const { data: sessionData } = await supabaseClient.auth.getSession();
    return sessionData.session;
  }

  return null;
}

function requireSupabase() {
  if (supabaseClient) return true;
  elements.setupNotice.hidden = false;
  showMessage("Supabase is not configured yet.", true);
  return false;
}

function setImagePreview(srcList) {
  const images = Array.isArray(srcList) ? srcList.filter(Boolean) : [];
  elements.imagePreview.textContent = "";
  if (!images.length) {
    const empty = document.createElement("span");
    empty.textContent = "No images selected";
    elements.imagePreview.append(empty);
    return;
  }

  const previewGrid = document.createElement("div");
  previewGrid.className = "preview-grid";
  images.forEach((src, index) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = `Selected item preview ${index + 1}`;
    previewGrid.append(img);
  });
  elements.imagePreview.append(previewGrid);
}

function renderImage(container, item) {
  container.textContent = "";
  const images = getItemImages(item);
  if (images.length) {
    const img = document.createElement("img");
    img.src = images[0];
    img.alt = item.title;
    container.append(img);
    return;
  }
  container.textContent = createPlaceholder(item.title);
}

function getVisibleItems() {
  const query = normalize(elements.searchInput.value);
  const filtered = state.items.filter((item) => {
    if ((item.status || "active") !== "active") return false;
    const haystack = normalize(
      `${item.title} ${item.description} ${item.seller_name} ${item.category}`
    );
    return haystack.includes(query);
  });

  return filtered.sort((first, second) => {
    if (elements.sortSelect.value === "price-low") {
      return Number(first.price) - Number(second.price);
    }
    if (elements.sortSelect.value === "price-high") {
      return Number(second.price) - Number(first.price);
    }
    if (elements.sortSelect.value === "title") {
      return first.title.localeCompare(second.title);
    }
    return new Date(second.created_at) - new Date(first.created_at);
  });
}

function renderMarketplace() {
  const items = getVisibleItems();
  elements.marketGrid.textContent = "";
  elements.marketSummary.textContent = `${items.length} shared item${items.length === 1 ? "" : "s"} available.`;

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = isConfigured
      ? "No matching items yet."
      : "Connect Supabase to load shared marketplace items.";
    elements.marketGrid.append(empty);
    return;
  }

  items.forEach((item) => {
    const card = elements.itemTemplate.content.firstElementChild.cloneNode(true);
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `View ${item.title}`);
    renderImage(card.querySelector(".item-image"), item);
    card.querySelector(".item-category").textContent = item.category;
    card.querySelector(".item-price").textContent = formatPrice(item.price);
    card.querySelector("h3").textContent = item.title;
    card.querySelector(".item-description").textContent = item.description;
    card.querySelector(".seller-line").textContent = `Sold by ${item.seller_name}`;
    card.addEventListener("click", () => openItemModal(item.id));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openItemModal(item.id);
      }
    });
    elements.marketGrid.append(card);
  });
}

function renderDetailImage() {
  const item = state.detailItem;
  const images = item ? getItemImages(item) : [];
  const currentImage = images[state.detailImageIndex];

  elements.detailImage.textContent = "";
  if (currentImage) {
    const img = document.createElement("img");
    img.src = currentImage;
    img.alt = `${item.title} image ${state.detailImageIndex + 1}`;
    elements.detailImage.append(img);
  } else {
    elements.detailImage.textContent = createPlaceholder(item?.title || "Item");
  }

  const hasMultiple = images.length > 1;
  elements.prevImageButton.hidden = !hasMultiple;
  elements.nextImageButton.hidden = !hasMultiple;
  elements.imageCount.textContent = images.length
    ? `${state.detailImageIndex + 1} of ${images.length}`
    : "No images";

  elements.thumbnailStrip.textContent = "";
  images.forEach((src, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "thumbnail-button";
    button.classList.toggle("is-active", index === state.detailImageIndex);
    button.setAttribute("aria-label", `Show image ${index + 1}`);
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    button.append(img);
    button.addEventListener("click", () => {
      state.detailImageIndex = index;
      renderDetailImage();
    });
    elements.thumbnailStrip.append(button);
  });
}

function openItemModal(itemId) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return;

  state.detailItem = item;
  state.detailImageIndex = 0;
  elements.detailCategory.textContent = item.category;
  elements.detailTitle.textContent = item.title;
  const itemPrice = numberValue(item.price);
  const shippingCost = numberValue(item.shipping_cost);
  const totalCost = itemPrice + shippingCost;
  elements.detailPrice.textContent = formatPrice(totalCost);
  elements.detailItemPrice.textContent = formatPrice(itemPrice);
  elements.detailShipping.textContent = formatPrice(shippingCost);
  elements.detailTotal.textContent = formatPrice(totalCost);
  elements.detailDescription.textContent = item.description;
  elements.detailSeller.textContent = `Sold by ${item.seller_name}`;

  elements.paymentOptions.textContent = "";
  const options = getItemPaymentOptions(item);
  if (options.length) {
    options.forEach((option) => {
      const link = document.createElement("a");
      link.className = "payment-option";
      link.href = option.url;
      link.target = "_blank";
      link.rel = "noopener";

      const logo = document.createElement("img");
      logo.src = option.logo;
      logo.alt = "";
      applyLogoFallback(logo, option.initials);

      const text = document.createElement("span");
      text.textContent = option.label;

      link.append(logo, text);
      elements.paymentOptions.append(link);
    });
  } else {
    const empty = document.createElement("p");
    empty.className = "seller-line";
    empty.textContent = "No seller payment link was provided.";
    elements.paymentOptions.append(empty);
  }

  renderDetailImage();
  elements.itemModal.hidden = false;
}

function closeItemModal() {
  elements.itemModal.hidden = true;
  state.detailItem = null;
  state.detailImageIndex = 0;
}

function hasAcceptedAgreement() {
  return localStorage.getItem(AGREEMENT_KEY) === "accepted";
}

function showAgreementIfNeeded() {
  elements.agreementModal.hidden = hasAcceptedAgreement();
}

function acceptAgreement(openSellerTools = false) {
  if (!elements.siteAgreementCheck.checked) return;
  localStorage.setItem(AGREEMENT_KEY, "accepted");
  elements.agreementModal.hidden = true;

  if (openSellerTools) {
    switchView("seller");
    openSellerEntry();
  }
}

function moveDetailImage(direction) {
  const images = state.detailItem ? getItemImages(state.detailItem) : [];
  if (images.length < 2) return;
  state.detailImageIndex =
    (state.detailImageIndex + direction + images.length) % images.length;
  renderDetailImage();
}

function renderSellerItems() {
  const userId = currentUserId();
  const ownedItems = state.items.filter((item) => item.owner_id === userId);
  const sellerFields = elements.form.querySelectorAll("input, textarea, select, button");

  elements.sellerItems.textContent = "";
  elements.sellerSummary.textContent = userId
    ? `${ownedItems.length} item${ownedItems.length === 1 ? "" : "s"} attached to your login.`
    : "Sign in to manage your listings.";

  if (!userId) {
    sellerFields.forEach((field) => {
      field.disabled = true;
    });
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Seller tools unlock after sign in.";
    elements.sellerItems.append(empty);
    elements.form.classList.add("is-disabled");
    return;
  }

  elements.form.classList.remove("is-disabled");
  sellerFields.forEach((field) => {
    field.disabled = false;
  });

  if (!ownedItems.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No listings for this account yet.";
    elements.sellerItems.append(empty);
    return;
  }

  ownedItems.forEach((item) => {
    const row = document.createElement("article");
    row.className = "seller-row";

    const thumb = document.createElement("div");
    thumb.className = "seller-thumb";
    renderImage(thumb, item);

    const body = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = item.title;

    const meta = document.createElement("p");
    meta.className = "seller-line";
      meta.textContent = `${formatPrice(item.price)} + ${formatPrice(item.shipping_cost)} shipping - ${item.category}`;

    const actions = document.createElement("div");
    actions.className = "seller-actions";

    const editButton = document.createElement("button");
    editButton.className = "text-button";
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => startEdit(item.id));

    const deleteButton = document.createElement("button");
    deleteButton.className = "text-button delete";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteItem(item.id));

    actions.append(editButton, deleteButton);
    body.append(title, meta, actions);
    row.append(thumb, body);
    elements.sellerItems.append(row);
  });
}

function renderAdmin() {
  elements.adminTabButton.hidden = !isAdmin();
  elements.adminItems.textContent = "";
  elements.adminSellers.textContent = "";

  if (!isAdmin()) {
    elements.adminSummary.textContent = "Admin access is not enabled for this account.";
    return;
  }

  const pendingItems = state.items.filter((item) => (item.status || "active") === "pending").length;
  const sellersNeedingApproval = state.profiles.filter(
    (profile) => !profile.seller_approved || !profile.booth_fee_confirmed
  ).length;
  elements.adminSummary.textContent =
    `${pendingItems} post${pendingItems === 1 ? "" : "s"} waiting, ` +
    `${sellersNeedingApproval} seller${sellersNeedingApproval === 1 ? "" : "s"} needing approval.`;

  if (!state.items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No listings found.";
    elements.adminItems.append(empty);
  } else {
    state.items.forEach((item) => {
      const status = item.status || "active";
      const row = document.createElement("article");
      row.className = `admin-row ${status === "pending" ? "needs-attention" : ""}`;
      const title = document.createElement("h3");
      title.textContent = item.title;
      const statusBadge = document.createElement("span");
      statusBadge.className = `status-badge status-${status}`;
      statusBadge.textContent = status === "active" ? "Live" : status;
      const meta = document.createElement("p");
      meta.className = "seller-line";
      meta.textContent = `${formatPrice(item.price)} + ${formatPrice(item.shipping_cost)} shipping - ${item.seller_name}`;
      const actions = document.createElement("div");
      actions.className = "seller-actions";

      [
        [status === "pending" ? "Approve Post" : "Make Live", "active"],
        ["Send Back to Pending", "pending"],
        ["Hide Listing", "hidden"],
        ["Mark Removed", "removed"],
      ].forEach(([label, status]) => {
        const button = document.createElement("button");
        button.className = "text-button";
        button.type = "button";
        button.textContent = label;
        button.disabled = (item.status || "active") === status;
        button.addEventListener("click", () => adminUpdateItemStatus(item.id, status));
        actions.append(button);
      });

      const deleteButton = document.createElement("button");
      deleteButton.className = "text-button delete";
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => adminDeleteItem(item.id));
      actions.append(deleteButton);

      row.append(title, statusBadge, meta, actions);
      elements.adminItems.append(row);
    });
  }

  if (!state.profiles.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No seller profiles found.";
    elements.adminSellers.append(empty);
  } else {
    state.profiles.forEach((profile) => {
      const needsApproval = !profile.seller_approved || !profile.booth_fee_confirmed;
      const row = document.createElement("article");
      row.className = `admin-row ${needsApproval ? "needs-attention" : ""}`;
      const title = document.createElement("h3");
      title.textContent = profile.seller_name || profile.id;
      const statusBadge = document.createElement("span");
      statusBadge.className = `status-badge ${needsApproval ? "status-pending" : "status-active"}`;
      statusBadge.textContent = needsApproval ? "Needs admin approval" : "Approved seller";
      const meta = document.createElement("p");
      meta.className = "seller-line";
      meta.textContent = `${profile.is_admin ? "Admin" : "Seller"} - ${profile.is_suspended ? "Suspended" : "Active"} - ${profile.booth_fee_confirmed ? "Booth fee paid" : "Booth fee not confirmed"}`;
      const actions = document.createElement("div");
      actions.className = "seller-actions";

      const suspendButton = document.createElement("button");
      suspendButton.className = profile.is_suspended ? "text-button" : "text-button delete";
      suspendButton.type = "button";
      suspendButton.textContent = profile.is_suspended ? "Unsuspend" : "Suspend";
      suspendButton.disabled = profile.id === currentUserId();
      suspendButton.addEventListener("click", () => (
        adminUpdateSellerSuspension(profile.id, !profile.is_suspended)
      ));

      const approveButton = document.createElement("button");
      approveButton.className = "text-button";
      approveButton.type = "button";
      approveButton.textContent = profile.seller_approved ? "Remove Seller Approval" : "Approve Seller Only";
      approveButton.addEventListener("click", () => (
        adminUpdateSellerApproval(profile.id, !profile.seller_approved)
      ));

      const boothButton = document.createElement("button");
      boothButton.className = "text-button";
      boothButton.type = "button";
      boothButton.textContent = profile.booth_fee_confirmed
        ? "Unconfirm Fee"
        : "Mark Paid + Approve Posts";
      boothButton.addEventListener("click", () => (
        profile.booth_fee_confirmed
          ? adminUpdateBoothFee(profile.id, false)
          : adminApproveSellerAndPosts(profile.id)
      ));

      actions.append(suspendButton, approveButton, boothButton);
      row.append(title, statusBadge, meta, actions);
      elements.adminSellers.append(row);
    });
  }
}

function renderAuth() {
  const email = state.session?.user?.email;
  const signedIn = Boolean(email);

  elements.openAuthButton.hidden = signedIn;
  elements.signOutButton.hidden = !signedIn;

  if (signedIn) {
    showMessage(`Signed in as ${email}.`);
    closeAuthModal();
  }
}

function renderAll() {
  renderMarketplace();
  renderSellerItems();
  renderAuth();
  renderAdmin();
}

function switchView(viewName) {
  elements.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.view === viewName);
  });
  elements.views.forEach((view) => {
    view.classList.toggle("is-active", view.id === `${viewName}View`);
  });

  if (viewName === "seller" && !state.session) {
    showMessage("Sign in or create a seller account to manage listings.");
    openSellerEntry();
  }

  if (viewName === "admin" && !isAdmin()) {
    switchView("marketplace");
    return;
  }

  if (viewName === "admin") {
    loadAdminData();
  }
}

function resetForm() {
  const sellerName = elements.sellerName.value;
  elements.form.reset();
  elements.sellerName.value = sellerName;
  elements.editingId.value = "";
  elements.saveButton.textContent = "Publish Item";
  elements.cancelEditButton.hidden = true;
  state.imageFiles = [];
  state.existingImageUrls = [];
  setImagePreview([]);
  renderSellerItems();
}

function startEdit(itemId) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item || item.owner_id !== currentUserId()) return;

  elements.editingId.value = item.id;
  elements.sellerName.value = item.seller_name;
  elements.cashappUrl.value = getPaymentHandle(item.cashapp_url);
  elements.venmoUrl.value = getPaymentHandle(item.venmo_url);
  elements.paypalUrl.value = getPaymentHandle(item.paypal_url || item.payment_url);
  elements.itemTitle.value = item.title;
  elements.itemDescription.value = item.description;
  elements.itemPrice.value = item.price;
  elements.shippingCost.value = numberValue(item.shipping_cost);
  elements.itemCategory.value = item.category;
  state.imageFiles = [];
  state.existingImageUrls = getItemImages(item);
  elements.saveButton.textContent = "Save Changes";
  elements.cancelEditButton.hidden = false;
  setImagePreview(state.existingImageUrls);
  switchView("seller");
  elements.itemTitle.focus();
}

async function loadSession() {
  if (!requireSupabase()) return;
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    showMessage(error.message, true);
    return;
  }
  state.session = data.session;
}

async function loadItems() {
  if (!requireSupabase()) {
    renderAll();
    return;
  }

  state.loadingItems = true;
  elements.marketSummary.textContent = "Loading marketplace items...";
  setBusy(true);

  try {
    const data = await supabaseFetch(
      isAdmin()
        ? "/rest/v1/items?select=*&order=created_at.desc"
        : "/rest/v1/items?select=*&status=eq.active&order=created_at.desc",
      { method: "GET" }
    );

    state.items = data || [];
    renderAll();
  } catch (error) {
    elements.marketSummary.textContent = error.message || "Could not load marketplace items.";
    showMessage(elements.marketSummary.textContent, true);
  } finally {
    state.loadingItems = false;
    setBusy(false);
  }
}

async function loadAdminData() {
  if (!isAdmin()) {
    state.profiles = [];
    renderAll();
    return;
  }

  setBusy(true);
  try {
    const [items, profiles] = await Promise.all([
      supabaseFetch("/rest/v1/items?select=*&order=created_at.desc", { method: "GET" }),
      supabaseFetch("/rest/v1/profiles?select=*&order=updated_at.desc", { method: "GET" }),
    ]);
    state.items = items || [];
    state.profiles = profiles || [];
    renderAll();
  } catch (error) {
    elements.adminSummary.textContent = error.message || "Could not load admin data.";
  } finally {
    setBusy(false);
  }
}

async function adminUpdateItemStatus(itemId, status) {
  if (!isAdmin()) return;
  setBusy(true);
  try {
    await supabaseFetch(`/rest/v1/items?id=eq.${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        status,
        updated_at: new Date().toISOString(),
      }),
    });
    await loadAdminData();
  } catch (error) {
    elements.adminSummary.textContent = error.message || "Could not update listing.";
  } finally {
    setBusy(false);
  }
}

async function adminDeleteItem(itemId) {
  if (!isAdmin()) return;
  const confirmed = window.confirm("Permanently delete this listing?");
  if (!confirmed) return;

  setBusy(true);
  try {
    await supabaseFetch(`/rest/v1/items?id=eq.${encodeURIComponent(itemId)}`, {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal",
      },
    });
    await loadAdminData();
  } catch (error) {
    elements.adminSummary.textContent = error.message || "Could not delete listing.";
  } finally {
    setBusy(false);
  }
}

async function adminUpdateSellerSuspension(profileId, isSuspended) {
  if (!isAdmin()) return;
  setBusy(true);
  try {
    await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(profileId)}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        is_suspended: isSuspended,
        updated_at: new Date().toISOString(),
      }),
    });
    await loadAdminData();
  } catch (error) {
    elements.adminSummary.textContent = error.message || "Could not update seller.";
  } finally {
    setBusy(false);
  }
}

async function adminUpdateSellerApproval(profileId, isApproved) {
  if (!isAdmin()) return;
  setBusy(true);
  try {
    await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(profileId)}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        seller_approved: isApproved,
        updated_at: new Date().toISOString(),
      }),
    });
    await loadAdminData();
  } catch (error) {
    elements.adminSummary.textContent = error.message || "Could not update seller approval.";
  } finally {
    setBusy(false);
  }
}

async function adminUpdateBoothFee(profileId, isConfirmed) {
  if (!isAdmin()) return;
  setBusy(true);
  try {
    await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(profileId)}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        booth_fee_confirmed: isConfirmed,
        seller_approved: isConfirmed,
        updated_at: new Date().toISOString(),
      }),
    });
    await loadAdminData();
  } catch (error) {
    elements.adminSummary.textContent = error.message || "Could not update booth fee.";
  } finally {
    setBusy(false);
  }
}

async function adminApproveSellerAndPosts(profileId) {
  if (!isAdmin()) return;
  setBusy(true);
  try {
    const timestamp = new Date().toISOString();
    await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(profileId)}`, {
      method: "PATCH",
      headers: {
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        booth_fee_confirmed: true,
        seller_approved: true,
        updated_at: timestamp,
      }),
    });

    await supabaseFetch(
      `/rest/v1/items?owner_id=eq.${encodeURIComponent(profileId)}&status=eq.pending`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          status: "active",
          updated_at: timestamp,
        }),
      }
    );

    await loadAdminData();
  } catch (error) {
    elements.adminSummary.textContent =
      error.message || "Could not approve seller and pending posts.";
  } finally {
    setBusy(false);
  }
}

async function upsertProfile(sellerName, payments) {
  const userId = currentUserId();
  if (!userId) return;

  await supabaseClient.from("profiles").upsert({
    id: userId,
    seller_name: sellerName,
    cashapp_url: payments.cashapp_url || null,
    venmo_url: payments.venmo_url || null,
    paypal_url: payments.paypal_url || null,
    updated_at: new Date().toISOString(),
  });
}

async function uploadImages(itemId) {
  if (!state.imageFiles.length) return state.existingImageUrls;

  const uploadedUrls = [];

  for (const file of state.imageFiles) {
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
    const path = `${currentUserId()}/${itemId}-${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabaseClient.storage
      .from("listing-images")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabaseClient.storage.from("listing-images").getPublicUrl(path);
    uploadedUrls.push(data.publicUrl);
  }

  return uploadedUrls;
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!requireSupabase()) return;
  if (!state.session) {
    showMessage("Please sign in before publishing an item.", true);
    return;
  }

  setBusy(true);

  try {
    const itemId = elements.editingId.value || crypto.randomUUID();
    const sellerName = elements.sellerName.value.trim();
    const payments = getPaymentValues();
    for (const method of paymentMethods) {
      if (!isAllowedPaymentUrl(payments[method.key], method.hosts)) {
        showMessage(`Use a valid HTTPS ${method.label} link in the ${method.label} field.`, true);
        return;
      }
    }

    const imageUrls = await uploadImages(itemId);
    const payload = {
      id: itemId,
      owner_id: currentUserId(),
      seller_name: sellerName,
      cashapp_url: payments.cashapp_url || null,
      venmo_url: payments.venmo_url || null,
      paypal_url: payments.paypal_url || null,
      payment_url: payments.paypal_url || payments.venmo_url || payments.cashapp_url || null,
      title: elements.itemTitle.value.trim(),
      description: elements.itemDescription.value.trim(),
      price: Number(elements.itemPrice.value),
      shipping_cost: Number(elements.shippingCost.value) || 0,
      category: elements.itemCategory.value,
      image_url: imageUrls[0] || null,
      image_urls: imageUrls,
      updated_at: new Date().toISOString(),
    };

    if (!elements.editingId.value) {
      payload.status = isApprovedSeller() ? "active" : "pending";
    }

    await upsertProfile(sellerName, payments);

    const query = supabaseClient.from("items");
    const { error } = elements.editingId.value
      ? await query.update(payload).eq("id", itemId)
      : await query.insert(payload);

    if (error) throw error;

    resetForm();
    switchView("marketplace");
    await loadItems();
    showMessage("Listing saved.");
  } catch (error) {
    showMessage(error.message || "Could not save the listing.", true);
  } finally {
    setBusy(false);
  }
}

async function deleteItem(itemId) {
  if (!requireSupabase()) return;
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item || item.owner_id !== currentUserId()) return;
  const confirmed = window.confirm(`Delete "${item.title}" from the marketplace?`);
  if (!confirmed) return;

  setBusy(true);
  const { error } = await supabaseClient.from("items").delete().eq("id", itemId);
  setBusy(false);

  if (error) {
    showMessage(error.message, true);
    return;
  }

  await loadItems();
}

function handleImageChange(event) {
  const files = Array.from(event.target.files || []);
  state.imageFiles = files;

  if (!files.length) {
    setImagePreview(state.existingImageUrls);
    return;
  }

  Promise.all(
    files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.addEventListener("load", () => resolve(String(reader.result || "")));
          reader.readAsDataURL(file);
        })
    )
  ).then((previews) => setImagePreview(previews));
}

async function signIn(event) {
  event?.preventDefault();
  if (!requireSupabase()) return;
  if (state.authBusy) return;
  showMessage("Checking login...");

  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;
  if (!email || !password) {
    showMessage("Enter your email and password.", true);
    return;
  }

  state.authBusy = true;
  showMessage("Signing in...");
  elements.signInButton.disabled = true;
  elements.signInButton.textContent = "Signing In...";
  setBusy(true);

  try {
    state.session = await directPasswordSignIn(email, password);
    await loadSellerProfile();
    if (hasAcceptedSellerRules()) {
      await markSellerRulesAccepted();
      await loadSellerProfile();
    }
    await loadItems();
    closeAuthModal();
  } catch (error) {
    showMessage(error.message || "Could not sign in.", true);
  } finally {
    state.authBusy = false;
    elements.signInButton.disabled = false;
    elements.signInButton.textContent = "Sign In";
    setBusy(false);
  }
}

async function signUp() {
  if (!requireSupabase()) return;
  if (state.authBusy) return;
  showMessage("Checking account details...");

  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;
  if (!email || !password) {
    showMessage("Enter an email and password before creating an account.", true);
    return;
  }

  state.authBusy = true;
  showMessage("Creating account...");
  elements.signUpButton.disabled = true;
  elements.signUpButton.textContent = "Creating...";
  setBusy(true);

  try {
    state.session = await directSignUp(email, password);
    if (state.session && hasAcceptedSellerRules()) {
      await markSellerRulesAccepted();
      await loadSellerProfile();
    }
    showMessage(
      state.session
        ? "Account created. You are signed in."
        : "Account created. Check your email to confirm before signing in."
    );
    await loadItems();
    if (state.session) {
      closeAuthModal();
    }
  } catch (error) {
    showMessage(error.message || "Could not create the account.", true);
  } finally {
    state.authBusy = false;
    elements.signUpButton.disabled = false;
    elements.signUpButton.textContent = "Create Account";
    setBusy(false);
  }
}

async function signOut() {
  if (!requireSupabase()) return;
  await supabaseClient.auth.signOut();
  state.session = null;
  state.profile = null;
  state.profiles = [];
  elements.authForm.reset();
  resetForm();
  await loadItems();
  showMessage("Signed out.");
}

async function loadSellerProfile() {
  if (!state.session) {
    state.profile = null;
    return;
  }
  const { data } = await supabaseClient
    .from("profiles")
    .select("id,seller_name,payment_url,cashapp_url,venmo_url,paypal_url,is_admin,is_suspended,seller_approved,booth_fee_confirmed,seller_rules_accepted")
    .eq("id", currentUserId())
    .maybeSingle();

  state.profile = data || null;
  if (data?.seller_name) {
    elements.sellerName.value = data.seller_name;
  }
  elements.cashappUrl.value = getPaymentHandle(data?.cashapp_url);
  elements.venmoUrl.value = getPaymentHandle(data?.venmo_url);
  elements.paypalUrl.value = getPaymentHandle(data?.paypal_url || data?.payment_url);
}

function bindEvents() {
  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  elements.searchInput.addEventListener("input", renderMarketplace);
  elements.sortSelect.addEventListener("change", renderMarketplace);
  elements.refreshButton.addEventListener("click", loadItems);
  elements.adminRefreshButton.addEventListener("click", loadAdminData);
  elements.siteAgreementCheck.addEventListener("change", () => {
    const accepted = elements.siteAgreementCheck.checked;
    elements.acceptAgreementButton.disabled = !accepted;
    elements.acceptAndSellerButton.disabled = !accepted;
  });
  elements.acceptAgreementButton.addEventListener("click", () => acceptAgreement(false));
  elements.acceptAndSellerButton.addEventListener("click", () => acceptAgreement(true));
  elements.sellerRulesCheck.addEventListener("change", () => {
    elements.acceptSellerRulesButton.disabled = !elements.sellerRulesCheck.checked;
  });
  elements.acceptSellerRulesButton.addEventListener("click", acceptSellerRules);
  elements.closeSellerRulesButton.addEventListener("click", closeSellerRulesModal);
  elements.openAuthButton.addEventListener("click", openSellerEntry);
  elements.closeAuthButton.addEventListener("click", closeAuthModal);
  elements.closeItemButton.addEventListener("click", closeItemModal);
  elements.prevImageButton.addEventListener("click", () => moveDetailImage(-1));
  elements.nextImageButton.addEventListener("click", () => moveDetailImage(1));
  elements.itemModal.addEventListener("click", (event) => {
    if (event.target === elements.itemModal) {
      closeItemModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.authModal.hidden) {
      closeAuthModal();
    }
    if (event.key === "Escape" && !elements.sellerRulesModal.hidden) {
      closeSellerRulesModal();
    }
    if (event.key === "Escape" && !elements.itemModal.hidden) {
      closeItemModal();
    }
    if (!elements.itemModal.hidden && event.key === "ArrowLeft") {
      moveDetailImage(-1);
    }
    if (!elements.itemModal.hidden && event.key === "ArrowRight") {
      moveDetailImage(1);
    }
  });
  elements.authForm.addEventListener("submit", signIn);
  elements.signInButton.addEventListener("click", signIn);
  elements.signUpButton.addEventListener("click", signUp);
  elements.signOutButton.addEventListener("click", signOut);
  elements.form.addEventListener("submit", handleSubmit);
  elements.itemImage.addEventListener("change", handleImageChange);
  elements.cancelEditButton.addEventListener("click", resetForm);

  if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      state.session = session;
      await loadSellerProfile();
      renderAll();
    });
  }
}

async function init() {
  elements.setupNotice.hidden = isConfigured;
  setupPaymentLogoFallbacks();
  bindEvents();
  if (authRedirectMessage) {
    elements.marketSummary.textContent =
      "That email confirmation link has expired. The marketplace is still open below.";
  }
  await loadSession();
  await loadSellerProfile();
  await loadItems();
  showAgreementIfNeeded();
}

init();
