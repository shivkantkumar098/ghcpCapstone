const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appSource = fs.readFileSync(
  path.join(__dirname, "..", "script.js"),
  "utf8",
);
const htmlSource = fs.readFileSync(
  path.join(__dirname, "..", "index.html"),
  "utf8",
);

const collectText = (element) =>
  `${element.textContent}${element.children.map(collectText).join("")}`;

const collectTagNames = (element) => [
  element.tagName,
  ...element.children.flatMap(collectTagNames),
];

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.className = "";
    this.textContent = "";
    this.value = "";
    this.disabled = false;
    this.hidden = false;
    this.classList = {
      toggle: (name, force) => {
        const names = new Set(this.className.split(/\s+/).filter(Boolean));
        if (force) {
          names.add(name);
        } else {
          names.delete(name);
        }
        this.className = [...names].join(" ");
      },
    };
  }

  addEventListener(name, callback) {
    this.listeners[name] = callback;
  }

  dispatch(name) {
    const event = {
      prevented: false,
      preventDefault() {
        this.prevented = true;
      },
    };
    this.listeners[name]?.(event);
    return event;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  append(...elements) {
    this.children.push(...elements);
  }

  replaceChildren(...elements) {
    this.children = [...elements];
  }

  reset() {
    const elements = Object.values(this.elementsById || {});
    for (const element of elements) {
      if (element.id === "transaction-amount" || element.id === "transaction-note") {
        element.value = "";
      } else if (element.id === "transaction-type") {
        element.value = "Expense";
      }
    }
  }

  get innerHTML() {
    return this.children.map((child) => child.innerHTML || child.textContent).join("");
  }
}

const createStorage = (seed = {}, options = {}) => {
  const values = new Map(Object.entries(seed));
  let writeCount = 0;
  return {
    values,
    get writeCount() {
      return writeCount;
    },
    getItem(key) {
      if (options.failReads) {
        throw new Error("storage read denied");
      }
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      if (options.failWrites) {
        throw new Error("storage quota exceeded");
      }
      writeCount += 1;
      values.set(key, String(value));
    },
  };
};

const createApp = (storage = createStorage()) => {
  const ids = [
    "transaction-date",
    "transaction-form",
    "transaction-type",
    "transaction-amount",
    "transaction-note",
    "transaction-history",
    "empty-state",
    "history-filter",
    "balance-amount",
    "save-transaction",
    "form-error",
    "save-status",
    "load-error",
    "retry-load",
    "amount-error",
    "type-error",
    "date-error",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement()]));
  Object.entries(elements).forEach(([id, element]) => {
    element.id = id;
  });
  elements["transaction-form"].elementsById = elements;
  elements["transaction-type"].value = "Expense";
  elements["history-filter"].value = "all";

  let nextId = 1;
  const window = {
    localStorage: storage,
    crypto: {
      randomUUID: () => `test-${nextId++}`,
    },
  };
  const document = {
    getElementById: (id) => elements[id] || null,
    createElement: (tagName) => new FakeElement(tagName),
  };
  const context = vm.createContext({ window, document, console });
  vm.runInContext(
    `${appSource}\n;globalThis.__appTest = {
      parseAmountToPaise,
      formatINR,
      calculateAvailableBalance,
      getLocalDateString,
      formatTransactionDate,
      isValidTransactionDate,
      validateTransaction,
      transactionRepository
    };`,
    context,
    { filename: "script.js" },
  );

  return { context, elements, storage };
};

const transactionsFrom = (storage) =>
  JSON.parse(storage.values.get("transactions")).transactions;

const renderedTransactionTypes = (historyElement) =>
  historyElement.children[0].children.map(
    (transaction) => transaction.children[0].children[0].textContent,
  );

