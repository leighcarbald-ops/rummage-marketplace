const config = window.RUMMAGE_SUPABASE || {};
const AGREEMENT_KEY = "rummage-marketplace-agreement-v1";
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
  session: null,
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
  setupNotice: document.querySelector("#setupNotice"),
  searchInput: document.querySelector("#searchInput"),
  sortSelect: document.querySelector("#sortSelect"),
  marketGrid: document.querySelector("#marketGrid"),
  marketSummary: document.querySelector("#marketSummary"),
  refreshButton: document.querySelector("#refreshButton"),
  agreementModal: document.querySelector("#agreementModal"),
  siteAgreementCheck: document.querySelector("#siteAgreementCheck"),
  acceptAgreementButton: document.querySelector("#acceptAgreementButton"),
  acceptAndSellerButton: document.querySelector("#acceptAndSellerButton"),
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

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function currentUserId() {
  return state.session?.user?.id || "";
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
    logo: "assets/cashapp.jpg",
    hosts: ["cash.app"],
  },
  {
    key: "venmo_url",
    label: "Venmo",
    logo: "assets/venmo.png",
    hosts: ["venmo.com"],
  },
  {
    key: "paypal_url",
    label: "PayPal",
    logo: "assets/paypal.png",
    hosts: ["paypal.me", "paypal.com"],
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

function getPaymentValues() {
  return {
    cashapp_url: elements.cashappUrl.value.trim(),
    venmo_url: elements.venmoUrl.value.trim(),
    paypal_url: elements.paypalUrl.value.trim(),
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

function setBusy(isBusy) {
  [
    elements.signInButton,
    elements.signUpButton,
    elements.signOutButton,
    elements.saveButton,
    elements.refreshButton,
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
    Authorization: `Bearer ${config.anonKey}`,
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
  elements.detailPrice.textContent = formatPrice(item.price);
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
    openAuthModal();
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
    meta.textContent = `${formatPrice(item.price)} - ${item.category}`;

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
    openAuthModal();
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
  elements.cashappUrl.value = item.cashapp_url || "";
  elements.venmoUrl.value = item.venmo_url || "";
  elements.paypalUrl.value = item.paypal_url || item.payment_url || "";
  elements.itemTitle.value = item.title;
  elements.itemDescription.value = item.description;
  elements.itemPrice.value = item.price;
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
      "/rest/v1/items?select=*&order=created_at.desc",
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
      category: elements.itemCategory.value,
      image_url: imageUrls[0] || null,
      image_urls: imageUrls,
      updated_at: new Date().toISOString(),
    };

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
  event.preventDefault();
  if (!requireSupabase()) return;
  if (state.authBusy) return;

  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;
  if (!email || !password) {
    showMessage("Enter your email and password.", true);
    return;
  }

  state.authBusy = true;
  showMessage("Signing in...");
  setBusy(true);

  try {
    state.session = await directPasswordSignIn(email, password);
    await loadSellerProfile();
    await loadItems();
    closeAuthModal();
  } catch (error) {
    showMessage(error.message || "Could not sign in.", true);
  } finally {
    state.authBusy = false;
    setBusy(false);
  }
}

async function signUp() {
  if (!requireSupabase()) return;
  if (state.authBusy) return;

  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;
  if (!email || !password) {
    showMessage("Enter an email and password before creating an account.", true);
    return;
  }

  state.authBusy = true;
  showMessage("Creating account...");
  setBusy(true);

  try {
    state.session = await directSignUp(email, password);
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
    setBusy(false);
  }
}

async function signOut() {
  if (!requireSupabase()) return;
  await supabaseClient.auth.signOut();
  state.session = null;
  elements.authForm.reset();
  resetForm();
  await loadItems();
  showMessage("Signed out.");
}

async function loadSellerProfile() {
  if (!state.session) return;
  const { data } = await supabaseClient
    .from("profiles")
    .select("seller_name,payment_url,cashapp_url,venmo_url,paypal_url")
    .eq("id", currentUserId())
    .maybeSingle();

  if (data?.seller_name) {
    elements.sellerName.value = data.seller_name;
  }
  elements.cashappUrl.value = data?.cashapp_url || "";
  elements.venmoUrl.value = data?.venmo_url || "";
  elements.paypalUrl.value = data?.paypal_url || data?.payment_url || "";
}

function bindEvents() {
  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  elements.searchInput.addEventListener("input", renderMarketplace);
  elements.sortSelect.addEventListener("change", renderMarketplace);
  elements.refreshButton.addEventListener("click", loadItems);
  elements.siteAgreementCheck.addEventListener("change", () => {
    const accepted = elements.siteAgreementCheck.checked;
    elements.acceptAgreementButton.disabled = !accepted;
    elements.acceptAndSellerButton.disabled = !accepted;
  });
  elements.acceptAgreementButton.addEventListener("click", () => acceptAgreement(false));
  elements.acceptAndSellerButton.addEventListener("click", () => acceptAgreement(true));
  elements.openAuthButton.addEventListener("click", openAuthModal);
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
  bindEvents();
  await loadSession();
  await loadSellerProfile();
  await loadItems();
  showAgreementIfNeeded();
}

init();
