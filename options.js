const STORAGE_KEY = "siteLimits";

const limitsList = document.getElementById("limits-list");
const addButton = document.getElementById("add-limit");
const status = document.getElementById("status");

function createRow(entry = {}) {
  const row = document.createElement("div");
  row.className = "limit-row";

  const hostInput = document.createElement("input");
  hostInput.type = "text";
  hostInput.placeholder = "example.com";
  hostInput.value = entry.host || "";
  hostInput.required = true;

  const limitInput = document.createElement("input");
  limitInput.type = "number";
  limitInput.min = "1";
  limitInput.placeholder = "3";
  limitInput.value = entry.limit || "";
  limitInput.required = true;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.addEventListener("click", () => {
    row.remove();
  });

  row.appendChild(hostInput);
  row.appendChild(limitInput);
  row.appendChild(removeButton);

  return row;
}

function normalizeHost(input) {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

async function loadOptions() {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const list = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  limitsList.innerHTML = "";
  if (list.length === 0) {
    limitsList.appendChild(createRow());
    return;
  }
  for (const entry of list) {
    limitsList.appendChild(createRow(entry));
  }
}

async function saveOptions(event) {
  event.preventDefault();
  const rows = Array.from(limitsList.querySelectorAll(".limit-row"));
  const next = [];

  for (const row of rows) {
    const [hostInput, limitInput] = row.querySelectorAll("input");
    const host = normalizeHost(hostInput.value);
    const limit = Number(limitInput.value);

    if (!host || !Number.isFinite(limit) || limit <= 0) {
      status.textContent = "Please enter a valid hostname and limit.";
      status.style.color = "#b91c1c";
      return;
    }

    next.push({ host, limit: Math.floor(limit) });
  }

  await chrome.storage.sync.set({ [STORAGE_KEY]: next });
  status.textContent = "Saved.";
  status.style.color = "#0f766e";
  setTimeout(() => {
    status.textContent = "";
  }, 2000);
}

addButton.addEventListener("click", () => {
  limitsList.appendChild(createRow());
});

document.getElementById("limits-form").addEventListener("submit", saveOptions);

loadOptions();