test("integration: index.html exposes every required app control and local asset", () => {
  for (const id of [
    "transaction-date",
    "transaction-form",
    "transaction-type",
    "transaction-amount",
    "transaction-note",
    "transaction-history",
    "empty-state",
    "history-filter",
    "balance-amount",
    "save-transaction",
    "form-error",
    "save-status",
    "load-error",
    "retry-load",
    "amount-error",
    "type-error",
    "date-error",
  ]) {
    assert.match(htmlSource, new RegExp(`\\bid="${id}"`), `missing #${id}`);
  }

  assert.match(htmlSource, /<form\b[^>]*id="transaction-form"/);
  assert.match(htmlSource, /<button\b[^>]*id="save-transaction"[^>]*type="submit"/);
  assert.match(htmlSource, /<label for="history-filter">Filter transactions<\/label>/);
  assert.match(
    htmlSource,
    /<select id="history-filter" name="history-filter">\s*<option value="all" selected>All<\/option>\s*<option value="income">Income<\/option>\s*<option value="expenses">Expenses<\/option>\s*<\/select>/,
  );
  assert.match(htmlSource, /<link\b[^>]*href="styles\.css"/);
  assert.match(htmlSource, /<script\b[^>]*src="script\.js"/);
  assert.doesNotMatch(htmlSource, /id="(?:budget|expense-title|edit|delete)[^"]*"/i);
});

test("unit: amount parsing accepts positive INR cents and rejects invalid precision", () => {
  const { context } = createApp();
  const { parseAmountToPaise } = context.__appTest;

  assert.equal(parseAmountToPaise("0.01"), 1);
  assert.equal(parseAmountToPaise("12.30"), 1230);
  assert.equal(parseAmountToPaise(".5"), 50);
  for (const invalid of ["", "0", "-1", "abc", "1.234", "90071992547409.92"]) {
    assert.equal(parseAmountToPaise(invalid), null, `expected ${invalid} to reject`);
  }
});

test("unit: balance starts at INR 100 and applies integer-paise entries", () => {
  const { context } = createApp();
  const { calculateAvailableBalance, formatINR } = context.__appTest;
  const transactions = [
    { type: "Money Received", amountInPaise: 10050 },
    { type: "Expense", amountInPaise: 2525 },
  ];

  assert.equal(calculateAvailableBalance([]), 10000);
  assert.equal(
    calculateAvailableBalance([{ type: "Expense", amountInPaise: 1234 }]),
    8766,
  );
  assert.equal(
    calculateAvailableBalance([{ type: "Money Received", amountInPaise: 1234 }]),
    11234,
  );
  assert.equal(calculateAvailableBalance(transactions), 17525);
  assert.equal(
    calculateAvailableBalance([{ type: "Expense", amountInPaise: 101234 }]),
    -91234,
  );
  assert.throws(
    () =>
      calculateAvailableBalance([
        { type: "Money Received", amountInPaise: Number.MAX_SAFE_INTEGER },
      ]),
    /available balance is outside the supported range/i,
  );
  assert.equal(formatINR(0), "₹0.00");
  assert.equal(formatINR(7525), "₹75.25");
  assert.equal(formatINR(-100001), "-₹1,000.01");
});

test("unit: calendar dates validate leap days and display DD/MM/YYYY", () => {
  const { context } = createApp();
  const { formatTransactionDate, getLocalDateString, isValidTransactionDate } =
    context.__appTest;

  assert.equal(isValidTransactionDate("2024-02-29"), true);
  assert.equal(isValidTransactionDate("2023-02-29"), false);
  assert.equal(isValidTransactionDate("2026-13-01"), false);
  assert.equal(formatTransactionDate("2026-10-14"), "14/10/2026");
  assert.equal(getLocalDateString(new Date(2026, 9, 14)), "2026-10-14");
});

test("unit: validation identifies amount, type, and date errors", () => {
  const { context } = createApp();
  const { validateTransaction } = context.__appTest;
  const result = validateTransaction({
    amount: "1.234",
    type: "Credit",
    date: "2023-02-29",
  });

  assert.equal(result.isValid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ["amount", "date", "type"]);
});

test("unit: legacy migration maps whole and fractional rupees without rounding", () => {
  const storage = createStorage({
    budget: "9999",
    expenses: JSON.stringify([
      { title: "Whole", amount: 12 },
      { title: "Paise", amount: 12.34 },
    ]),
  });
  const { context } = createApp(storage);

  const migrated = context.__appTest.transactionRepository.load();
  assert.deepEqual(
    JSON.parse(JSON.stringify(migrated)).map(({ amountInPaise, type, note }) => ({
      amountInPaise,
      type,
      note,
    })),
    [
      { amountInPaise: 1200, type: "Expense", note: "Whole" },
      { amountInPaise: 1234, type: "Expense", note: "Paise" },
    ],
  );
  assert.equal(storage.values.get("budget"), "9999");
  assert.equal(storage.values.get("expenses"), JSON.stringify([
    { title: "Whole", amount: 12 },
    { title: "Paise", amount: 12.34 },
  ]));
  assert.equal(context.__appTest.transactionRepository.load().length, 2);
});

