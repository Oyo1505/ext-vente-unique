const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseTargetDays, taskMatchesFilter } = require("../task-filter.js");

test("la date cible relative de Lucca devient un nombre de jours", () => {
  assert.equal(parseTargetDays("il y a 1 jour"), -1);
  assert.equal(parseTargetDays(" dans 8 jours "), 8);
  assert.equal(parseTargetDays("dans 29 jours"), 29);
  assert.equal(parseTargetDays("dans 1 mois"), 30);
  assert.equal(parseTargetDays("dans 2 mois"), 60);
  assert.equal(parseTargetDays("dans un an"), 365);
  assert.equal(parseTargetDays("aujourd'hui"), 0);
  assert.equal(parseTargetDays("demain"), 1);
  assert.equal(parseTargetDays("hier"), -1);
  assert.equal(parseTargetDays(""), null);
});

test("une tâche est filtrée par type et par échéance", () => {
  const onboarding = { type: "Onboarding", days: 22 };
  const lateOffboarding = { type: "Offboarding", days: -1 };
  assert.ok(taskMatchesFilter(onboarding, { type: "all", period: "all" }));
  assert.ok(taskMatchesFilter(onboarding, { type: "Onboarding", period: "month" }));
  assert.ok(!taskMatchesFilter(onboarding, { type: "Offboarding", period: "all" }));
  assert.ok(!taskMatchesFilter(onboarding, { type: "all", period: "week" }));
  assert.ok(taskMatchesFilter(lateOffboarding, { type: "all", period: "late" }));
  assert.ok(!taskMatchesFilter(lateOffboarding, { type: "all", period: "month" }));
  assert.ok(taskMatchesFilter({ type: "Offboarding", days: 30 }, { type: "all", period: "later" }));
});

test("une date cible illisible n'apparaît que sans filtre d'échéance", () => {
  const task = { type: "Onboarding", days: null };
  assert.ok(taskMatchesFilter(task, { type: "all", period: "all" }));
  assert.ok(!taskMatchesFilter(task, { type: "all", period: "late" }));
});
