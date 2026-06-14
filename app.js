const config = window.RUMMAGE_SUPABASE || {};
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
  imageFile: null,
  existingImageUrl: "",
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

function setBusy(isBusy) {
  [
    elements.signInButton,
    elements.signUpButton,
    elements.signOutButton,
    elements.openAuthButton,
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
  elements.authModal.hidden = false;
  elements.authEmail.focus();
}

function closeAuthModal() {
  elements.authModal.hidden = true;
}

function requireSupabase() {
  if (supabaseClient) return true;
  elements.setupNotice.hidden = false;
  showMessage("Supabase is not configured yet.", true);
  return false;
}

function setImagePreview(src) {
  elements.imagePreview.textContent = "";
  if (!src) {
    const empty = document.createElement("span");
    empty.textContent = "No image selected";
    elements.imagePreview.append(empty);
    return;
  }

  const img = document.createElement("img");
  img.src = src;
  img.alt = "Selected item preview";
  elements.imagePreview.append(img);
}

function renderImage(container, item) {
  container.textContent = "";
  if (item.image_url) {
    const img = document.createElement("img");
    img.src = item.image_url;
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
    renderImage(card.querySelector(".item-image"), item);
    card.querySelector(".item-category").textContent = item.category;
    card.querySelector(".item-price").textContent = formatPrice(item.price);
    card.querySelector("h3").textContent = item.title;
    card.querySelector(".item-description").textContent = item.description;
    card.querySelector(".seller-line").textContent = `Sold by ${item.seller_name}`;
    elements.marketGrid.append(card);
  });
}

function renderSellerItems() {
  const userId = currentUserId();
  const ownedItems = state.items.filter((item) => item.owner_id === userId);

  elements.sellerItems.textContent = "";
  elements.sellerSummary.textContent = userId
    ? `${ownedItems.length} item${ownedItems.length === 1 ? "" : "s"} attached to your login.`
    : "Sign in to manage your listings.";

  if (!userId) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Seller tools unlock after sign in.";
    elements.sellerItems.append(empty);
    elements.form.classList.add("is-disabled");
    return;
  }

  elements.form.classList.remove("is-disabled");

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
  state.imageFile = null;
  state.existingImageUrl = "";
  setImagePreview("");
  renderSellerItems();
}

function startEdit(itemId) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item || item.owner_id !== currentUserId()) return;

  elements.editingId.value = item.id;
  elements.sellerName.value = item.seller_name;
  elements.itemTitle.value = item.title;
  elements.itemDescription.value = item.description;
  elements.itemPrice.value = item.price;
  elements.itemCategory.value = item.category;
  state.imageFile = null;
  state.existingImageUrl = item.image_url || "";
  elements.saveButton.textContent = "Save Changes";
  elements.cancelEditButton.hidden = false;
  setImagePreview(state.existingImageUrl);
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

  setBusy(true);
  const { data, error } = await supabaseClient
    .from("items")
    .select("*")
    .order("created_at", { ascending: false });

  setBusy(false);

  if (error) {
    elements.marketSummary.textContent = error.message;
    return;
  }

  state.items = data || [];
  renderAll();
}

async function upsertProfile(sellerName) {
  const userId = currentUserId();
  if (!userId) return;

  await supabaseClient.from("profiles").upsert({
    id: userId,
    seller_name: sellerName,
    updated_at: new Date().toISOString(),
  });
}

async function uploadImage(itemId) {
  if (!state.imageFile) return state.existingImageUrl;

  const safeName = state.imageFile.name.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
  const path = `${currentUserId()}/${itemId}-${Date.now()}-${safeName}`;
  const { error } = await supabaseClient.storage
    .from("listing-images")
    .upload(path, state.imageFile, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabaseClient.storage.from("listing-images").getPublicUrl(path);
  return data.publicUrl;
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
    const imageUrl = await uploadImage(itemId);
    const payload = {
      id: itemId,
      owner_id: currentUserId(),
      seller_name: sellerName,
      title: elements.itemTitle.value.trim(),
      description: elements.itemDescription.value.trim(),
      price: Number(elements.itemPrice.value),
      category: elements.itemCategory.value,
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    };

    await upsertProfile(sellerName);

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
  const file = event.target.files?.[0];
  state.imageFile = file || null;

  if (!file) {
    setImagePreview(state.existingImageUrl);
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    setImagePreview(String(reader.result || ""));
  });
  reader.readAsDataURL(file);
}

async function signIn(event) {
  event.preventDefault();
  if (!requireSupabase()) return;

  setBusy(true);
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: elements.authEmail.value.trim(),
    password: elements.authPassword.value,
  });
  setBusy(false);

  if (error) {
    showMessage(error.message, true);
    return;
  }

  state.session = data.session;
  await loadSellerProfile();
  await loadItems();
  closeAuthModal();
}

async function signUp() {
  if (!requireSupabase()) return;

  setBusy(true);
  const { data, error } = await supabaseClient.auth.signUp({
    email: elements.authEmail.value.trim(),
    password: elements.authPassword.value,
  });
  setBusy(false);

  if (error) {
    showMessage(error.message, true);
    return;
  }

  state.session = data.session;
  showMessage(
    data.session
      ? "Account created. You are signed in."
      : "Account created. Check your email to confirm before signing in."
  );
  await loadItems();
  if (data.session) {
    closeAuthModal();
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
    .select("seller_name")
    .eq("id", currentUserId())
    .maybeSingle();

  if (data?.seller_name) {
    elements.sellerName.value = data.seller_name;
  }
}

function bindEvents() {
  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  elements.searchInput.addEventListener("input", renderMarketplace);
  elements.sortSelect.addEventListener("change", renderMarketplace);
  elements.refreshButton.addEventListener("click", loadItems);
  elements.openAuthButton.addEventListener("click", openAuthModal);
  elements.closeAuthButton.addEventListener("click", closeAuthModal);
  elements.authModal.addEventListener("click", (event) => {
    if (event.target === elements.authModal) {
      closeAuthModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.authModal.hidden) {
      closeAuthModal();
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
}

init();