test("unit: malformed legacy input does not partially write migrated transactions", () => {
  const originalExpenses = JSON.stringify([
    { title: "Valid", amount: 10.25 },
    { title: "Invalid", amount: 0 },
  ]);
  const storage = createStorage({ budget: "450", expenses: originalExpenses });
  const { context } = createApp(storage);

  assert.throws(() => context.__appTest.transactionRepository.load(), /legacy expense 2/i);
  assert.equal(storage.values.has("transactions"), false);
  assert.equal(storage.values.get("expenses"), originalExpenses);
  assert.equal(storage.values.get("budget"), "450");
});

test("integration: empty app loads; saving transaction persists, renders, and updates balance", () => {
  const storage = createStorage();
  const { elements } = createApp(storage);

  assert.equal(elements["balance-amount"].textContent, "₹100.00");
  assert.equal(elements["balance-amount"].hidden, false);
  assert.equal(elements["empty-state"].hidden, false);
  assert.equal(
    elements["empty-state"].textContent.trim(),
    "No transactions yet. Add one to get started.",
  );
  assert.equal(elements["save-transaction"].disabled, false);

  elements["transaction-amount"].value = "12.34";
  elements["transaction-date"].value = "2026-10-14";
  elements["transaction-note"].value = "Lunch";
  const event = elements["transaction-form"].dispatch("submit");

  assert.equal(event.prevented, true);
  assert.equal(elements["save-status"].textContent, "Transaction added.");
  assert.equal(elements["balance-amount"].textContent, "₹87.66");
  assert.equal(elements["empty-state"].hidden, true);
  assert.equal(transactionsFrom(storage).length, 1);
  const history = collectText(elements["transaction-history"]);
  assert.equal(history.includes("Expense"), true);
  assert.equal(history.includes("₹12.34"), true);
  assert.equal(history.includes("14/10/2026"), true);
  assert.equal(history.includes("Lunch"), true);
});

test("integration: history filter selects exact transaction types and All restores every record", () => {
  const initialTransactions = [
    {
      id: "expense-1",
      type: "Expense",
      amountInPaise: 1000,
      date: "2026-10-14",
      note: "First expense",
    },
    {
      id: "income-1",
      type: "Money Received",
      amountInPaise: 2000,
      date: "2026-10-15",
      note: "Income",
    },
    {
      id: "expense-2",
      type: "Expense",
      amountInPaise: 500,
      date: "2026-10-16",
      note: "Second expense",
    },
  ];
  const storage = createStorage({
    transactions: JSON.stringify({
      schemaVersion: 1,
      transactions: initialTransactions,
    }),
  });
  const { elements } = createApp(storage);
  const writesBeforeFiltering = storage.writeCount;
  const balanceBeforeFiltering = elements["balance-amount"].textContent;

  assert.deepEqual(renderedTransactionTypes(elements["transaction-history"]), [
    "Expense",
    "Money Received",
    "Expense",
  ]);
  assert.equal(balanceBeforeFiltering, "₹105.00");

  elements["history-filter"].value = "income";
  elements["history-filter"].dispatch("change");
  assert.deepEqual(renderedTransactionTypes(elements["transaction-history"]), [
    "Money Received",
  ]);

  elements["history-filter"].value = "expenses";
  elements["history-filter"].dispatch("change");
  assert.deepEqual(renderedTransactionTypes(elements["transaction-history"]), [
    "Expense",
    "Expense",
  ]);

  elements["history-filter"].value = "all";
  elements["history-filter"].dispatch("change");
  assert.deepEqual(renderedTransactionTypes(elements["transaction-history"]), [
    "Expense",
    "Money Received",
    "Expense",
  ]);
  assert.equal(elements["balance-amount"].textContent, balanceBeforeFiltering);
  assert.equal(storage.writeCount, writesBeforeFiltering);
  assert.deepEqual(transactionsFrom(storage), initialTransactions);
});

test("integration: filtered no-match uses generic copy while truly empty history keeps existing copy", () => {
  const storage = createStorage({
    transactions: JSON.stringify({
      schemaVersion: 1,
      transactions: [
        {
          id: "expense-1",
          type: "Expense",
          amountInPaise: 1000,
          date: "2026-10-14",
        },
      ],
    }),
  });
  const { elements } = createApp(storage);

  elements["history-filter"].value = "income";
  elements["history-filter"].dispatch("change");

  assert.equal(elements["empty-state"].hidden, false);
  assert.equal(
    elements["empty-state"].textContent,
    "No transactions match this filter.",
  );
  assert.deepEqual(renderedTransactionTypes(elements["transaction-history"]), []);
  assert.equal(elements["balance-amount"].textContent, "₹90.00");

  const trulyEmptyApp = createApp(createStorage());
  trulyEmptyApp.elements["history-filter"].value = "income";
  trulyEmptyApp.elements["history-filter"].dispatch("change");
  assert.equal(trulyEmptyApp.elements["empty-state"].hidden, false);
  assert.equal(
    trulyEmptyApp.elements["empty-state"].textContent.trim(),
    "No transactions yet. Add one to get started.",
  );

  const incomeStorage = createStorage({
    transactions: JSON.stringify({
      schemaVersion: 1,
      transactions: [
        {
          id: "income-1",
          type: "Money Received",
          amountInPaise: 1000,
          date: "2026-10-14",
        },
      ],
    }),
  });
  const incomeOnlyApp = createApp(incomeStorage);
  incomeOnlyApp.elements["history-filter"].value = "expenses";
  incomeOnlyApp.elements["history-filter"].dispatch("change");
  assert.equal(incomeOnlyApp.elements["empty-state"].hidden, false);
  assert.equal(
    incomeOnlyApp.elements["empty-state"].textContent,
    "No transactions match this filter.",
  );
});

test("integration: adding under an active filter saves full history and keeps full-history balance", () => {
  const storage = createStorage({
    transactions: JSON.stringify({
      schemaVersion: 1,
      transactions: [
        {
          id: "expense-1",
          type: "Expense",
          amountInPaise: 1000,
          date: "2026-10-14",
        },
      ],
    }),
  });
  const { elements } = createApp(storage);

  elements["history-filter"].value = "expenses";
  elements["history-filter"].dispatch("change");
  const writesBeforeAdd = storage.writeCount;
  assert.equal(storage.writeCount, writesBeforeAdd);

  elements["transaction-amount"].value = "25.00";
  elements["transaction-type"].value = "Money Received";
  elements["transaction-date"].value = "2026-10-15";
  elements["transaction-note"].value = "Scholarship";
  elements["transaction-form"].dispatch("submit");

  assert.equal(storage.writeCount, writesBeforeAdd + 1);
  assert.equal(transactionsFrom(storage).length, 2);
  assert.deepEqual(
    transactionsFrom(storage).map(({ type }) => type),
    ["Expense", "Money Received"],
  );
  assert.deepEqual(renderedTransactionTypes(elements["transaction-history"]), [
    "Expense",
  ]);
  assert.equal(elements["balance-amount"].textContent, "₹115.00");

  const reloadedApp = createApp(storage);
  assert.deepEqual(
    renderedTransactionTypes(reloadedApp.elements["transaction-history"]),
    ["Expense", "Money Received"],
  );
  assert.equal(reloadedApp.elements["balance-amount"].textContent, "₹115.00");
});

test("integration: invalid submission shows field feedback and does not persist", () => {
  const storage = createStorage();
  const { elements } = createApp(storage);
  elements["transaction-amount"].value = "0";
  elements["transaction-date"].value = "2026-10-14";

  elements["transaction-form"].dispatch("submit");

  assert.equal(elements["amount-error"].textContent.length > 0, true);
  assert.equal(elements["transaction-amount"].attributes["aria-invalid"], "true");
  assert.equal(transactionsFrom(storage).length, 0);
});

test("integration: reload restores saved records without changing balance", () => {
  const storage = createStorage();
  let app = createApp(storage);
  app.elements["transaction-amount"].value = "100.50";
  app.elements["transaction-type"].value = "Money Received";
  app.elements["transaction-date"].value = "2026-10-14";
  app.elements["transaction-form"].dispatch("submit");

  assert.equal(app.elements["balance-amount"].textContent, "₹200.50");
  app.elements["transaction-amount"].value = "12.34";
  app.elements["transaction-type"].value = "Expense";
  app.elements["transaction-date"].value = "2026-10-14";
  app.elements["transaction-note"].value = "Lunch";
  app.elements["transaction-form"].dispatch("submit");
  assert.equal(app.elements["balance-amount"].textContent, "₹188.16");

  app = createApp(storage);
  assert.equal(app.elements["balance-amount"].textContent, "₹188.16");
  assert.equal(app.elements["empty-state"].hidden, true);
  assert.equal(transactionsFrom(storage).length, 2);
  const history = collectText(app.elements["transaction-history"]);
  assert.equal(history.includes("Money Received"), true);
  assert.equal(history.includes("₹100.50"), true);
  assert.equal(history.includes("Expense"), true);
  assert.equal(history.includes("₹12.34"), true);
  assert.equal(history.includes("14/10/2026"), true);
  assert.equal(history.includes("Lunch"), true);
});

test("integration: markup-like notes are rendered as literal text", () => {
  const storage = createStorage();
  const { elements } = createApp(storage);
  const noteValue = "<img src=x onerror=alert(1)>";

  elements["transaction-amount"].value = "1";
  elements["transaction-date"].value = "2026-10-14";
  elements["transaction-note"].value = noteValue;
  elements["transaction-form"].dispatch("submit");

  const history = elements["transaction-history"];
  assert.equal(collectText(history).includes(noteValue), true);
  assert.equal(collectTagNames(history).includes("img"), false);
});

test("integration: failed save preserves form, state, and no-success feedback", () => {
  const initialEnvelope = JSON.stringify({ schemaVersion: 1, transactions: [] });
  const storage = createStorage(
    { transactions: initialEnvelope },
    { failWrites: true },
  );
  const { elements } = createApp(storage);
  elements["transaction-amount"].value = "5.25";
  elements["transaction-date"].value = "2026-10-14";
  elements["transaction-note"].value = "Keep this";

  elements["transaction-form"].dispatch("submit");

  assert.match(elements["form-error"].textContent, /could not be saved/i);
  assert.equal(elements["save-status"].textContent, "");
  assert.equal(elements["transaction-amount"].value, "5.25");
  assert.equal(elements["transaction-note"].value, "Keep this");
  assert.equal(elements["balance-amount"].textContent, "₹100.00");
  assert.equal(storage.values.get("transactions"), initialEnvelope);
});

test("integration: corrupt storage shows an error, hides empty state, and disables submit", () => {
  const storage = createStorage({ transactions: "{bad json" });
  const { elements } = createApp(storage);

  assert.notEqual(elements["load-error"].textContent, "");
  assert.equal(elements["empty-state"].hidden, true);
  assert.equal(elements["balance-amount"].hidden, true);
  assert.equal(elements["save-transaction"].disabled, true);
  assert.equal(elements["retry-load"].className.includes("hide"), false);
});

test("integration: storage read failure is visible and retry loads after recovery", () => {
  const options = { failReads: true };
  const storage = createStorage({}, options);
  const { elements } = createApp(storage);

  assert.notEqual(elements["load-error"].textContent, "");
  assert.equal(elements["balance-amount"].hidden, true);
  assert.equal(elements["save-transaction"].disabled, true);

  options.failReads = false;
  elements["retry-load"].dispatch("click");

  assert.equal(elements["load-error"].className.includes("hide"), true);
  assert.equal(elements["balance-amount"].textContent, "₹100.00");
  assert.equal(elements["save-transaction"].disabled, false);
  assert.equal(elements["empty-state"].hidden, false);
});

test("integration: unsafe legacy value blocks migration without altering source keys", () => {
  const expenses = JSON.stringify([
    { title: "First", amount: 12.34 },
    { title: "Bad precision", amount: 2.345 },
  ]);
  const storage = createStorage({ budget: "800", expenses });
  const { elements } = createApp(storage);

  assert.notEqual(elements["load-error"].textContent, "");
  assert.equal(storage.values.has("transactions"), false);
  assert.equal(storage.values.get("expenses"), expenses);
  assert.equal(storage.values.get("budget"), "800");
});
